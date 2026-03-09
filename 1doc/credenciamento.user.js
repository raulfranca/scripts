// ==UserScript==
// @name         1Doc - Credenciamento de Professores
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Painel de conferência de credenciamento: extrai dados, aplica marcador e copia para planilha.
// @author       Raul Cabral
// @match        https://*.1doc.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=1doc.com.br
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. CONFIGURAÇÕES E ESTADOS
    // ==========================================
    const EQUIPE = ['Renata', 'Catarina', 'Alessandra'];
    let ultimaUrl = location.href;
    let jaRodouNestaPagina = false;

    // Preferências persistidas (por usuário)
    let credenciadoraSalva = localStorage.getItem('1doc_cred_nome') || EQUIPE[0];
    let autoAbrir   = localStorage.getItem('1doc_cred_auto')     === 'true';
    let autoMarcador = localStorage.getItem('1doc_cred_marcador') !== 'false'; // default: true

    // Estado por candidato (resetado a cada protocolo)
    let dadosExtraidos = null;   // { protocolo, url, candidato, dataEnvio }
    let funcaoSelecionada = null; // string | null
    let regioesSelecionadas = []; // number[]
    let cpfDigitos = '';          // apenas os dígitos do CPF

    // ==========================================
    // 2. ESTILOS CSS
    // ==========================================
    GM_addStyle(`
        /* =============================================
           CREDENCIAMENTO — UI nativa 1Doc
           Bootstrap 2 + Open Sans + paleta verde
           ============================================= */

        /* Overlay (backdrop do modal — padrão Bootstrap 2) */
        #cred-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 1040;
            display: none; align-items: center; justify-content: center;
        }
        #cred-overlay.active { display: flex; }

        /* ── Modal container (Bootstrap 2 .modal) ── */
        #cred-dialog {
            background: #fff;
            width: min(900px, 95vw);
            max-height: 90vh;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.3);
            border-radius: 6px;
            box-shadow: 0 3px 7px rgba(0,0,0,0.3);
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #333;
            z-index: 1050;
            display: flex;
            flex-direction: column;
        }

        /* ── Modal Header (verde 1Doc — .modal-header override) ── */
        .cred-header {
            background-color: #005400;
            color: #fff;
            padding: 9px 15px;
            display: flex;
            flex-direction: column;
            gap: 0;
            flex-shrink: 0;
            border-bottom: 1px solid #004400;
            border-radius: 6px 6px 0 0;
        }
        .cred-header-row1 {
            display: flex; align-items: center; gap: 12px;
        }
        .cred-header-row2 {
            display: flex; gap: 20px; align-items: center;
            border-top: 1px solid rgba(255,255,255,0.12);
            margin-top: 7px; padding-top: 7px;
        }
        .cred-header-title {
            font-size: 14px; font-weight: 600; white-space: nowrap;
            line-height: 20px;
        }
        .cred-credenciadora-group {
            display: flex; gap: 5px; justify-content: center;
            flex-wrap: wrap; margin-left: auto;
        }
        .cred-opt-btn {
            padding: 3px 10px; border: 1px solid rgba(255,255,255,0.35); border-radius: 4px;
            background: rgba(255,255,255,0.12); cursor: pointer; font-size: 12px;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            color: rgba(255,255,255,0.85); transition: background 0.15s; line-height: 18px;
        }
        .cred-opt-btn:hover { background: rgba(255,255,255,0.25); color: #fff; }
        .cred-opt-btn.active {
            background: #fff; color: #005400; font-weight: 700;
            border-color: #fff;
        }
        .cred-close {
            cursor: pointer; font-size: 20px; color: #fff; opacity: 0.7;
            border: none; background: transparent; line-height: 1;
            font-weight: 200; margin-left: 8px; padding: 0;
        }
        .cred-close:hover { opacity: 1; }
        /* Checkboxes no header */
        .cred-header-toggle {
            display: flex; align-items: center; gap: 5px;
            font-size: 12px; color: rgba(255,255,255,0.85); cursor: pointer;
            user-select: none;
        }
        .cred-header-toggle input { cursor: pointer; accent-color: #fff; }

        /* ── Bloco de identificação (well verde claro) ── */
        .cred-info-block {
            background: rgba(0, 102, 0, 0.08);
            border-bottom: 1px solid rgba(0, 102, 0, 0.2);
            padding: 10px 15px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex-shrink: 0;
        }
        .cred-info-row { display: flex; gap: 30px; flex-wrap: wrap; }
        .cred-info-item { display: flex; flex-direction: column; min-width: 0; }
        .cred-info-label {
            font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
            color: #408d40; font-weight: 700; margin-bottom: 1px;
        }
        .cred-info-value { font-size: 14px; font-weight: 700; color: #333; line-height: 1.4; }
        .cred-nome-value { font-size: 16px; }

        /* ── Corpo do formulário (.modal-body) ── */
        .cred-body {
            padding: 15px;
            flex: 1;
            overflow-y: auto;
            max-height: calc(90vh - 200px);
        }

        .cred-section { margin-bottom: 15px; }
        .cred-section-label {
            display: block; font-size: 13px; font-weight: 700;
            color: #333; margin-bottom: 6px;
        }
        .cred-btn-group { display: flex; gap: 6px; flex-wrap: wrap; }

        /* CPF — input padrão Bootstrap 2 */
        .cred-cpf-input {
            width: 180px; padding: 4px 6px; font-size: 14px;
            border: 1px solid #ccc; border-radius: 4px;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            color: #555; line-height: 20px;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cred-cpf-input:focus {
            border-color: #006600; outline: none;
            box-shadow: 0 0 0 2px rgba(0,102,0,0.2);
        }

        /* Nome do candidato — input editável (largura total) */
        .cred-nome-input {
            width: 100%; padding: 4px 6px; font-size: 14px; font-weight: 600;
            border: 1px solid #ccc; border-radius: 4px;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            color: #333; line-height: 20px; box-sizing: border-box;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cred-nome-input:focus {
            border-color: #006600; outline: none;
            box-shadow: 0 0 0 2px rgba(0,102,0,0.2);
        }

        /* ── Botões de Função (seleção única) ── */
        .cred-funcao-btn {
            padding: 6px 16px; border-radius: 4px; border: 2px solid transparent;
            cursor: pointer; font-size: 13px; font-weight: 700;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            opacity: 0.35; transition: opacity 0.15s, transform 0.1s;
        }
        .cred-funcao-btn:hover { opacity: 0.65; }
        .cred-funcao-btn.active { opacity: 1; transform: scale(1.04); }
        .cred-funcao-basica { background: #006600; color: #fff; border-color: #005400; }
        .cred-funcao-fisica { background: #c0392b; color: #fff; border-color: #a93226; }
        .cred-funcao-artes  { background: #e67e22; color: #fff; border-color: #ca6f1e; }

        /* ── Botões de Região (múltipla seleção) ── */
        .cred-regiao-btn {
            padding: 6px 14px; border-radius: 4px; border: 2px solid transparent;
            cursor: pointer; font-size: 12px; font-weight: 700;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            opacity: 0.35; transition: opacity 0.15s, transform 0.1s;
        }
        .cred-regiao-btn:hover { opacity: 0.65; }
        .cred-regiao-btn.active { opacity: 1; transform: scale(1.04); }
        .cred-regiao-centro  { background: #f1c40f; color: #5d4e00; border-color: #d4ac0d; }
        .cred-regiao-oeste   { background: #006600; color: #fff;    border-color: #005400; }
        .cred-regiao-leste   { background: #e74c3c; color: #fff;    border-color: #c0392b; }
        .cred-regiao-moreira { background: #27ae60; color: #fff;    border-color: #1e8449; }
        .cred-regiao-rural   { background: #8e44ad; color: #fff;    border-color: #7d3c98; }

        /* Aviso — Bootstrap 2 .alert .alert-block */
        .cred-warning {
            background-color: #fcf8e3; color: #c09853;
            border: 1px solid #fbeed5; border-radius: 4px;
            padding: 8px 14px; font-size: 13px; margin-top: 4px;
        }

        /* ── Footer (.modal-footer) ── */
        .cred-footer {
            padding: 10px 15px;
            border-top: 1px solid #ddd;
            background: #f5f5f5;
            flex-shrink: 0;
            border-radius: 0 0 6px 6px;
        }
        .cred-btn-action {
            width: 100%; padding: 8px 12px;
            background-color: #006600; color: #fff;
            border: none; border-radius: 4px; font-size: 14px; cursor: pointer;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            font-weight: 600; transition: background-color 0.15s;
            line-height: 20px;
        }
        .cred-btn-action:hover { background-color: #004d00; }
        .cred-btn-action:disabled { background-color: #999; cursor: not-allowed; opacity: 0.65; }
    `);

    // ==========================================
    // 3. CONSTRUÇÃO DA INTERFACE DO DIALOG
    // ==========================================
    function criarDialog() {
        if (document.getElementById('cred-overlay')) return;

        const optionsHtml = EQUIPE.map(nome =>
            `<button class="cred-opt-btn${nome === credenciadoraSalva ? ' active' : ''}" data-nome="${nome}">${nome}</button>`
        ).join('');

        const html = `
            <div id="cred-overlay">
                <div id="cred-dialog">

                    <div class="cred-header">
                        <div class="cred-header-row1">
                            <span class="cred-header-title">📋 Credenciamento</span>
                            <div class="cred-credenciadora-group">${optionsHtml}</div>
                            <button class="cred-close" id="cred-btn-close">✖</button>
                        </div>
                        <div class="cred-header-row2">
                            <label class="cred-header-toggle">
                                <input type="checkbox" id="cred-auto-abrir" ${autoAbrir ? 'checked' : ''}>
                                Abrir automaticamente nos protocolos
                            </label>
                            <label class="cred-header-toggle">
                                <input type="checkbox" id="cred-auto-marcador" ${autoMarcador ? 'checked' : ''}>
                                Aplicar marcador automaticamente
                            </label>
                        </div>
                    </div>

                    <div class="cred-info-block">
                        <div class="cred-info-row">
                            <div class="cred-info-item">
                                <span class="cred-info-label">Protocolo</span>
                                <span id="cred-res-prot" class="cred-info-value">—</span>
                            </div>
                            <div class="cred-info-item">
                                <span class="cred-info-label">Data / Hora</span>
                                <span id="cred-res-data" class="cred-info-value">—</span>
                            </div>
                        </div>
                    </div>

                    <div class="cred-body">

                        <div class="cred-section">
                            <label class="cred-section-label" for="cred-nome-input">Nome do candidato</label>
                            <input type="text" id="cred-nome-input" class="cred-nome-input"
                                   placeholder="Nome completo do candidato">
                            <div class="cred-warning" style="margin-top: 6px;">
                                ⚠️ <strong>Atenção:</strong> O nome extraído é de quem enviou o protocolo. Corrija se o candidato for outra pessoa.
                            </div>
                        </div>
                        <div class="cred-section">
                            <label class="cred-section-label" for="cred-cpf">CPF</label>
                            <input type="text" id="cred-cpf" class="cred-cpf-input"
                                   placeholder="000.000.000-00" maxlength="14" inputmode="numeric">
                        </div>

                        <div class="cred-section">
                            <label class="cred-section-label">Função pretendida</label>
                            <div class="cred-btn-group">
                                <button class="cred-funcao-btn cred-funcao-basica" data-funcao="Ed. Básica">Educação Básica</button>
                                <button class="cred-funcao-btn cred-funcao-fisica" data-funcao="Ed. Física">Educação Física</button>
                                <button class="cred-funcao-btn cred-funcao-artes"  data-funcao="Artes">Artes</button>
                            </div>
                        </div>

                        <div class="cred-section">
                            <label class="cred-section-label">Regiões Escolares</label>
                            <div class="cred-btn-group">
                                <button class="cred-regiao-btn cred-regiao-centro"  data-regiao="1">1 – Centro</button>
                                <button class="cred-regiao-btn cred-regiao-oeste"   data-regiao="2">2 – Zona Oeste</button>
                                <button class="cred-regiao-btn cred-regiao-leste"   data-regiao="3">3 – Zona Leste</button>
                                <button class="cred-regiao-btn cred-regiao-moreira" data-regiao="4">4 – Moreira César</button>
                                <button class="cred-regiao-btn cred-regiao-rural"   data-regiao="5">5 – Zona Rural</button>
                            </div>
                        </div>

                    </div>

                    <div class="cred-footer">
                        <button id="cred-btn-executar" class="cred-btn-action" disabled>Processando...</button>
                    </div>

                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Fechar
        document.getElementById('cred-btn-close').addEventListener('click', fecharDialog);

        // Credenciadora (seleção única, persistida)
        document.querySelectorAll('.cred-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cred-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                credenciadoraSalva = btn.dataset.nome;
                localStorage.setItem('1doc_cred_nome', credenciadoraSalva);
                if (isPaginaProtocolo() && autoMarcador) trocarMarcador(credenciadoraSalva);
                setTimeout(() => {
                    const btnEx = document.getElementById('cred-btn-executar');
                    if (btnEx && !btnEx.disabled) btnEx.focus();
                }, 50);
            });
        });

        // CPF — máscara progressiva (armazena só dígitos em cpfDigitos)
        document.getElementById('cred-cpf').addEventListener('input', (e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let fmt = digits;
            if (digits.length > 9)      fmt = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9);
            else if (digits.length > 6) fmt = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6);
            else if (digits.length > 3) fmt = digits.slice(0,3)+'.'+digits.slice(3);
            e.target.value = fmt;
            cpfDigitos = digits;
        });

        // Função (seleção única)
        document.querySelectorAll('.cred-funcao-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cred-funcao-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                funcaoSelecionada = btn.dataset.funcao;
            });
        });

        // Regiões (múltipla seleção — toggle)
        document.querySelectorAll('.cred-regiao-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const r = parseInt(btn.dataset.regiao);
                if (btn.classList.contains('active')) {
                    if (!regioesSelecionadas.includes(r)) regioesSelecionadas.push(r);
                } else {
                    regioesSelecionadas = regioesSelecionadas.filter(x => x !== r);
                }
            });
        });

        // Auto-abrir
        document.getElementById('cred-auto-abrir').addEventListener('change', (e) => {
            autoAbrir = e.target.checked;
            localStorage.setItem('1doc_cred_auto', autoAbrir);
        });

        // Auto-marcador
        document.getElementById('cred-auto-marcador').addEventListener('change', (e) => {
            autoMarcador = e.target.checked;
            localStorage.setItem('1doc_cred_marcador', autoMarcador);
        });

        // Botão principal
        document.getElementById('cred-btn-executar').addEventListener('click', copiarEFechar);
    }

    function abrirDialog() {
        criarDialog();

        // Reset de estado por candidato
        funcaoSelecionada = null;
        regioesSelecionadas = [];
        cpfDigitos = '';
        document.getElementById('cred-cpf').value = '';
        document.getElementById('cred-nome-input').value = '';
        document.querySelectorAll('.cred-funcao-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.cred-regiao-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('cred-res-prot').innerText = '—';
        document.getElementById('cred-res-data').innerText = '—';

        document.getElementById('cred-overlay').classList.add('active');
        if (isPaginaProtocolo()) executarFluxo();
    }

    function fecharDialog() {
        const overlay = document.getElementById('cred-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ==========================================
    // 4. LÓGICA DE EXTRAÇÃO E CÓPIA
    // ==========================================
    function isPaginaProtocolo() {
        return location.href.includes('pg=doc/ver');
    }

    function extrairNomeCandidato() {
        const spans = document.querySelectorAll('span.pp');
        for (let span of spans) {
            const dataContent = span.getAttribute('data-content');
            if (dataContent && dataContent.trim() !== '') return dataContent.trim();

            const imgGov = span.querySelector('img[src*="icon_verify"]');
            if (imgGov) {
                let clone = span.cloneNode(true);
                clone.querySelectorAll('img').forEach(img => img.remove());
                return clone.textContent.replace(/[\n\r]+/g, '').replace(/\s+/g, ' ').trim();
            }
        }
        return 'Nome não encontrado. Preencha manualmente.';
    }

    // Seletor confirmado no DOM real: .well.well-header .row-fluid.horario > .span12 > span
    function extrairDataEnvio() {
        const el = document.querySelector('.well.well-header .row-fluid.horario > .span12 > span');
        return el ? el.textContent.trim() : '';
    }

    // Extrai dados e aplica marcador — chamado automaticamente ao abrir o dialog.
    async function executarFluxo() {
        const btnExecutar = document.getElementById('cred-btn-executar');
        btnExecutar.disabled = true;
        btnExecutar.innerText = 'Processando...';

        try {
            const numEl = document.querySelector('.nd_num');
            if (!numEl) throw new Error('Número do protocolo não encontrado.');

            const protocolo = numEl.innerText.trim();
            const url = window.location.href;
            const candidato = extrairNomeCandidato();
            const dataEnvio = extrairDataEnvio();

            if (autoMarcador) trocarMarcador(credenciadoraSalva);

            dadosExtraidos = { protocolo, url, candidato, dataEnvio };

            document.getElementById('cred-res-prot').innerText = protocolo;
            document.getElementById('cred-res-data').innerText = dataEnvio || '(não encontrada)';
            document.getElementById('cred-nome-input').value = candidato;

            btnExecutar.innerText = 'Copiar';
            btnExecutar.disabled = false;
            btnExecutar.focus();

        } catch (error) {
            console.error('Erro no script de Credenciamento:', error);
            alert('Erro ao extrair dados. Certifique-se de que a página carregou completamente.');
            dadosExtraidos = null;
            btnExecutar.innerText = 'Tentar Novamente';
            btnExecutar.disabled = false;
            btnExecutar.focus();
        }
    }

    // Copia os dados para o clipboard e fecha o dialog.
    // O usuário deverá colar manualmente na planilha (Ctrl+V).
    async function copiarEFechar() {
        if (!dadosExtraidos) {
            await executarFluxo();
            return;
        }

        const btnExecutar = document.getElementById('cred-btn-executar');
        btnExecutar.disabled = true;

        try {
            const candidatoFinal = document.getElementById('cred-nome-input').value.trim() || dadosExtraidos.candidato;
            await copiarParaPlanilha(
                credenciadoraSalva,
                dadosExtraidos.dataEnvio,
                dadosExtraidos.protocolo,
                dadosExtraidos.url,
                candidatoFinal
            );
            fecharDialog();
        } catch (error) {
            console.error('Erro ao copiar dados:', error);
            alert('Erro ao copiar dados para a área de transferência.');
            btnExecutar.disabled = false;
            btnExecutar.focus();
        }
    }

    // Colunas: A=credenciadora, B=dataEnvio, C=protocolo (link), D=candidato
    async function copiarParaPlanilha(credenciadora, dataEnvio, protocolo, url, candidato) {
        const htmlData = `<table><tr><td>${credenciadora}</td><td>${dataEnvio}</td><td><a href="${url}">${protocolo}</a></td><td>${candidato}</td></tr></table>`;
        const textData = `${credenciadora}\t${dataEnvio}\t${protocolo}\t${candidato}`;

        const blobHtml = new Blob([htmlData], { type: 'text/html' });
        const blobText = new Blob([textData], { type: 'text/plain' });

        await navigator.clipboard.write([new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
        })]);
    }

    // Troca o marcador via jQuery nativo da página (ver doc seção 5.3)
    function trocarMarcador(novoNome) {
        const outrosNomes = EQUIPE.filter(n => n !== novoNome).map(n => n.toUpperCase());
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                    var selectObj = $('#marcadores_ids');
                    var outrosNomes = ${JSON.stringify(outrosNomes)};
                    var novoNome = ${JSON.stringify(novoNome.toUpperCase())};

                    var valuesToRemove = [];
                    selectObj.find('option').each(function() {
                        var textoOpcao = $(this).text().toUpperCase();
                        for (var i = 0; i < outrosNomes.length; i++) {
                            if (textoOpcao.indexOf(outrosNomes[i]) > -1) {
                                valuesToRemove.push($(this).attr('value'));
                                break;
                            }
                        }
                    });

                    var newValues = (selectObj.val() || []).filter(function(v) {
                        return valuesToRemove.indexOf(v) === -1;
                    });

                    var targetOption = selectObj.find('option').filter(function() {
                        return $(this).text().toUpperCase().indexOf(novoNome) > -1;
                    });
                    if (targetOption.length > 0) {
                        var tagValue = targetOption.attr('value');
                        if (newValues.indexOf(tagValue) === -1) newValues.push(tagValue);
                    }

                    selectObj.val(newValues).trigger('change');
                }
            })();
        `;
        document.body.appendChild(script);
        script.remove();
    }

    // ==========================================
    // 5. INJEÇÃO DO BOTÃO NA UI DO 1DOC
    // ==========================================
    function injetarBotao() {
        if (!isPaginaProtocolo()) return;
        if (document.getElementById('btn-credenciamento')) return;

        const targetDiv = document.querySelector('.btn-group-tags');
        if (targetDiv) {
            const btnHtml = `
                <a id="btn-credenciamento" class="btn btn-mini btn-info" title="Abrir Painel de Credenciamento">
                    <i class="icon-white icon-check"></i> Credenciamento
                </a>
            `;
            targetDiv.insertAdjacentHTML('afterbegin', btnHtml);
            document.getElementById('btn-credenciamento').addEventListener('click', (e) => {
                e.preventDefault();
                abrirDialog();
            });
        }
    }

    // ==========================================
    // 6. OBSERVAÇÃO E INICIALIZAÇÃO
    // ==========================================
    const observerUI = new MutationObserver(() => { injetarBotao(); });
    observerUI.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        if (location.href !== ultimaUrl) {
            ultimaUrl = location.href;
            jaRodouNestaPagina = false;
            dadosExtraidos = null;
            funcaoSelecionada = null;
            regioesSelecionadas = [];
            cpfDigitos = '';
            fecharDialog();
        }

        if (isPaginaProtocolo() && autoAbrir && !jaRodouNestaPagina) {
            if (document.querySelector('.nd_num') && document.querySelector('span.pp')) {
                jaRodouNestaPagina = true;
                setTimeout(abrirDialog, 1000);
            }
        }
    }, 500);

})();
