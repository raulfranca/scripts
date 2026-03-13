// ==UserScript==
// @name         1Doc - Inbox (Credenciamento)
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  Painel de controle e abertura de protocolos em janela controlada para divisão de tela no credenciamento.
// @author       Raul Cabral
// @match        https://pindamonhangaba.1doc.com.br/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/inbox.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/inbox.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (!location.href.includes('pg=painel/listar')) return;

    // 1. CONFIGURAÇÕES E ESTADOS
    const LS = {
        DIVIDIR:       '1doc_cred_dividir',
        FILTRO_CRED:   '1doc_cred_filtro_credenciadoras',
        FILTRO_CICLO:  '1doc_cred_filtro_ciclo',
    };
    const CREDENCIADORAS = ['renata', 'catarina', 'alessandra'];

    let protocoloWin         = null;
    let dividirTela          = localStorage.getItem(LS.DIVIDIR) !== 'false'; // padrão true
    let filtroCredenciadoras = localStorage.getItem(LS.FILTRO_CRED) === 'true'; // padrão false
    let filtroCiclo          = localStorage.getItem(LS.FILTRO_CICLO) || '';     // padrão ''

    // 2. ESTILOS CSS
    GM_addStyle(`
        #modal-cred-inbox .cred-control-row {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 0; border-bottom: 1px solid #eee;
        }
        #modal-cred-inbox .cred-control-row:last-child { border-bottom: none; }
        #modal-cred-inbox label { margin: 0; font-weight: normal; cursor: pointer; }
        #modal-cred-inbox select { margin: 0; }
    `);

    // 3. FILTROS
    function textoDosBadges(tr) {
        return Array.from(tr.querySelectorAll('span.badge')).map(function (span) {
            return Array.from(span.childNodes)
                .filter(function (n) { return n.nodeType === 3; })
                .map(function (n) { return n.textContent; })
                .join('')
                .trim();
        });
    }

    function aplicarFiltros() {
        document.querySelectorAll('tr[id^="linha_"]').forEach(function (tr) {
            let ocultar = false;

            if (filtroCredenciadoras) {
                const textos = textoDosBadges(tr);
                if (textos.some(function (t) { return CREDENCIADORAS.includes(t.toLowerCase()); })) {
                    ocultar = true;
                }
            }

            if (!ocultar && filtroCiclo) {
                const textos = textoDosBadges(tr);
                const badgesDeCiclo = textos.filter(function (t) { return /Ciclo\/\d{2}/i.test(t); });
                if (badgesDeCiclo.length > 0) {
                    const temCicloCorreto = badgesDeCiclo.some(function (t) {
                        const m = t.match(/Ciclo\/(\d{2})/i);
                        return m && m[1] === filtroCiclo;
                    });
                    if (!temCicloCorreto) ocultar = true;
                }
                // linhas sem badge de ciclo permanecem visíveis (candidatos não iniciados)
            }

            tr.style.display = ocultar ? 'none' : '';
        });
    }

    // 4. MODAL DE CONTROLE
    function renderizarPainelInbox(body) {
        body.innerHTML = '';

        // Row 1: Dividir tela
        const row1 = document.createElement('div');
        row1.className = 'cred-control-row';
        const chkDividir = document.createElement('input');
        chkDividir.type = 'checkbox';
        chkDividir.id = 'cred-chk-dividir';
        chkDividir.checked = dividirTela;
        const lblDividir = document.createElement('label');
        lblDividir.htmlFor = 'cred-chk-dividir';
        lblDividir.textContent = 'Dividir tela ao abrir protocolo';
        chkDividir.addEventListener('change', function () {
            dividirTela = this.checked;
            localStorage.setItem(LS.DIVIDIR, dividirTela);
        });
        row1.appendChild(chkDividir);
        row1.appendChild(lblDividir);
        body.appendChild(row1);

        // Row 2: Filtro credenciadoras
        const row2 = document.createElement('div');
        row2.className = 'cred-control-row';
        const chkCred = document.createElement('input');
        chkCred.type = 'checkbox';
        chkCred.id = 'cred-chk-filtro-cred';
        chkCred.checked = filtroCredenciadoras;
        const lblCred = document.createElement('label');
        lblCred.htmlFor = 'cred-chk-filtro-cred';
        lblCred.textContent = 'Ocultar protocolos com credenciadora atribuída';
        chkCred.addEventListener('change', function () {
            filtroCredenciadoras = this.checked;
            localStorage.setItem(LS.FILTRO_CRED, filtroCredenciadoras);
            aplicarFiltros();
        });
        row2.appendChild(chkCred);
        row2.appendChild(lblCred);
        body.appendChild(row2);

        // Row 3: Filtro ciclo
        const row3 = document.createElement('div');
        row3.className = 'cred-control-row';
        const lblCiclo = document.createElement('label');
        lblCiclo.htmlFor = 'cred-sel-ciclo';
        lblCiclo.textContent = 'Ciclo:';
        const sel = document.createElement('select');
        sel.id = 'cred-sel-ciclo';
        [['', 'Mostrar todos os ciclos']].concat(
            Array.from({ length: 10 }, function (_, i) {
                const v = String(i + 1).padStart(2, '0');
                return [v, 'Ciclo ' + v];
            })
        ).forEach(function (par) {
            const opt = document.createElement('option');
            opt.value = par[0];
            opt.textContent = par[1];
            if (par[0] === filtroCiclo) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
            filtroCiclo = this.value;
            localStorage.setItem(LS.FILTRO_CICLO, filtroCiclo);
            aplicarFiltros();
        });
        row3.appendChild(lblCiclo);
        row3.appendChild(sel);
        body.appendChild(row3);
    }

    function criarModal() {
        if (document.getElementById('modal-cred-inbox')) return;
        const modal = document.createElement('div');
        modal.className = 'modal hide fade';
        modal.id = 'modal-cred-inbox';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML =
            '<div class="modal-header" style="background:#005400; color:#fff; padding: 9px 15px;">' +
                '<button type="button" class="close" data-dismiss="modal" style="color:#fff; opacity:0.8;">\u00d7</button>' +
                '<h4 style="margin:0; font-size:14px; font-weight:600;">Credenciamento \u2014 Painel de Controle</h4>' +
            '</div>' +
            '<div class="modal-body"></div>' +
            '<div class="modal-footer">' +
                '<button class="btn" data-dismiss="modal">Fechar</button>' +
            '</div>';
        document.body.appendChild(modal);
        renderizarPainelInbox(modal.querySelector('.modal-body'));
    }

    // 5. BOTÃO NO INBOX
    function injetarBotao() {
        const marcadorDiv = document.querySelector('div.span7 div.div-marcador-dropdown');
        if (!marcadorDiv) return;
        const container = marcadorDiv.parentElement;
        if (!container || container.dataset.credInboxInjetado) return;
        container.dataset.credInboxInjetado = 'true';
        criarModal();

        const wrapper = document.createElement('div');
        wrapper.className = 'btn-group pull-right';
        wrapper.style.marginRight = '5px';
        const btn = document.createElement('a');
        btn.id = 'btn-credenciamento-inbox';
        btn.className = 'btn btn-mini btn-info';
        btn.title = 'Painel de Controle \u2014 Credenciamento';
        btn.innerHTML = '<i class="icon-white icon-check"></i> Credenciamento';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            const s = document.createElement('script');
            s.textContent = "jQuery('#modal-cred-inbox').modal('show');";
            document.body.appendChild(s);
            s.remove();
        });
        wrapper.appendChild(btn);
        marcadorDiv.insertAdjacentElement('afterend', wrapper);
    }

    // 6. INTERCEPTAÇÃO DE CLIQUES NAS LINHAS
    function processarLinhas() {
        document.querySelectorAll('tr[id^="linha_"]:not([data-cred-inbox-ok])').forEach(function (tr) {
            tr.dataset.credInboxOk = '1';
            tr.addEventListener('click', function (e) {
                const td = e.target.closest('td[data-href]');
                if (!td) return;
                e.preventDefault();
                e.stopPropagation();
                const urlAbsoluta = new URL(td.dataset.href, location.origin).href;
                if (!dividirTela) {
                    window.location.href = urlAbsoluta;
                    return;
                }
                const sw = screen.availWidth, sh = screen.availHeight;
                const sl = screen.availLeft  ?? 0, st = screen.availTop ?? 0;
                const metade = Math.floor(sw / 2);
                if (protocoloWin && !protocoloWin.closed) {
                    protocoloWin.location.href = urlAbsoluta;
                    protocoloWin.focus();
                } else {
                    protocoloWin = window.open(
                        urlAbsoluta, 'cred-protocolo',
                        `width=${metade},height=${sh},left=${sl},top=${st}`
                    );
                }
            });
        });
    }

    // 7. OBSERVAÇÃO E INICIALIZAÇÃO
    const observer = new MutationObserver(function () {
        injetarBotao();
        processarLinhas();
        aplicarFiltros();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    injetarBotao();
    processarLinhas();
    aplicarFiltros();
})();
