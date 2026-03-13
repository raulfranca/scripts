// ==UserScript==
// @name         1Doc - Inbox (Credenciamento)
// @namespace    http://tampermonkey.net/
// @version      0.4.0
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
        DIVIDIR:    '1doc_cred_dividir',
        CHIP_CICLO: '1doc_cred_chip_ciclo',
    };

    let protocoloWin    = null;
    let dividirTela     = localStorage.getItem(LS.DIVIDIR) !== 'false';    // padrão true
    let mostrarChipCiclo = localStorage.getItem(LS.CHIP_CICLO) !== 'false'; // padrão true

    // 2. ESTILOS CSS
    GM_addStyle(`
        #modal-cred-inbox .cred-control-row {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 0; border-bottom: 1px solid #eee;
        }
        #modal-cred-inbox .cred-control-row:last-child { border-bottom: none; }
        #modal-cred-inbox label { margin: 0; font-weight: normal; cursor: pointer; }
        body.cred-hide-chips .cred-chip-ciclo { display: none !important; }
    `);

    // 3. CHIP VISUAL DE CICLO
    const CICLO_CORES = [
        '#B5EAD7', // Ciclo 01 — Menta
        '#C7CEEA', // Ciclo 02 — Lavanda
        '#FFDAC1', // Ciclo 03 — Pêssego
        '#FFB7B2', // Ciclo 04 — Salmão
        '#E2F0CB', // Ciclo 05 — Sálvia
        '#BFD7FF', // Ciclo 06 — Céu
        '#F0E6FF', // Ciclo 07 — Lilá
        '#FFF1BA', // Ciclo 08 — Manteiga
        '#FFD6E0', // Ciclo 09 — Blush
        '#C9F0FF', // Ciclo 10 — Aqua
    ];

    function injetarChipCiclo(tr, cicloNum) {
        const td = tr.querySelector('td[data-href]');
        if (!td) return;
        const idx = parseInt(cicloNum, 10) - 1;
        const cor = CICLO_CORES[idx] || '#eeeeee';
        const chip = document.createElement('span');
        chip.className = 'badge badge-inverse badge-text cred-chip-ciclo';
        chip.style.cssText = 'background-color:' + cor + '; color:#000000; margin-left:4px; vertical-align:middle;';
        chip.textContent = 'Ciclo ' + cicloNum;
        const br = td.querySelector('br');
        if (br) {
            br.parentNode.insertBefore(chip, br);
        } else {
            td.appendChild(chip);
        }
    }

    function atualizarVisibilidadeChips() {
        document.body.classList.toggle('cred-hide-chips', !mostrarChipCiclo);
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

        // Row 2: Chip de ciclo
        const row2 = document.createElement('div');
        row2.className = 'cred-control-row';
        const chkChip = document.createElement('input');
        chkChip.type = 'checkbox';
        chkChip.id = 'cred-chk-chip-ciclo';
        chkChip.checked = mostrarChipCiclo;
        const lblChip = document.createElement('label');
        lblChip.htmlFor = 'cred-chk-chip-ciclo';
        lblChip.textContent = 'Exibir chip de ciclo nas linhas';
        chkChip.addEventListener('change', function () {
            mostrarChipCiclo = this.checked;
            localStorage.setItem(LS.CHIP_CICLO, mostrarChipCiclo);
            atualizarVisibilidadeChips();
        });
        row2.appendChild(chkChip);
        row2.appendChild(lblChip);
        body.appendChild(row2);
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

    // 5. VERIFICAÇÃO DE CICLO DO PROTOCOLO
    const CICLOS = [
        { num: '01', inicio: new Date(2026,  1, 25), fim: new Date(2026,  2, 11) },
        { num: '02', inicio: new Date(2026,  2, 12), fim: new Date(2026,  2, 31) },
        { num: '03', inicio: new Date(2026,  3,  1), fim: new Date(2026,  3, 30) },
        { num: '04', inicio: new Date(2026,  4,  1), fim: new Date(2026,  4, 31) },
        { num: '05', inicio: new Date(2026,  5,  1), fim: new Date(2026,  5, 30) },
        { num: '06', inicio: new Date(2026,  6,  1), fim: new Date(2026,  6, 31) },
        { num: '07', inicio: new Date(2026,  7,  1), fim: new Date(2026,  7, 31) },
        { num: '08', inicio: new Date(2026,  8,  1), fim: new Date(2026,  8, 30) },
        { num: '09', inicio: new Date(2026,  9,  1), fim: new Date(2026,  9, 31) },
        { num: '10', inicio: new Date(2026, 10,  1), fim: new Date(2026, 10, 30) },
    ];

    const CICLOS_ANALISE = [
        { num: '01', inicio: new Date(2026,  2, 12), fim: new Date(2026,  2, 18) },
        { num: '02', inicio: new Date(2026,  3,  1), fim: new Date(2026,  3, 10) },
        { num: '03', inicio: new Date(2026,  4,  4), fim: new Date(2026,  4,  8) },
        { num: '04', inicio: new Date(2026,  5,  1), fim: new Date(2026,  5, 10) },
        { num: '05', inicio: new Date(2026,  6,  1), fim: new Date(2026,  6,  7) },
        { num: '06', inicio: new Date(2026,  7,  3), fim: new Date(2026,  7, 10) },
        { num: '07', inicio: new Date(2026,  8,  1), fim: new Date(2026,  8,  9) },
        { num: '08', inicio: new Date(2026,  9,  1), fim: new Date(2026,  9,  9) },
        { num: '09', inicio: new Date(2026, 10,  2), fim: new Date(2026, 10, 10) },
        { num: '10', inicio: new Date(2026, 11,  1), fim: new Date(2026, 11,  8) },
    ];

    /**
     * Recebe a string de data da linha do inbox (ex: "12/03/2026 14:49",
     * de <small class="data">). Retorna { cicloProtocolo, cicloAnalise } se o
     * protocolo pertence a um ciclo de inscrição diferente do ciclo de análise
     * em curso; null caso contrário (fora de período, mesmo ciclo ou data inválida).
     */
    function verificarCicloProtocolo(dataStr) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let cicloAnalise = null;
        for (var i = 0; i < CICLOS_ANALISE.length; i++) {
            if (hoje >= CICLOS_ANALISE[i].inicio && hoje <= CICLOS_ANALISE[i].fim) {
                cicloAnalise = CICLOS_ANALISE[i].num;
                break;
            }
        }
        if (!cicloAnalise) return null;

        if (!dataStr) return null;
        var partes = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!partes) return null;
        var dataParsed = new Date(parseInt(partes[3], 10), parseInt(partes[2], 10) - 1, parseInt(partes[1], 10));

        var cicloProtocolo = null;
        for (var j = 0; j < CICLOS.length; j++) {
            if (dataParsed >= CICLOS[j].inicio && dataParsed <= CICLOS[j].fim) {
                cicloProtocolo = CICLOS[j].num;
                break;
            }
        }
        if (!cicloProtocolo) return null;
        if (cicloProtocolo === cicloAnalise) return null;

        return { cicloProtocolo: cicloProtocolo, cicloAnalise: cicloAnalise };
    }

    /**
     * Exibe um modal Bootstrap 2 bloqueante (#modal-cred-ciclo-errado) informando
     * que o protocolo pertence a um ciclo diferente do ciclo de análise atual.
     * Criado uma única vez; listeners dos botões são renovados a cada exibição.
     *
     * onContinuar: callback executado se o usuário clicar "Abrir mesmo assim".
     */
    function mostrarDialogCicloErrado(cicloProtocolo, cicloAnalise, dataStr, onContinuar) {
        const MODAL_ID = 'modal-cred-ciclo-errado';
        const dataFormatada = dataStr ? dataStr.substring(0, 10) : '\u2014';

        if (!document.getElementById(MODAL_ID)) {
            const modal = document.createElement('div');
            modal.className = 'modal hide fade';
            modal.id = MODAL_ID;
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('data-backdrop', 'static');
            modal.setAttribute('data-keyboard', 'false');
            modal.innerHTML =
                '<div class="modal-header" style="background:#a94442; color:#fff; padding:9px 15px;">' +
                    '<h4 style="margin:0; font-size:14px; font-weight:600;">\u26a0 Protocolo fora do ciclo atual</h4>' +
                '</div>' +
                '<div class="modal-body" id="' + MODAL_ID + '-body" style="padding:15px 20px; font-size:13px; line-height:1.6;"></div>' +
                '<div class="modal-footer">' +
                    '<button class="btn" id="' + MODAL_ID + '-cancelar">Cancelar</button>' +
                    '<button class="btn btn-warning" id="' + MODAL_ID + '-continuar">Abrir mesmo assim</button>' +
                '</div>';
            document.body.appendChild(modal);
        }

        document.getElementById(MODAL_ID + '-body').innerHTML =
            'Este protocolo foi enviado em <strong>' + dataFormatada + '</strong> e pertence ao <strong>Ciclo ' + cicloProtocolo + '</strong>.<br><br>' +
            'A equipe est\u00e1 atualmente analisando o <strong>Ciclo ' + cicloAnalise + '</strong>.<br><br>' +
            'Este protocolo dever\u00e1 ser analisado apenas no per\u00edodo de an\u00e1lise do Ciclo ' + cicloProtocolo + '.';

        // Renovar listeners trocando os botões por clones (sem listeners antigos)
        ['cancelar', 'continuar'].forEach(function (sufixo) {
            const old = document.getElementById(MODAL_ID + '-' + sufixo);
            const clone = old.cloneNode(true);
            old.parentNode.replaceChild(clone, old);
        });

        function fecharModal() {
            const s = document.createElement('script');
            s.textContent = "jQuery('#" + MODAL_ID + "').modal('hide');";
            document.body.appendChild(s);
            s.remove();
        }

        document.getElementById(MODAL_ID + '-cancelar').addEventListener('click', fecharModal);
        document.getElementById(MODAL_ID + '-continuar').addEventListener('click', function () {
            fecharModal();
            onContinuar();
        });

        const s = document.createElement('script');
        s.textContent = "jQuery('#" + MODAL_ID + "').modal('show');";
        document.body.appendChild(s);
        s.remove();
    }

    // 6. BOTÃO NO INBOX
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

    // 7. INTERCEPTAÇÃO DE CLIQUES NAS LINHAS
    function abrirProtocolo(urlAbsoluta) {
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
    }

    function processarLinhas() {
        document.querySelectorAll('tr[id^="linha_"]:not([data-cred-inbox-ok])').forEach(function (tr) {
            tr.dataset.credInboxOk = '1';
            const dataElChip = tr.querySelector('small.data');
            const dataStrChip = dataElChip ? dataElChip.textContent.trim() : null;
            const mismatchChip = verificarCicloProtocolo(dataStrChip);
            if (mismatchChip) {
                injetarChipCiclo(tr, mismatchChip.cicloProtocolo);
            }
            tr.addEventListener('click', function (e) {
                const td = e.target.closest('td[data-href]');
                if (!td) return;
                e.preventDefault();
                e.stopPropagation();
                const urlAbsoluta = new URL(td.dataset.href, location.origin).href;

                const dataEl = tr.querySelector('small.data');
                const dataStr = dataEl ? dataEl.textContent.trim() : null;
                const cicloMismatch = verificarCicloProtocolo(dataStr);
                if (cicloMismatch) {
                    mostrarDialogCicloErrado(
                        cicloMismatch.cicloProtocolo,
                        cicloMismatch.cicloAnalise,
                        dataStr,
                        function () { abrirProtocolo(urlAbsoluta); }
                    );
                    return;
                }

                abrirProtocolo(urlAbsoluta);
            });
        });
    }

    // 8. OBSERVAÇÃO E INICIALIZAÇÃO
    const observer = new MutationObserver(function () {
        injetarBotao();
        processarLinhas();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    injetarBotao();
    processarLinhas();
    atualizarVisibilidadeChips();
})();
