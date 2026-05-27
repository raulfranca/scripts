// ==UserScript==
// @name         PrintZap — Captura passo-a-passo de Conversas do WhatsApp
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Captura a conversa do WhatsApp Web tela por tela e copia cada PNG para a área de transferência. Sem PDF, sem bibliotecas pesadas.
// @author       Raul Cabral
// @match        https://web.whatsapp.com/*
// @icon         https://web.whatsapp.com/favicon.ico
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/printzap/printzap.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/printzap/printzap.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const LOG = (...args) => console.log('[PrintZap]', ...args);
    const WARN = (...args) => console.warn('[PrintZap]', ...args);
    const ERR = (...args) => console.error('[PrintZap]', ...args);

    LOG('Script iniciado. Versão 0.1.0 (getDisplayMedia)');

    // ─── Estado da sessão ────────────────────────────────────────────────────
    // Singleton: só uma sessão ativa por vez.
    let sessao = null;

    // ─── CSS ─────────────────────────────────────────────────────────────────
    GM_addStyle(`
        .pz-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: transparent;
            cursor: pointer;
            color: #54656f;
            transition: background 0.15s;
            flex-shrink: 0;
        }
        .pz-btn:hover { background: rgba(0,0,0,0.06); }
        .pz-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .pz-panel {
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 999999;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
            padding: 16px 20px;
            min-width: 280px;
            max-width: 320px;
            font-family: 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .pz-panel-title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #111b21;
        }
        .pz-panel-status {
            margin: 0;
            font-size: 12px;
            color: #667781;
            line-height: 1.4;
        }
        .pz-panel-status.pz-end {
            color: #1f8a3d;
            font-weight: 600;
        }
        .pz-panel-actions {
            display: flex;
            gap: 8px;
            margin-top: 4px;
        }
        .pz-btn-primary, .pz-btn-secondary {
            flex: 1;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.15s;
            border: 1px solid transparent;
        }
        .pz-btn-primary {
            background: #00a884;
            color: #fff;
            border-color: #00a884;
        }
        .pz-btn-primary:hover { background: #008f72; }
        .pz-btn-primary:disabled {
            background: #b4cdc4;
            border-color: #b4cdc4;
            cursor: not-allowed;
        }
        .pz-btn-secondary {
            background: #fff;
            color: #667781;
            border-color: #e9edef;
        }
        .pz-btn-secondary:hover { background: #f0f2f5; }

        .pz-toast {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: #323232;
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 9999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
    `);

    // ─── Utilitários ─────────────────────────────────────────────────────────

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function aguardarRenderizacao() {
        return new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 180)));
        });
    }

    function liberarCanvas(canvas) {
        if (!canvas) return;
        canvas.width = 0;
        canvas.height = 0;
    }

    function mostrarToast(mensagem, duracaoMs = 3000) {
        const t = document.createElement('div');
        t.className = 'pz-toast';
        t.setAttribute('data-printzap-ignore', '');
        t.textContent = mensagem;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), duracaoMs);
    }

    // ─── Seletores ───────────────────────────────────────────────────────────

    function getMain() {
        return document.querySelector('#main');
    }

    // Retorna o elemento rolável que contém as mensagens.
    // Verifica candidatos e prefere o que tem scrollHeight > clientHeight
    // (ou seja, que de fato rola). Sem isso, em alguns layouts o painel
    // retornado não rola e chegouNoFim() devolve sempre true.
    function getPainelMensagens() {
        const candidatos = [
            document.querySelector('#main div[role="application"]'),
            document.querySelector('#main .copyable-area'),
        ].filter(Boolean);

        // primeiro candidato que tem overflow vertical real
        for (const c of candidatos) {
            if (c.scrollHeight > c.clientHeight + 5) return c;
        }

        // fallback: procurar qualquer descendente de #main com overflow rolável
        const main = document.querySelector('#main');
        if (main) {
            const todos = main.querySelectorAll('div');
            for (const d of todos) {
                if (d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200) {
                    return d;
                }
            }
        }

        return candidatos[0] || main || null;
    }

    function getMensagensNoDom() {
        return Array.from(
            document.querySelectorAll('#main div[tabindex="-1"][data-id]')
        );
    }

    function getUltimaMensagemDom() {
        const todas = getMensagensNoDom();
        return todas.length ? todas[todas.length - 1] : null;
    }

    function getMensagensVisiveis(painel) {
        const rect = painel.getBoundingClientRect();
        return getMensagensNoDom().filter(el => {
            const r = el.getBoundingClientRect();
            return r.bottom > rect.top && r.top < rect.bottom;
        });
    }

    // Detecta se chegamos ao fim da conversa.
    // Critério primário: scroll do painel. Esse é o mais confiável — se ainda há
    // overflow significativo abaixo, certamente há mais conversa para rolar.
    // Critério secundário (data-id da última no DOM no viewport): pode dar falso
    // positivo por causa da virtualização do WhatsApp, mas serve como confirmação
    // quando o scroll já chegou perto do fim.
    function chegouNoFim(painel) {
        const scrollTop = painel.scrollTop;
        const clientHeight = painel.clientHeight;
        const scrollHeight = painel.scrollHeight;
        const restante = scrollHeight - (scrollTop + clientHeight);

        LOG(`chegouNoFim? scrollTop=${scrollTop.toFixed(0)} clientH=${clientHeight} scrollH=${scrollHeight} restante=${restante.toFixed(0)}px`);

        // Se ainda há mais que meia tela de scroll para baixo, claramente não é o fim.
        if (restante > clientHeight * 0.5) return false;

        // Próximo do fim no scroll — confirmar com a última mensagem do DOM no viewport.
        const ultima = getUltimaMensagemDom();
        if (!ultima) {
            LOG('chegouNoFim: nenhuma mensagem no DOM — assumindo fim.');
            return true;
        }

        const visiveis = getMensagensVisiveis(painel);
        const ultimaIdVisivel = visiveis.some(el => el.dataset.id === ultima.dataset.id);

        // Só consideramos fim se ambos os critérios concordam (scroll próximo + última visível),
        // OU se o scroll está realmente colado no fim (< 10px).
        if (restante < 10) {
            LOG('chegouNoFim: scroll no fim absoluto.');
            return true;
        }
        if (ultimaIdVisivel && restante < clientHeight * 0.1) {
            LOG('chegouNoFim: última mensagem visível e scroll quase no fim.');
            return true;
        }

        return false;
    }

    // ─── Painel de controle flutuante ────────────────────────────────────────

    function montarPainelControle() {
        const painel = document.createElement('div');
        painel.className = 'pz-panel';
        painel.setAttribute('data-printzap-ignore', '');

        const titulo = document.createElement('h3');
        titulo.className = 'pz-panel-title';
        titulo.textContent = 'PrintZap — Captura ativa';

        const status = document.createElement('p');
        status.className = 'pz-panel-status';
        status.textContent = 'Aguardando autorização de captura…';

        const acoes = document.createElement('div');
        acoes.className = 'pz-panel-actions';

        const btnProx = document.createElement('button');
        btnProx.className = 'pz-btn-primary';
        btnProx.textContent = 'Próxima (Enter)';
        btnProx.disabled = true;

        const btnFim = document.createElement('button');
        btnFim.className = 'pz-btn-secondary';
        btnFim.textContent = 'Encerrar (Esc)';

        acoes.append(btnProx, btnFim);
        painel.append(titulo, status, acoes);
        document.body.appendChild(painel);

        return { painel, status, btnProx, btnFim };
    }

    function atualizarPainelControle(elementos, sessao) {
        const { status, btnProx } = elementos;
        if (sessao.fimAtingido) {
            status.classList.add('pz-end');
            status.textContent = `Tela ${sessao.framesCapturados} copiada. Fim da conversa atingido — cole a última e clique Encerrar.`;
            btnProx.disabled = true;
        } else {
            status.classList.remove('pz-end');
            status.textContent = `Tela ${sessao.framesCapturados} copiada (Ctrl+V para colar). Pressione Enter quando estiver pronto para a próxima.`;
            btnProx.disabled = false;
        }
    }

    // ─── Atalhos de teclado ──────────────────────────────────────────────────

    function bindAtalhos(handlers) {
        const listener = (ev) => {
            if (ev.key === 'Enter') {
                if (sessao && !sessao.fimAtingido && !sessao.processando) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    handlers.proxima();
                }
            } else if (ev.key === 'Escape') {
                if (sessao) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    handlers.encerrar();
                }
            }
        };
        window.addEventListener('keydown', listener, { capture: true });
        return listener;
    }

    function unbindAtalhos(listener) {
        window.removeEventListener('keydown', listener, { capture: true });
    }

    // ─── Captura via getDisplayMedia ─────────────────────────────────────────

    async function pedirStream() {
        // preferCurrentTab é flag do Chrome/Edge — força a opção "aba atual"
        // como padrão no diálogo do navegador. Firefox ignora silenciosamente.
        const opcoes = {
            video: { displaySurface: 'browser' },
            audio: false,
        };
        try {
            opcoes.preferCurrentTab = true;
        } catch (_) { /* navegadores antigos podem não aceitar */ }

        return await navigator.mediaDevices.getDisplayMedia(opcoes);
    }

    function criarVideoOculto(stream) {
        const v = document.createElement('video');
        v.setAttribute('data-printzap-ignore', '');
        v.style.position = 'fixed';
        v.style.left = '-99999px';
        v.style.top = '-99999px';
        v.style.width = '1px';
        v.style.height = '1px';
        v.muted = true;
        v.playsInline = true;
        v.srcObject = stream;
        document.body.appendChild(v);
        return v;
    }

    function aguardarMetadata(video) {
        return new Promise((resolve) => {
            if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });
    }

    // Retorna o retângulo (em pixels CSS) a recortar do stream.
    // Primeira captura: #main inteiro (inclui header + mensagens + barra de input).
    // Capturas seguintes: apenas painelMsgs.
    function getRegiaoRecorte(primeiraVez) {
        const alvo = primeiraVez ? getMain() : getPainelMensagens();
        if (!alvo) return null;
        return alvo.getBoundingClientRect();
    }

    async function capturarTelaAtual(elementos) {
        if (!sessao || !sessao.video) return;
        sessao.processando = true;

        const primeiraVez = sessao.framesCapturados === 0;
        const rect = getRegiaoRecorte(primeiraVez);
        if (!rect) {
            sessao.processando = false;
            throw new Error('Não foi possível localizar a região para capturar.');
        }

        // Stream do getDisplayMedia tem resolução nativa em pixels reais.
        // window.innerWidth = pixels CSS. dpr converte.
        const dpr = window.devicePixelRatio || 1;
        const sx = Math.round(rect.left * dpr);
        const sy = Math.round(rect.top * dpr);
        const sw = Math.round(rect.width * dpr);
        const sh = Math.round(rect.height * dpr);

        // Esconder painel de controle DURANTE a captura para não aparecer no print.
        // Como o stream é "ao vivo", precisamos esperar 1 frame para o navegador
        // refletir o display:none no video stream.
        elementos.painel.style.visibility = 'hidden';
        await aguardarRenderizacao();

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');

        try {
            ctx.drawImage(sessao.video, sx, sy, sw, sh, 0, 0, sw, sh);
        } finally {
            elementos.painel.style.visibility = 'visible';
        }

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob retornou null')), 'image/png');
        });

        liberarCanvas(canvas);

        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
        } catch (err) {
            ERR('Falha ao escrever no clipboard:', err);
            mostrarToast('Não foi possível copiar para a área de transferência. Clique na página e tente novamente.', 4000);
            throw err;
        }

        sessao.framesCapturados++;
        sessao.processando = false;
        LOG(`Frame ${sessao.framesCapturados} copiado ao clipboard.`);
    }

    // ─── Fluxo de sessão ─────────────────────────────────────────────────────

    async function iniciarSessao() {
        if (sessao) {
            mostrarToast('Já existe uma sessão de captura ativa.');
            return;
        }

        // Verifica suporte do navegador
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert('PrintZap: seu navegador não suporta captura de tela (getDisplayMedia). Use Chrome ou Edge atualizados.');
            return;
        }
        if (typeof ClipboardItem === 'undefined') {
            alert('PrintZap: seu navegador não suporta cópia de imagens para a área de transferência. Use Chrome ou Edge atualizados.');
            return;
        }

        const painelMsgs = getPainelMensagens();
        if (!painelMsgs) {
            alert('PrintZap: não foi possível localizar o painel de mensagens. Abra uma conversa primeiro.');
            return;
        }

        sessao = {
            stream: null,
            video: null,
            painel: painelMsgs,
            framesCapturados: 0,
            fimAtingido: false,
            processando: false,
        };

        const elementos = montarPainelControle();

        // Bind atalhos
        const atalhosListener = bindAtalhos({
            proxima: () => proximaTela(elementos),
            encerrar: () => encerrarSessao(elementos),
        });
        sessao.atalhosListener = atalhosListener;

        // Bind botões
        elementos.btnProx.addEventListener('click', () => proximaTela(elementos));
        elementos.btnFim.addEventListener('click', () => encerrarSessao(elementos));

        try {
            const stream = await pedirStream();
            sessao.stream = stream;

            // Se o usuário parar de compartilhar pelo controle nativo do navegador,
            // encerramos a sessão.
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                if (sessao) {
                    LOG('Stream encerrado pelo usuário via controle do navegador.');
                    encerrarSessao(elementos);
                }
            });

            const video = criarVideoOculto(stream);
            sessao.video = video;
            await video.play();
            await aguardarMetadata(video);

            LOG(`Stream pronto: ${video.videoWidth}×${video.videoHeight}`);

            // Primeira captura imediata
            await capturarTelaAtual(elementos);
            if (chegouNoFim(painelMsgs)) {
                sessao.fimAtingido = true;
            }
            atualizarPainelControle(elementos, sessao);

        } catch (err) {
            ERR('Erro ao iniciar sessão:', err);
            if (err && err.name === 'NotAllowedError') {
                mostrarToast('Captura cancelada.');
            } else {
                mostrarToast(`Erro: ${err.message || err}`, 4000);
            }
            encerrarSessao(elementos);
        }
    }

    async function proximaTela(elementos) {
        if (!sessao || sessao.processando || sessao.fimAtingido) return;
        sessao.processando = true;

        try {
            const painelMsgs = sessao.painel;
            const alturaTela = painelMsgs.clientHeight;

            // Rola 90% da altura visível antes de capturar
            painelMsgs.scrollBy({ top: alturaTela * 0.9, behavior: 'auto' });
            await aguardarRenderizacao();

            await capturarTelaAtual(elementos);

            if (chegouNoFim(painelMsgs)) {
                sessao.fimAtingido = true;
            }
            atualizarPainelControle(elementos, sessao);
        } catch (err) {
            ERR('Erro na próxima tela:', err);
            sessao.processando = false;
        }
    }

    function encerrarSessao(elementos) {
        if (!sessao) return;

        LOG(`Sessão encerrada. Total de telas: ${sessao.framesCapturados}`);

        if (sessao.stream) {
            sessao.stream.getTracks().forEach(t => {
                try { t.stop(); } catch (_) {}
            });
        }
        if (sessao.video) {
            try { sessao.video.srcObject = null; } catch (_) {}
            sessao.video.remove();
        }
        if (sessao.atalhosListener) {
            unbindAtalhos(sessao.atalhosListener);
        }
        if (elementos && elementos.painel) {
            elementos.painel.remove();
        }

        sessao = null;

        // reabilita o botão de impressora no header
        const btn = document.querySelector('[data-printzap-btn]');
        if (btn) btn.disabled = false;
    }

    // ─── Injeção do botão no header ───────────────────────────────────────────

    function injetarBotaoCaptura(header) {
        if (header.querySelector('[data-printzap-btn]')) {
            return false;
        }

        LOG('Injetando botão no header do chat…');

        const btn = document.createElement('button');
        btn.className = 'pz-btn';
        btn.setAttribute('data-printzap-btn', '');
        btn.setAttribute('aria-label', 'Iniciar captura passo-a-passo');
        btn.setAttribute('title', 'PrintZap — Iniciar captura passo-a-passo');
        btn.setAttribute('data-printzap-ignore', '');

        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
        </svg>`;

        btn.addEventListener('click', () => {
            if (sessao) return;
            btn.disabled = true;
            iniciarSessao().finally(() => {
                // se sessão não iniciou (erro/cancelamento), reabilitar
                if (!sessao) btn.disabled = false;
            });
        });

        const botoesNativos = Array.from(header.querySelectorAll('button, [role="button"]'))
            .filter(b => {
                const r = b.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });

        if (botoesNativos.length > 0) {
            const primeiroBotao = botoesNativos[0];
            primeiroBotao.parentNode.insertBefore(btn, primeiroBotao);
            LOG('Botão inserido antes do primeiro botão nativo do header.');
            return true;
        }

        header.appendChild(btn);
        WARN('Nenhum botão nativo encontrado no header. Botão anexado no fim do header.');
        return true;
    }

    // ─── Inicialização com MutationObserver ───────────────────────────────────

    function getHeaderChat() {
        const main = document.querySelector('#main');
        if (!main) return null;
        return main.querySelector('header') || null;
    }

    let tentativasInjecao = 0;

    function verificarEInjetar() {
        const header = getHeaderChat();
        if (!header) {
            if (tentativasInjecao % 20 === 0) {
                LOG('Aguardando header do chat (#main header) aparecer…');
            }
            tentativasInjecao++;
            return;
        }
        if (injetarBotaoCaptura(header)) {
            tentativasInjecao = 0;
        }
    }

    function init() {
        LOG('init() chamado. Iniciando MutationObserver em document.body.');
        verificarEInjetar();

        let timer = null;
        const observer = new MutationObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                verificarEInjetar();
            }, 200);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.querySelector('#main')) {
        LOG('#main já presente na carga inicial.');
        init();
    } else {
        LOG('#main ainda não presente. Aguardando via MutationObserver…');
        const waitForMain = new MutationObserver(() => {
            if (document.querySelector('#main')) {
                LOG('#main detectado.');
                waitForMain.disconnect();
                init();
            }
        });
        waitForMain.observe(document.body, { childList: true, subtree: true });
    }

})();
