// ==UserScript==
// @name         1Doc - Folha de Frequência (Credenciamento)
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Destaca protocolos da folha de frequência no inbox do 1Doc e gerencia a coleta das fichas.
// @author       Raul Cabral
// @match        https://pindamonhangaba.1doc.com.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/folha.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/folha.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ─── 1. KEYS ─────────────────────────────────────────────────────────────

    const LS_LISTA     = '1doc_folha_lista';     // array: {nome, numero}
    const LS_COLETADOS = '1doc_folha_coletados'; // array: números já coletados
    const LS_MODO      = '1doc_folha_modo';      // 'entrada' | 'coleta'
    const LS_MES       = '1doc_folha_mes';       // string: mês de referência, ex: 'ABR-26'
    const LS_INBOX_URL = '1doc_folha_inbox_url'; // URL do inbox salva ao entrar nele

    const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

    // ─── 2. UTILS ────────────────────────────────────────────────────────────

    function lerLista()     { try { return JSON.parse(localStorage.getItem(LS_LISTA)     || '[]'); } catch { return []; } }
    function lerColetados() { try { return JSON.parse(localStorage.getItem(LS_COLETADOS) || '[]'); } catch { return []; } }
    function lerModo()      { return localStorage.getItem(LS_MODO) || 'entrada'; }
    function lerMes()       { return localStorage.getItem(LS_MES)  || ''; }
    function lerInboxUrl()  { return localStorage.getItem(LS_INBOX_URL) || location.origin; }
    function navegarInbox() { location.href = lerInboxUrl(); }

    function salvarLista(lista) { localStorage.setItem(LS_LISTA, JSON.stringify(lista)); }

    // Parseia linhas "Nome\tProtocolo" ou só "Protocolo"
    function parsearEntrada(texto) {
        const protoRegex = /(\d+\.\d{3}\/\d{4})/;
        const vistos     = new Set();
        const resultado  = [];
        texto.split('\n').forEach(linha => {
            const partes  = linha.trim().split('\t');
            let nome = '', numero = '';
            if (partes.length >= 2) {
                nome   = partes[0].trim();
                const m = partes[partes.length - 1].match(protoRegex);
                if (m) numero = m[1];
            } else {
                const m = linha.match(protoRegex);
                if (m) numero = m[1];
            }
            if (!numero || vistos.has(numero)) return;
            vistos.add(numero);
            resultado.push({ nome, numero });
        });
        return resultado;
    }

    // Helpers para trabalhar com lista de objetos
    function listaNumeros()    { return lerLista().map(e => e.numero); }
    function nomeDoNumero(n)   { return (lerLista().find(e => e.numero === n) || {}).nome || ''; }
    // LS_COLETADOS armazena Array<{numero, url}> — helpers de compatibilidade
    function coletadosNumeros() { return lerColetados().map(c => typeof c === 'string' ? c : c.numero); }
    function urlColetado(n)     { const c = lerColetados().find(c => (typeof c === 'string' ? c : c.numero) === n); return c && typeof c === 'object' ? c.url : ''; }

    // ─── 3. DISPATCH ─────────────────────────────────────────────────────────

    if (location.href.includes('pg=painel') && !location.href.includes('pg=painel/ver')) {
        iniciarInbox();
    } else if (location.href.includes('pg=doc/ver') && lerModo() === 'coleta') {
        iniciarPaginaProtocolo();
    }

    // ════════════════════════════════════════════════════════════════════════
    // INBOX
    // ════════════════════════════════════════════════════════════════════════

    function iniciarInbox() {
        localStorage.setItem(LS_INBOX_URL, location.href);
        let ultimaUrl      = '';
        let ultimaQtdLinks = -1;

        function tick() {
            const urlAtual = location.href;
            const links    = document.querySelectorAll('a.link_emissao_a');
            const qtd      = links.length;

            // Sempre re-aplicar destaques no modo coleta (idempotente)
            if (qtd > 0 && lerModo() === 'coleta') aplicarDestaques();

            const mudou = urlAtual !== ultimaUrl || qtd !== ultimaQtdLinks;
            if (!mudou) return;

            ultimaUrl      = urlAtual;
            ultimaQtdLinks = qtd;

            if (qtd === 0) return;

            if (!document.getElementById('folha-painel')) criarPainel();
            atualizarPainel();
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
            .map(el => ({ el, numero: extrairNumero(el) }))
            .filter(p => p.numero !== null);
    }

    function aplicarDestaques() {
        const numeros   = listaNumeros();
        const coletados = coletadosNumeros();
        if (numeros.length === 0) return;

        listarProtocolos().forEach(({ el, numero }) => {
            const tr = el.closest('tr');
            if (!tr) return;

            if (!numeros.includes(numero)) return;

            if (coletados.includes(numero)) {
                // Já coletado: remover destaque verde (voltar ao normal)
                if (tr.dataset.folhaDestacado === '1') {
                    tr.removeAttribute('data-folha-destacado');
                    tr.style.removeProperty('background');
                    tr.style.removeProperty('box-shadow');
                    tr.querySelectorAll('td').forEach(td => td.style.removeProperty('background-color'));
                    const icone = tr.querySelector('.folha-icone');
                    if (icone) icone.remove();
                }
            } else {
                destacarLinha(tr, el);
            }
        });
    }

    function destacarLinha(tr, linkEl) {
        if (tr.dataset.folhaDestacado === '1') return; // já aplicado
        tr.dataset.folhaDestacado = '1';

        // setProperty com 'important' gera inline !important — sobrepõe qualquer regra de stylesheet
        const bg = 'linear-gradient(90deg,#e6f9ee 0%,#f0fff6 100%)';
        tr.style.setProperty('background', bg, 'important');
        tr.style.setProperty('box-shadow', 'inset 3px 0 0 #27ae60', 'important');
        tr.querySelectorAll('td').forEach(td => td.style.setProperty('background-color', '#e6f9ee', 'important'));

        if (!linkEl.querySelector('.folha-icone')) {
            const icone = document.createElement('span');
            icone.className = 'folha-icone';
            icone.textContent = '📄 ';
            icone.style.cssText = 'font-size:12px;margin-right:2px;vertical-align:middle;';
            linkEl.insertBefore(icone, linkEl.firstChild);
        }
    }

    function removerTodosDestaques() {
        document.querySelectorAll('tr[data-folha-destacado]').forEach(tr => {
            tr.removeAttribute('data-folha-destacado');
            tr.style.removeProperty('background');
            tr.style.removeProperty('box-shadow');
            tr.querySelectorAll('td').forEach(td => td.style.removeProperty('background-color'));
            const icone = tr.querySelector('.folha-icone');
            if (icone) icone.remove();
        });
    }

    function contarVisiveis() {
        const numeros   = listaNumeros();
        const coletados = coletadosNumeros();
        if (numeros.length === 0) return 0;
        return listarProtocolos().filter(p => numeros.includes(p.numero) && !coletados.includes(p.numero)).length;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PAINEL
    // ════════════════════════════════════════════════════════════════════════

    function criarPainel() {
        if (document.getElementById('folha-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'folha-painel';
        painel.style.cssText = [
            'position:fixed', 'top:60px', 'right:20px',
            'background:#fff', 'border:1px solid #ccc', 'border-radius:6px',
            'padding:12px 16px', 'z-index:99999',
            'box-shadow:0 2px 10px rgba(0,0,0,.2)',
            'font-size:13px', 'width:260px',
            'font-family:sans-serif', 'line-height:1.5',
        ].join(';');
        document.body.appendChild(painel);
    }

    function atualizarPainel() {
        const painel = document.getElementById('folha-painel');
        if (!painel) return;

        const modo      = lerModo();
        const colapsado = painel.dataset.colapsado === '1';

        painel.innerHTML = '';

        // ── Cabeçalho ──────────────────────────────────────────────────────
        const cabecalho = document.createElement('div');
        cabecalho.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:' + (colapsado ? '0' : '10px') + ';';

        const titulo = document.createElement('strong');
        titulo.style.cssText = 'font-size:14px;';
        titulo.textContent = '📋 Folha de Frequência';
        cabecalho.appendChild(titulo);

        const btnColapsar = document.createElement('button');
        btnColapsar.textContent = colapsado ? '▼' : '▲';
        btnColapsar.title = colapsado ? 'Expandir' : 'Recolher';
        btnColapsar.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;color:#888;padding:0 0 0 8px;line-height:1;';
        btnColapsar.addEventListener('click', () => {
            painel.dataset.colapsado = painel.dataset.colapsado === '1' ? '0' : '1';
            atualizarPainel();
        });
        cabecalho.appendChild(btnColapsar);
        painel.appendChild(cabecalho);

        if (colapsado) {
            if (modo === 'coleta') {
                const lista     = lerLista();
                const coletados = lerColetados();
                const visiveis  = contarVisiveis();
                const mini = document.createElement('div');
                mini.style.cssText = 'font-size:12px;color:#555;margin-top:2px;';
                const mesMini = lerMes();
                mini.innerHTML =
                    (mesMini ? `<span style="font-size:11px;color:#888;">${mesMini}</span><br>` : '') +
                    `<strong style="color:#2980b9;">${coletados.length}</strong>/${lerLista().length} coletado(s)` +
                    ` · <strong style="color:#27ae60;">${visiveis}</strong> pend.`;
                painel.appendChild(mini);
            }
            return;
        }

        if (modo === 'entrada') {
            renderizarModoEntrada(painel);
        } else {
            renderizarModoColeta(painel);
        }
    }

    // ── Modo Entrada ───────────────────────────────────────────────────────
    function renderizarModoEntrada(painel) {
        const lista    = lerLista();
        const mesAtual = lerMes();
        const ano      = String(new Date().getFullYear()).slice(-2);

        // ── Seletor de mês ─────────────────────────────────────────────────
        const labelMes = document.createElement('label');
        labelMes.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:4px;';
        labelMes.textContent = 'Mês de referência:';
        painel.appendChild(labelMes);

        const mesBtns = document.createElement('div');
        mesBtns.id = 'folha-mes-grid';
        mesBtns.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:10px;';
        MESES.forEach(m => {
            const valor = `${m}-${ano}`;
            const ativo = mesAtual === valor;
            const btn   = document.createElement('button');
            btn.textContent = m;
            btn.title       = valor;
            btn.dataset.mes = valor;
            btn.style.cssText = [
                'padding:4px 0', 'font-size:11px',
                'border-radius:3px', 'cursor:pointer',
                'border:1px solid '  + (ativo ? '#27ae60' : '#ccc'),
                'background:'        + (ativo ? '#27ae60' : '#f5f5f5'),
                'color:'             + (ativo ? '#fff'    : '#444'),
                'font-weight:'       + (ativo ? '700'     : 'normal'),
            ].join(';');
            btn.addEventListener('click', () => {
                localStorage.setItem(LS_MES, valor);
                mesBtns.querySelectorAll('button').forEach(b => {
                    const sel = b.dataset.mes === valor;
                    b.style.border     = '1px solid ' + (sel ? '#27ae60' : '#ccc');
                    b.style.background = sel ? '#27ae60' : '#f5f5f5';
                    b.style.color      = sel ? '#fff'    : '#444';
                    b.style.fontWeight = sel ? '700'     : 'normal';
                });
                mesBtns.style.outline = '';
            });
            mesBtns.appendChild(btn);
        });
        painel.appendChild(mesBtns);

        // ── Textarea ───────────────────────────────────────────────────────
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:4px;';
        label.textContent = 'Cole os protocolos (Nome\tNúmero):';
        painel.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.id = 'folha-textarea';
        textarea.value = lista.map(e => e.nome ? `${e.nome}\t${e.numero}` : e.numero).join('\n');
        textarea.placeholder = 'Ana Paula da Silva\t14.712/2026\nBianca de Souza\t13.049/2026';
        textarea.rows = 7;
        textarea.style.cssText = [
            'display:block', 'width:100%', 'box-sizing:border-box',
            'margin-bottom:8px', 'padding:6px 8px',
            'border:1px solid #ccc', 'border-radius:4px',
            'font-size:12px', 'font-family:monospace', 'resize:vertical',
            'line-height:1.4',
        ].join(';');
        painel.appendChild(textarea);

        // ── Botão Iniciar ──────────────────────────────────────────────────
        const btnIniciar = document.createElement('button');
        btnIniciar.textContent = '▶ Iniciar coleta';
        btnIniciar.style.cssText = [
            'display:block', 'width:100%',
            'padding:7px 10px',
            'background:#27ae60', 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:pointer', 'font-size:13px',
        ].join(';');
        btnIniciar.addEventListener('click', () => {
            const novaLista = parsearEntrada(textarea.value);
            const mesSel    = lerMes();
            if (!mesSel) {
                mesBtns.style.outline      = '2px solid #c0392b';
                mesBtns.style.borderRadius = '3px';
                return;
            }
            if (novaLista.length === 0) {
                textarea.style.borderColor = '#c0392b';
                textarea.focus();
                return;
            }
            salvarLista(novaLista);
            localStorage.setItem(LS_MODO, 'coleta');
            removerTodosDestaques();
            aplicarDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnIniciar);
    }

    // ── Modo Coleta ────────────────────────────────────────────────────────
    function renderizarModoColeta(painel) {
        const lista      = lerLista();
        const coletados  = lerColetados();
        const visiveis   = contarVisiveis();
        const total      = lista.length;
        const nColetados = coletados.length;
        const faltam     = total - nColetados;

        const stats = document.createElement('div');
        stats.style.cssText = [
            'margin-bottom:10px', 'padding:8px 10px',
            'background:#f9f9f9', 'border-radius:4px',
            'font-size:12px', 'color:#444',
            'border:1px solid #eee', 'line-height:1.9',
        ].join(';');
        const mes = lerMes() || '–';
        stats.innerHTML =
            `Mês: <strong>${mes}</strong><br>` +
            `Na lista: <strong>${total}</strong><br>` +
            `Pend. visíveis: <strong style="color:#27ae60;">${visiveis}</strong><br>` +
            `Já coletados: <strong style="color:#2980b9;">${nColetados}</strong><br>` +
            `Faltam: <strong style="color:${faltam > 0 ? '#c0392b' : '#27ae60'};">${faltam}</strong>`;
        painel.appendChild(stats);

        // Botão Ver lista
        const btnVer = document.createElement('button');
        btnVer.textContent = '👁 Ver lista';
        btnVer.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px',
            'padding:6px 10px',
            'background:#2980b9', 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnVer.addEventListener('click', mostrarModalLista);
        painel.appendChild(btnVer);

        const btnEditar = document.createElement('button');
        btnEditar.textContent = '✏️ Editar lista';
        btnEditar.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px',
            'padding:6px 10px',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnEditar.addEventListener('click', () => {
            localStorage.setItem(LS_MODO, 'entrada');
            removerTodosDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnEditar);

        const btnLimpar = document.createElement('button');
        btnLimpar.textContent = 'Limpar tudo';
        btnLimpar.style.cssText = [
            'display:block', 'width:100%', 'padding:5px 10px',
            'background:#f5f5f5', 'color:#555',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnLimpar.addEventListener('click', () => {
            if (!confirm('Limpar lista e dados de coleta?')) return;
            salvarLista([]);
            localStorage.setItem(LS_COLETADOS, '[]');
            localStorage.removeItem(LS_MES);
            localStorage.setItem(LS_MODO, 'entrada');
            removerTodosDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnLimpar);
    }

    function mostrarModalLista() {
        if (document.getElementById('folha-modal-lista')) return;
        const lista     = lerLista();
        const coletados = lerColetados();
        const colNums   = coletadosNumeros();

        const overlay = document.createElement('div');
        overlay.id = 'folha-modal-lista';
        overlay.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,.5)',
            'z-index:100001',
            'display:flex', 'align-items:center', 'justify-content:center',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:8px',
            'width:480px', 'max-width:96vw', 'max-height:80vh',
            'display:flex', 'flex-direction:column',
            'font-family:sans-serif', 'font-size:13px',
            'box-shadow:0 4px 20px rgba(0,0,0,.3)',
        ].join(';');

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:12px 16px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
        const h = document.createElement('strong');
        h.style.fontSize = '14px';
        h.textContent = `Lista — ${lerMes() || ''} (${lista.length} protocolo(s))`;
        const btnFechar = document.createElement('button');
        btnFechar.textContent = '✕';
        btnFechar.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:#888;line-height:1;';
        btnFechar.addEventListener('click', () => overlay.remove());
        header.appendChild(h);
        header.appendChild(btnFechar);
        box.appendChild(header);

        // Resumo
        const resumo = document.createElement('div');
        resumo.style.cssText = 'padding:7px 16px;background:#f9f9f9;border-bottom:1px solid #eee;font-size:12px;color:#555;flex-shrink:0;';
        resumo.innerHTML =
            `Coletados: <strong style="color:#2980b9;">${coletados.length}</strong> &nbsp;|&nbsp;` +
            `Pendentes: <strong style="color:#c0392b;">${lista.length - coletados.length}</strong>`;
        box.appendChild(resumo);

        // Lista
        const corpo = document.createElement('div');
        corpo.style.cssText = 'overflow-y:auto;flex:1 1 auto;padding:4px 0;';

        if (lista.length === 0) {
            const vazio = document.createElement('div');
            vazio.style.cssText = 'padding:20px;color:#aaa;text-align:center;';
            vazio.textContent = 'Nenhum protocolo na lista.';
            corpo.appendChild(vazio);
        } else {
            lista.forEach(({ nome, numero }) => {
                const coletado = colNums.includes(numero);
                const item = document.createElement('div');
                item.style.cssText = [
                    'display:flex', 'justify-content:space-between', 'align-items:center',
                    'padding:5px 16px', 'border-bottom:1px solid #f0f0f0',
                    coletado ? 'background:#f6ffed' : '',
                ].join(';');

                const info = document.createElement('div');
                info.style.cssText = 'min-width:0;';
                const nomeEl = document.createElement('div');
                nomeEl.style.cssText = 'font-size:12px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;';
                nomeEl.textContent = nome || '—';
                const numEl = document.createElement('div');
                numEl.style.cssText = 'font-size:11px;color:#888;font-family:monospace;';
                numEl.textContent = numero;
                info.appendChild(nomeEl);
                info.appendChild(numEl);

                const badgeCss = [
                    'font-size:11px', 'padding:2px 7px', 'border-radius:10px',
                    'white-space:nowrap', 'margin-left:8px', 'flex-shrink:0',
                    'background:'       + (coletado ? '#dff0d8' : '#fcf8e3'),
                    'color:'            + (coletado ? '#3c763d' : '#8a6d3b'),
                    'border:1px solid ' + (coletado ? '#d6e9c6' : '#faebcc'),
                ].join(';');
                const url = coletado ? urlColetado(numero) : '';
                let badge;
                if (url) {
                    badge = document.createElement('a');
                    badge.href = url;
                    badge.target = '_blank';
                    badge.rel = 'noopener';
                    badge.style.cssText = badgeCss + ';text-decoration:none;cursor:pointer;';
                } else {
                    badge = document.createElement('span');
                    badge.style.cssText = badgeCss;
                }
                badge.textContent = coletado ? '✓ Coletado' : '⏳ Pendente';

                item.appendChild(info);
                item.appendChild(badge);
                corpo.appendChild(item);
            });
        }

        box.appendChild(corpo);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA DO PROTOCOLO
    // ════════════════════════════════════════════════════════════════════════

    function iniciarPaginaProtocolo() {
        const MAX = 15000;
        const t0  = Date.now();
        const iv  = setInterval(() => {
            if (Date.now() - t0 > MAX) { clearInterval(iv); return; }
            const numEl = document.querySelector('.nd_num');
            if (!numEl || !numEl.innerText.trim()) return;
            clearInterval(iv);

            const numero = numEl.innerText.trim();
            if (!listaNumeros().includes(numero)) return; // protocolo não está na lista

            // Rolar para o fim da página
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            // Nome vem da lista salva (mais confiável que extração do DOM)
            const mesRef = lerMes();
            const nome   = nomeDoNumero(numero) || extrairNomeRemetente();

            // Interceptar cliques em links de anexo — dialog só aparece após o clique
            function interceptarAnexo(e) {
                const link = e.target.closest('a[href*="pg=doc/anexo"]');
                if (!link) return;
                e.preventDefault();
                e.stopPropagation();

                // Escrever no clipboard dentro do gesto (clique)
                const texto = [mesRef, nome].filter(Boolean).join(' ');
                if (texto) navigator.clipboard.writeText(texto).catch(() => {});

                const w    = Math.floor(screen.availWidth  / 2);
                const h    = screen.availHeight;
                const left = Math.floor(screen.availWidth  / 2);
                window.open(link.href, 'folha-anexo', `width=${w},height=${h},left=${left},top=0`);
                mostrarDialogColeta(numero, interceptarAnexo);
            }

            document.addEventListener('click', interceptarAnexo, true);
        }, 400);
    }

    function extrairNomeRemetente() {
        const ppEls = document.querySelectorAll('span.pp[data-content]');
        for (const el of ppEls) {
            const nome = (el.dataset.content || '').trim();
            if (nome && nome.split(' ').length >= 2) return nome;
        }
        const ppEl = document.querySelector('span.pp');
        return ppEl ? (ppEl.dataset.content || ppEl.innerText || '').trim() : '';
    }

function mostrarDialogColeta(numero, handlerAnexo) {
        if (document.getElementById('folha-dialog')) return;
        const mesRef = lerMes();

        // Overlay com pointer-events:none — não bloqueia cliques na página
        const overlay = document.createElement('div');
        overlay.id = 'folha-dialog';
        overlay.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,.35)',
            'z-index:100000',
            'display:flex', 'align-items:center', 'justify-content:center',
            'pointer-events:none',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:8px',
            'padding:22px 26px', 'max-width:360px', 'width:90%',
            'box-shadow:0 4px 24px rgba(0,0,0,.3)',
            'font-family:sans-serif', 'font-size:13px',
            'text-align:center', 'pointer-events:auto',
        ].join(';');

        const titulo = document.createElement('div');
        titulo.style.cssText = 'font-size:15px;font-weight:700;color:#333;margin-bottom:8px;';
        titulo.textContent = '📋 Folha de Frequência';
        box.appendChild(titulo);

        const sub = document.createElement('div');
        sub.style.cssText = 'color:#555;margin-bottom:20px;line-height:1.5;';
        sub.innerHTML = `A folha de frequência${mesRef ? ` <strong>${mesRef}</strong>` : ''} foi salva com sucesso?`;
        box.appendChild(sub);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:10px;justify-content:center;';

        const btnSim = document.createElement('button');
        btnSim.textContent = '✓ Sim, salva';
        btnSim.style.cssText = [
            'padding:8px 22px',
            'background:#27ae60', 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:pointer', 'font-size:13px', 'font-weight:700',
        ].join(';');
        btnSim.addEventListener('click', () => {
            marcarColetado(numero);
            overlay.remove();
            document.removeEventListener('click', handlerAnexo, true);
            responderProtocolo(numero);
        });

        const btnNao = document.createElement('button');
        btnNao.textContent = '✗ Não';
        btnNao.style.cssText = [
            'padding:8px 18px',
            'background:#f5f5f5', 'color:#555',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:13px',
        ].join(';');
        btnNao.addEventListener('click', () => {
            overlay.remove();
        });

        btns.appendChild(btnSim);
        btns.appendChild(btnNao);
        box.appendChild(btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Foco no Sim + Enter confirma
        setTimeout(() => btnSim.focus(), 50);
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); btnSim.click(); }
        });
    }

    function marcarColetado(numero) {
        const coletados = lerColetados();
        if (!coletadosNumeros().includes(numero)) {
            coletados.push({ numero, url: location.href });
            localStorage.setItem(LS_COLETADOS, JSON.stringify(coletados));
        }
    }

    function responderProtocolo(numero) {
        // 1. Clicar no botão flutuante "Responder" (bf_v_1)
        const btnResp = document.querySelector('button.bf_v_1');
        if (!btnResp) { navegarInbox(); return; }
        btnResp.click();

        const nome = nomeDoNumero(numero);
        const MAX  = 12000;
        const t0   = Date.now();

        // 2. Aguardar o Select2 de destinatário estar visível e abri-lo
        const ivSelect = setInterval(() => {
            if (Date.now() - t0 > MAX) { clearInterval(ivSelect); navegarInbox(); return; }
            const s2 = document.querySelector('#s2id_id_setor_responde .select2-choice');
            if (!s2 || !s2.offsetParent) return;
            clearInterval(ivSelect);

            // Abrir dropdown via API jQuery/Select2; fallback para eventos de mouse
            const selEl = document.getElementById('id_setor_responde');
            if (window.$ && selEl && typeof $(selEl).select2 === 'function') {
                $(selEl).select2('open');
            } else {
                s2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                s2.click();
            }

            // 3a. Aguardar a caixa de busca do dropdown e digitar o nome para filtrar
            const t1 = Date.now();
            const ivBusca = setInterval(() => {
                if (Date.now() - t1 > MAX) { clearInterval(ivBusca); navegarInbox(); return; }
                const input = document.querySelector('#select2-drop input.select2-input');
                if (!input) return;
                clearInterval(ivBusca);

                // Digitar o nome completo para filtrar sem ambiguidade
                const termo = nome || '';
                if (termo && window.$) {
                    $(input).val(termo).trigger('input').trigger('keyup');
                } else if (termo) {
                    input.value = termo;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                }

                // 3b. Aguardar resultados filtrados e confirmar com Enter
                const t2 = Date.now();
                const ivOpcao = setInterval(() => {
                    if (Date.now() - t2 > MAX) { clearInterval(ivOpcao); navegarInbox(); return; }
                    const lis = document.querySelectorAll('#select2-drop li.select2-result-selectable, #select2-drop li.select2-result');
                    if (lis.length === 0) return;
                    clearInterval(ivOpcao);

                    // Pressionar Enter na caixa de busca — o Select2 seleciona o item em foco
                    const inputAtivo = document.querySelector('#select2-drop input.select2-input');
                    const alvo = inputAtivo || input;
                    ['keydown', 'keypress', 'keyup'].forEach(tipo => {
                        alvo.dispatchEvent(new KeyboardEvent(tipo, {
                            key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                            bubbles: true, cancelable: true,
                        }));
                    });

                // 4. Aguardar o TinyMCE inicializar APÓS a seleção do destinatário
                    // 4. Aguardar o TinyMCE inicializar APÓS a seleção do destinatário
                    const t3 = Date.now();
                    const ivEditor = setInterval(() => {
                        if (Date.now() - t3 > MAX) { clearInterval(ivEditor); navegarInbox(); return; }
                        if (!window.tinymce || !tinymce.activeEditor) return;
                        const editor = tinymce.activeEditor;
                        if (!editor.getBody()) return;
                        clearInterval(ivEditor);

                        // 5. Compor mensagem
                        editor.setContent('<p>Prezada(o), folha de frequência recebida.<br>Atenciosamente,</p>');

                        // 6. Clicar em "Responder" (submit)
                        setTimeout(() => {
                            const btnEnviar = document.getElementById('enviar_documento');
                            if (btnEnviar) btnEnviar.click();

                            // 7. Aguardar dialog de confirmação e clicar em "sim"
                            const t4 = Date.now();
                            const ivSim = setInterval(() => {
                                if (Date.now() - t4 > MAX) { clearInterval(ivSim); navegarInbox(); return; }
                                const btnSim = document.getElementById('sim');
                                if (!btnSim || !btnSim.offsetParent) return;
                                clearInterval(ivSim);
                                btnSim.click();
                                setTimeout(() => navegarInbox(), 3000);
                            }, 200);
                        }, 400);
                    }, 300);
                }, 200);
            }, 200);
        }, 300);
    }

})();
