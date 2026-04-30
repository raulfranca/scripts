// ==UserScript==
// @name         1Doc - Desconcluir em Lote (Credenciamento)
// @namespace    http://tampermonkey.net/
// @version      0.7.0
// @description  Abre protocolos arquivados do credenciamento um a um e reabre os que estão concluídos. Modo automático com log completo.
// @author       Raul Cabral
// @match        https://pindamonhangaba.1doc.com.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/desconcluir.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/desconcluir.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ─── 1. KEYS ─────────────────────────────────────────────────────────────

    const LS_LOG         = '1doc_desconcluir_log';         // array: números já processados
    const LS_REABERTOS   = '1doc_desconcluir_reabertos';   // array: números efetivamente reabertos
    const LS_ATIVO       = '1doc_desconcluir_ativo';       // '1' quando o fluxo está ativo
    const LS_EM_PROCESSO = '1doc_desconcluir_em_processo'; // número do protocolo sendo processado
    const LS_ULTIMO      = '1doc_desconcluir_ultimo';      // { numero, status } — último resultado
    const LS_AUTO        = '1doc_desconcluir_auto';        // '1' quando o avanço automático está ativo

    // ─── 2. LOG UTILS ────────────────────────────────────────────────────────

    function lerLog() {
        try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); } catch { return []; }
    }

    function salvarLog(log) { localStorage.setItem(LS_LOG, JSON.stringify(log)); }

    function marcarVerificado(numero) {
        const log = lerLog();
        if (!log.includes(numero)) { log.push(numero); salvarLog(log); }
    }

    function lerReabertos() {
        try { return JSON.parse(localStorage.getItem(LS_REABERTOS) || '[]'); } catch { return []; }
    }

    function marcarReaberto(numero) {
        const r = lerReabertos();
        if (!r.includes(numero)) { r.push(numero); localStorage.setItem(LS_REABERTOS, JSON.stringify(r)); }
    }

    // ─── 3. DISPATCH ─────────────────────────────────────────────────────────

    // Inbox arquivados
    if (location.href.includes('pg=painel/listar') && location.href.includes('caixa=arquivo')) {
        localStorage.removeItem(LS_ATIVO); // limpar flag residual em caso de erro anterior
        iniciarInbox();
        return;
    }

    // Página do protocolo — só age se o fluxo estiver ativo
    if (location.href.includes('pg=doc/ver') && localStorage.getItem(LS_ATIVO) === '1') {
        aguardarCarregamentoProtocolo();
        return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // INBOX
    // ════════════════════════════════════════════════════════════════════════

    function iniciarInbox() {
        let ultimaUrl      = '';
        let ultimaQtdLinks = -1;

        function tick() {
            const urlAtual = location.href;
            const links    = document.querySelectorAll('a.link_emissao_a');
            const qtd      = links.length;

            // Sempre re-aplicar opacidade nas linhas já verificadas (idempotente)
            if (qtd > 0) marcarLinhasJaVerificadas();

            const mudou = urlAtual !== ultimaUrl || qtd !== ultimaQtdLinks;
            if (!mudou) return;

            ultimaUrl      = urlAtual;
            ultimaQtdLinks = qtd;

            if (qtd === 0) return; // ainda carregando

            if (!document.getElementById('desconcluir-painel')) criarPainel();
            atualizarPainel();

            // Auto-avançar se o modo automático estava ativo
            if (localStorage.getItem(LS_AUTO) === '1') {
                const prox = proximoNaoVerificado();
                if (prox) {
                    setTimeout(abrirProximo, 800);
                } else if (!navegarProximaPagina()) {
                    localStorage.removeItem(LS_AUTO);
                    atualizarPainel();
                }
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { tick(); setInterval(tick, 1000); });
        } else {
            tick();
            setInterval(tick, 1000);
        }
    }

    function extrairNumero(linkEl) {
        const match = linkEl.innerText.match(/(\d+\.\d{3}\/\d{4})/);
        return match ? match[1] : null;
    }

    function listarProtocolos() {
        return Array.from(document.querySelectorAll('a.link_emissao_a'))
            .map(el => ({ el, numero: extrairNumero(el), href: el.href }))
            .filter(p => p.numero !== null);
    }

    function proximoNaoVerificado() {
        const log = lerLog();
        return listarProtocolos().find(p => !log.includes(p.numero)) || null;
    }

    function abrirProximo() {
        const proximo = proximoNaoVerificado();
        if (!proximo) {
            if (localStorage.getItem(LS_AUTO) === '1' && navegarProximaPagina()) return;
            localStorage.removeItem(LS_AUTO);
            atualizarPainel();
            return;
        }

        marcarVerificado(proximo.numero);
        marcarLinhaVisualmente(proximo.numero);
        atualizarPainel();

        localStorage.setItem(LS_ATIVO, '1');
        location.href = new URL(proximo.href, location.origin).href;
    }

    // Clica no botão de próxima página (chevron-right) se disponível.
    // Retorna true se encontrou e clicou, false se não há mais páginas.
    function navegarProximaPagina() {
        const icone = document.querySelector('li.pagination_arrow a.navega_caixa i.icon-chevron-right');
        if (!icone) return false;
        icone.closest('a').click();
        return true;
    }

    function marcarLinhaVisualmente(numero) {
        listarProtocolos()
            .filter(p => p.numero === numero)
            .forEach(p => {
                const tr = p.el.closest('tr');
                if (tr) tr.style.opacity = '0.45';
            });
    }

    function marcarLinhasJaVerificadas() {
        const log = lerLog();
        listarProtocolos().forEach(p => {
            if (log.includes(p.numero)) marcarLinhaVisualmente(p.numero);
        });
    }

    function criarPainel() {
        if (document.getElementById('desconcluir-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'desconcluir-painel';
        painel.style.cssText = [
            'position:fixed', 'top:60px', 'right:20px',
            'background:#fff', 'border:1px solid #ccc', 'border-radius:6px',
            'padding:12px 16px', 'z-index:99999',
            'box-shadow:0 2px 10px rgba(0,0,0,.2)',
            'font-size:13px', 'min-width:220px',
            'font-family:sans-serif', 'line-height:1.5',
        ].join(';');
        document.body.appendChild(painel);
    }

    function atualizarPainel() {
        const painel = document.getElementById('desconcluir-painel');
        if (!painel) return;

        const log       = lerLog();
        const reabertos = lerReabertos();
        const todos     = listarProtocolos();
        const total     = todos.length;
        const verificados = todos.filter(p => log.includes(p.numero)).length;
        const pendentes = total - verificados;
        const concluido = pendentes === 0 && total > 0;
        const proximo   = proximoNaoVerificado();

        let ultimo = null;
        try { ultimo = JSON.parse(localStorage.getItem(LS_ULTIMO) || 'null'); } catch {}

        painel.innerHTML = '';

        // Título
        const titulo = document.createElement('strong');
        titulo.style.cssText = 'display:block;margin-bottom:8px;font-size:14px;';
        titulo.textContent = 'Desconcluir em Lote';
        painel.appendChild(titulo);

        // Último resultado
        if (ultimo) {
            const ult = document.createElement('div');
            ult.style.cssText = 'margin-bottom:8px;padding:5px 8px;border-radius:4px;font-size:12px;';
            const label =
                ultimo.status === 'reaberto'   ? '✓ Reaberto'      :
                ultimo.status === 'sem_botao'  ? '— Sem ação'       :
                ultimo.status === 'erro_modal' ? '⚠ Erro (modal)'  :
                                                 '⚠ Erro (timeout)';
            ult.style.background =
                ultimo.status === 'reaberto'  ? '#dff0d8' :
                ultimo.status === 'sem_botao' ? '#f5f5f5' : '#f2dede';
            ult.textContent = `Último: ${ultimo.numero} — ${label}`;
            painel.appendChild(ult);
        }

        // Contagem
        const contagem = document.createElement('div');
        contagem.style.cssText = 'margin-bottom:8px;color:#555;';
        contagem.innerHTML =
            `Verificados: <strong>${verificados}/${total}</strong> nesta página<br>` +
            `Reabertos (total): <strong>${reabertos.length}</strong><br>` +
            (concluido
                ? '<span style="color:#3c763d;font-weight:bold;">✓ Todos verificados</span>'
                : `<span style="color:#a94442;">${pendentes} pendente(s)</span>`);
        painel.appendChild(contagem);

        // Próximo
        if (proximo) {
            const prox = document.createElement('div');
            prox.style.cssText = 'margin-bottom:8px;font-size:12px;color:#555;';
            prox.innerHTML = `Próximo: <strong>${proximo.numero}</strong>`;
            painel.appendChild(prox);
        }

        // Botão de controle (Iniciar / Pausar / Concluído)
        const autoAtivo = localStorage.getItem(LS_AUTO) === '1';
        const btnCtrl = document.createElement('button');
        btnCtrl.textContent = concluido ? '✓ Concluído' : (autoAtivo ? '⏸ Pausar' : '▶ Iniciar');
        btnCtrl.disabled = concluido;
        btnCtrl.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px',
            'padding:7px 10px',
            'background:' + (concluido ? '#5cb85c' : (autoAtivo ? '#c0392b' : '#337ab7')),
            'color:#fff', 'border:none', 'border-radius:4px',
            'cursor:' + (concluido ? 'default' : 'pointer'),
            'font-size:13px',
        ].join(';');
        btnCtrl.addEventListener('click', () => {
            if (localStorage.getItem(LS_AUTO) === '1') {
                localStorage.removeItem(LS_AUTO);
                atualizarPainel();
            } else {
                localStorage.setItem(LS_AUTO, '1');
                abrirProximo();
            }
        });
        painel.appendChild(btnCtrl);

        // Botão ver log
        const btnLog = document.createElement('button');
        btnLog.textContent = '📋 Ver log';
        btnLog.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px', 'padding:5px 10px',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnLog.addEventListener('click', mostrarModalLog);
        painel.appendChild(btnLog);

        // Botão limpar
        const btnLimpar = document.createElement('button');
        btnLimpar.textContent = 'Limpar log';
        btnLimpar.style.cssText = [
            'display:block', 'width:100%', 'padding:5px 10px',
            'background:#f5f5f5', 'color:#555',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnLimpar.addEventListener('click', () => {
            if (!confirm('Limpar o log de protocolos verificados?')) return;
            salvarLog([]);
            localStorage.removeItem(LS_REABERTOS);
            localStorage.removeItem(LS_ULTIMO);
            localStorage.removeItem(LS_ATIVO);
            localStorage.removeItem(LS_EM_PROCESSO);
            document.querySelectorAll('tr').forEach(tr => { tr.style.opacity = ''; });
            atualizarPainel();
        });
        painel.appendChild(btnLimpar);

        // Info log total (quando há protocolos de outras páginas no log)
        const logTotal = lerLog().length;
        if (logTotal > total) {
            const info = document.createElement('div');
            info.style.cssText = 'margin-top:8px;font-size:11px;color:#aaa;';
            info.textContent = `Log total acumulado: ${logTotal} protocolo(s)`;
            painel.appendChild(info);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PROTOCOL PAGE
    // ════════════════════════════════════════════════════════════════════════

    // Aguarda .nd_num estar disponível (SPA pode demorar para renderizar)
    function aguardarCarregamentoProtocolo() {
        const MAX = 15000;
        const t0  = Date.now();
        const iv  = setInterval(() => {
            if (Date.now() - t0 > MAX) { clearInterval(iv); voltarParaInbox(); return; }
            const numEl = document.querySelector('.nd_num');
            if (!numEl || !numEl.innerText.trim()) return;
            clearInterval(iv);
            aguardarBotoesParaVerificar(numEl.innerText.trim());
        }, 400);
    }

    // Aguarda a barra de botões flutuantes carregar para então verificar o botão bf_v_19
    function aguardarBotoesParaVerificar(numero) {
        const emProcesso = localStorage.getItem(LS_EM_PROCESSO);
        const MAX = 10000;
        const t0  = Date.now();
        const iv  = setInterval(() => {
            if (Date.now() - t0 > MAX) {
                clearInterval(iv);
                finalizarSemBotao(numero, emProcesso);
                return;
            }
            // Botões flutuantes ainda não carregaram
            if (!document.querySelector('[class*="botao_flutuante_"]')) return;
            clearInterval(iv);

            const btnReabrir = document.querySelector('button.bf_v_19');
            if (btnReabrir) {
                processarReabertura(numero, btnReabrir);
            } else {
                finalizarSemBotao(numero, emProcesso);
            }
        }, 400);
    }

    // Protocolo sem o botão bf_v_19.
    // Se LS_EM_PROCESSO == numero, a página recarregou após o clique de confirmação
    // (ação completada com sucesso). Caso contrário, o protocolo nunca foi concluído.
    function finalizarSemBotao(numero, emProcesso) {
        if (emProcesso === numero) {
            localStorage.removeItem(LS_EM_PROCESSO);
            marcarReaberto(numero);
            registrarResultado(numero, 'reaberto');
        } else {
            registrarResultado(numero, 'sem_botao');
        }
        voltarParaInbox();
    }

    // Clica em "Reabrir conclusão" e contabiliza sucesso imediatamente.
    // O usuário confirma os dialogs manualmente; o script aguarda indefinidamente
    // o botão bf_v_19 sumir para então voltar ao inbox e continuar o automatismo.
    function processarReabertura(numero, btn) {
        localStorage.setItem(LS_EM_PROCESSO, numero);

        // Já conta como reaberto — a ação foi iniciada
        marcarReaberto(numero);
        registrarResultado(numero, 'reaberto');

        btn.click();

        // Aguarda indefinidamente o botão sumir (usuário confirma os dialogs)
        const iv = setInterval(() => {
            if (!document.querySelector('button.bf_v_19')) {
                clearInterval(iv);
                localStorage.removeItem(LS_EM_PROCESSO);
                voltarParaInbox();
            }
        }, 300);
    }

    function registrarResultado(numero, status) {
        localStorage.setItem(LS_ULTIMO, JSON.stringify({ numero, status }));
    }

    function mostrarModalLog() {
        if (document.getElementById('desconcluir-overlay')) return;
        const log       = lerLog();
        const reabertos = lerReabertos();
        const total     = log.length;
        const totalReab = reabertos.length;

        const overlay = document.createElement('div');
        overlay.id = 'desconcluir-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,.55)',
            'z-index:100000',
            'display:flex', 'align-items:center', 'justify-content:center',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:8px',
            'width:440px', 'max-width:96vw', 'max-height:80vh',
            'display:flex', 'flex-direction:column',
            'font-family:sans-serif', 'font-size:13px',
            'box-shadow:0 4px 20px rgba(0,0,0,.3)',
        ].join(';');

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:12px 16px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
        const h = document.createElement('strong');
        h.style.fontSize = '14px';
        h.textContent = `Log de Verificação — ${total} protocolo(s)`;
        const btnFechar = document.createElement('button');
        btnFechar.textContent = '✕';
        btnFechar.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:#888;line-height:1;';
        btnFechar.addEventListener('click', () => overlay.remove());
        header.appendChild(h);
        header.appendChild(btnFechar);
        box.appendChild(header);

        // Resumo
        const resumo = document.createElement('div');
        resumo.style.cssText = 'padding:8px 16px;background:#f9f9f9;border-bottom:1px solid #eee;font-size:12px;color:#555;flex-shrink:0;';
        resumo.innerHTML =
            `Analisados: <strong>${total}</strong> &nbsp;|&nbsp; ` +
            `Reabertos: <strong style="color:#3c763d;">${totalReab}</strong> &nbsp;|&nbsp; ` +
            `Sem ação: <strong>${total - totalReab}</strong>`;
        box.appendChild(resumo);

        // Lista
        const lista = document.createElement('div');
        lista.style.cssText = 'overflow-y:auto;flex:1 1 auto;padding:4px 0;';

        if (total === 0) {
            const vazio = document.createElement('div');
            vazio.style.cssText = 'padding:20px;color:#aaa;text-align:center;';
            vazio.textContent = 'Nenhum protocolo verificado ainda.';
            lista.appendChild(vazio);
        } else {
            log.forEach(numero => {
                const foiReaberto = reabertos.includes(numero);
                const item = document.createElement('div');
                item.style.cssText = [
                    'display:flex', 'justify-content:space-between', 'align-items:center',
                    'padding:5px 16px', 'border-bottom:1px solid #f0f0f0',
                    foiReaberto ? 'background:#f6ffed;' : '',
                ].join(';');
                const num = document.createElement('span');
                num.textContent = numero;
                num.style.fontFamily = 'monospace';
                const badge = document.createElement('span');
                badge.textContent = foiReaberto ? '✓ Reaberto' : '— Sem ação';
                badge.style.cssText = [
                    'font-size:11px', 'padding:2px 7px', 'border-radius:10px',
                    'background:'     + (foiReaberto ? '#dff0d8' : '#f5f5f5'),
                    'color:'          + (foiReaberto ? '#3c763d' : '#999'),
                    'border:1px solid ' + (foiReaberto ? '#d6e9c6' : '#e0e0e0'),
                ].join(';');
                item.appendChild(num);
                item.appendChild(badge);
                lista.appendChild(item);
            });
        }

        box.appendChild(lista);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    function voltarParaInbox() {
        localStorage.removeItem(LS_ATIVO);
        setTimeout(() => history.back(), 300);
    }

})();
