// ==UserScript==
// @name         1Doc - Credenciamento de Professores
// @namespace    http://tampermonkey.net/
// @version      3.1.0
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
    // 2. ESTILOS CSS (mínimo — aproveita classes nativas do 1Doc)
    // ==========================================
    GM_addStyle(`
        /* Header verde injetado no modal nativo */
        .cred-header {
            background-color: #005400;
            color: #fff;
            padding: 9px 15px;
            display: flex;
            flex-direction: column;
            gap: 0;
            border-bottom: 1px solid #004400;
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
        /* Checkboxes no header */
        .cred-header-toggle {
            display: flex; align-items: center; gap: 5px;
            font-size: 12px; color: rgba(255,255,255,0.85); cursor: pointer;
            user-select: none;
        }
        .cred-header-toggle input { cursor: pointer; accent-color: #fff; }

        /* Bloco de identificação (well verde claro) */
        .cred-info-block {
            background: rgba(0, 102, 0, 0.08);
            border-bottom: 1px solid rgba(0, 102, 0, 0.2);
            padding: 10px 15px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cred-info-row { display: flex; gap: 30px; flex-wrap: wrap; }
        .cred-info-item { display: flex; flex-direction: column; min-width: 0; }
        .cred-info-label {
            font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
            color: #408d40; font-weight: 700; margin-bottom: 1px;
        }
        .cred-info-value { font-size: 14px; font-weight: 700; color: #333; line-height: 1.4; }

        /* Formulário dentro do modal */
        .cred-form-section { padding: 12px 15px; border-bottom: 1px solid #eee; }
        .cred-form-section:last-child { border-bottom: none; }
        .cred-section-label {
            display: block; font-size: 13px; font-weight: 700;
            color: #333; margin-bottom: 6px;
        }
        .cred-btn-group { display: flex; gap: 6px; flex-wrap: wrap; }

        /* CPF input */
        .cred-cpf-input {
            width: 180px; padding: 4px 6px; font-size: 14px;
            border: 1px solid #ccc; border-radius: 4px;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            color: #555; line-height: 20px;
        }
        .cred-cpf-input:focus {
            border-color: #006600; outline: none;
            box-shadow: 0 0 0 2px rgba(0,102,0,0.2);
        }

        /* Nome input */
        .cred-nome-input {
            width: 100%; padding: 4px 6px; font-size: 14px; font-weight: 600;
            border: 1px solid #ccc; border-radius: 4px;
            font-family: "Open Sans", Helvetica, Arial, sans-serif;
            color: #333; line-height: 20px; box-sizing: border-box;
        }
        .cred-nome-input:focus {
            border-color: #006600; outline: none;
            box-shadow: 0 0 0 2px rgba(0,102,0,0.2);
        }

        /* Botões de toggle (função e região) — mesmo estilo do botão "Revisar" nativo */
        .cred-toggle-btn {
            background-color: #555 !important;
            border-color: #444 !important;
            color: #fff !important;
            transition: background-color 0.15s, border-color 0.15s;
            margin-bottom: 3px;
        }
        .cred-toggle-btn:hover {
            background-color: #666 !important;
        }
        .cred-toggle-btn.active {
            background-color: #005400 !important;
            border-color: #004400 !important;
            color: #fff !important;
        }
        .cred-toggle-btn.active:hover {
            background-color: #006600 !important;
        }

        /* Botão Copiar no footer */
        #cred-btn-executar {
            margin-right: 5px;
        }

        /* Truncamento de nomes longos de arquivo nos "outros anexos" */
        .cred-truncate {
            display: inline-block;
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
        }

        /* Ocultar o header original quando injetado */
        #modal_aprovacao_anexos .cred-header-original-hidden { display: none; }
    `);

    // ==========================================
    // 3. INJEÇÃO DE CONTROLES NO MODAL NATIVO
    // ==========================================

    /**
     * Clica programaticamente no primeiro botão "Tabela" da página.
     * Retorna true se encontrou e clicou, false caso contrário.
     */
    function abrirModalTabela() {
        const btnTabela = document.querySelector('a.link_tabela_revisao_anexos');
        if (!btnTabela) return false;
        btnTabela.click();
        return true;
    }

    /**
     * Aguarda o modal #modal_aprovacao_anexos ficar visível e com conteúdo carregado,
     * então injeta os controles do credenciamento.
     */
    function aguardarModalEInjetar() {
        let tentativas = 0;
        const monitor = setInterval(() => {
            tentativas++;
            const modal = document.getElementById('modal_aprovacao_anexos');
            if (!modal) {
                if (tentativas > 50) clearInterval(monitor); // 5s timeout
                return;
            }

            // Modal visível? (Bootstrap 2 adiciona classe .in e display:block)
            const visivel = modal.classList.contains('in') || modal.style.display === 'block';
            if (!visivel) {
                if (tentativas > 50) clearInterval(monitor);
                return;
            }

            // Conteúdo carregado? Verifica se a tabela de documentos existe
            const tabela = modal.querySelector('.div_lista_aprovacao_anexos table');
            if (!tabela) {
                if (tentativas > 100) clearInterval(monitor); // 10s timeout para AJAX
                return;
            }

            clearInterval(monitor);
            injetarControlesNoModal(modal);
        }, 100);
    }

    /**
     * Injeta header, bloco de info, formulário e botão copiar no modal nativo.
     * Usa atributo data-cred-injetado como guard contra duplicação.
     */
    function injetarControlesNoModal(modal) {
        if (modal.getAttribute('data-cred-injetado') === 'true') {
            // Já injetado — apenas resetar estado e executar fluxo
            resetarEstadoCandidato();
            if (isPaginaProtocolo()) executarFluxo();
            return;
        }

        // Esconder header original
        const headerOriginal = modal.querySelector('.modal-header');
        if (headerOriginal) headerOriginal.classList.add('cred-header-original-hidden');

        // --- Construir header customizado ---
        const optionsHtml = EQUIPE.map(nome =>
            `<button class="cred-opt-btn${nome === credenciadoraSalva ? ' active' : ''}" data-nome="${nome}">${nome}</button>`
        ).join('');

        const credHeader = document.createElement('div');
        credHeader.className = 'cred-header';
        credHeader.innerHTML = `
            <div class="cred-header-row1">
                <span class="cred-header-title">Credenciamento</span>
                <div class="cred-credenciadora-group">${optionsHtml}</div>
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
        `;

        // Inserir header customizado no topo do modal (antes do header original oculto)
        modal.insertBefore(credHeader, modal.firstChild);

        // --- Bloco de identificação ---
        const infoBlock = document.createElement('div');
        infoBlock.className = 'cred-info-block';
        infoBlock.innerHTML = `
            <div class="cred-info-row">
                <div class="cred-info-item">
                    <span class="cred-info-label">Protocolo</span>
                    <span id="cred-res-prot" class="cred-info-value">&mdash;</span>
                </div>
                <div class="cred-info-item">
                    <span class="cred-info-label">Data / Hora</span>
                    <span id="cred-res-data" class="cred-info-value">&mdash;</span>
                </div>
            </div>
        `;

        // Inserir após o header customizado
        credHeader.insertAdjacentElement('afterend', infoBlock);

        // --- Formulário do credenciamento (antes da tabela de documentos) ---
        const modalBody = modal.querySelector('.modal-body');
        const formContainer = document.createElement('div');
        formContainer.id = 'cred-form-container';
        formContainer.innerHTML = `
            <div class="cred-form-section">
                <label class="cred-section-label" for="cred-nome-input">Nome do candidato</label>
                <input type="text" id="cred-nome-input" class="cred-nome-input"
                       placeholder="Nome completo do candidato">
                <div class="alert" style="margin-top: 6px; margin-bottom: 0; padding: 6px 10px; font-size: 12px;">
                    <strong>Atenção:</strong> O nome extraído é de quem enviou o protocolo. Corrija se o candidato for outra pessoa.
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label" for="cred-cpf">CPF</label>
                <input type="text" id="cred-cpf" class="cred-cpf-input"
                       placeholder="000.000.000-00" maxlength="14" inputmode="numeric">
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Função pretendida</label>
                <div class="cred-btn-group">
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Ed. Básica"><i class="icon-check-empty"></i> Educação Básica</button>
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Ed. Física"><i class="icon-check-empty"></i> Educação Física</button>
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Artes"><i class="icon-check-empty"></i> Artes</button>
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Regiões Escolares</label>
                <div class="cred-btn-group">
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="1"><i class="icon-check-empty"></i> 1 – Centro</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="2"><i class="icon-check-empty"></i> 2 – Zona Oeste</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="3"><i class="icon-check-empty"></i> 3 – Zona Leste</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="4"><i class="icon-check-empty"></i> 4 – Moreira César</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="5"><i class="icon-check-empty"></i> 5 – Zona Rural</button>
                </div>
            </div>
        `;

        // Inserir formulário antes do conteúdo da tabela de documentos
        modalBody.insertBefore(formContainer, modalBody.firstChild);

        // --- Injetar "Outros documentos anexos" ---
        injetarOutrosAnexos(modal);

        // --- Modificar footer: adicionar botão Copiar ---
        const modalFooter = modal.querySelector('.modal-footer');
        const btnCopiar = document.createElement('button');
        btnCopiar.id = 'cred-btn-executar';
        btnCopiar.className = 'btn btn-success';
        btnCopiar.disabled = true;
        btnCopiar.textContent = 'Processando...';
        modalFooter.insertBefore(btnCopiar, modalFooter.firstChild);

        // Marcar como injetado
        modal.setAttribute('data-cred-injetado', 'true');

        // --- Registrar event listeners ---
        registrarEventListeners(modal);

        // --- Executar extração ---
        resetarEstadoCandidato();
        if (isPaginaProtocolo()) executarFluxo();
    }

    /**
     * Varre a página em busca de anexos que não aparecem na tabela nativa do modal
     * e injeta-os como "Outros documentos anexos" no final da tabela.
     */
    function injetarOutrosAnexos(modal) {
        // 1. Coletar IDs dos anexos já exibidos no modal (decodificando iea = base64 do id_anexo)
        const idsNoModal = new Set();
        modal.querySelectorAll('.div_lista_aprovacao_anexos a[href*="pg=doc/anexo"]').forEach(a => {
            try {
                const url = new URL(a.href, window.location.origin);
                const iea = url.searchParams.get('iea');
                if (iea) idsNoModal.add(atob(iea));
            } catch(e) { /* URL inválida ou base64 inválido — ignorar */ }
        });

        // 2. Coletar todos os anexos da página (fora do modal)
        const anexosExtras = [];
        document.querySelectorAll('td.index[data-id_anexo]').forEach(td => {
            // Ignorar elementos dentro do modal
            if (td.closest('#modal_aprovacao_anexos')) return;
            const id = td.getAttribute('data-id_anexo');
            if (idsNoModal.has(id)) return;
            const link = td.querySelector('a');
            if (!link) return;
            const nome = link.textContent.trim();
            const href = link.getAttribute('href');

            // Extrair número do despacho do container pai
            const despachoTable = td.closest('table.despacho');
            let numDespacho = '';
            if (despachoTable) {
                const strong = despachoTable.querySelector('th strong[data-im]');
                if (strong) {
                    numDespacho = strong.textContent.replace(/\s+/g, ' ').trim()
                        .replace(/^Despacho\s*/i, '');
                }
            }

            anexosExtras.push({ nome, href, numDespacho });
        });

        if (anexosExtras.length === 0) return;

        // 3. Construir linha da tabela no formato nativo do modal
        const tabelaPrincipal = modal.querySelector('.div_lista_aprovacao_anexos > table > tbody');
        if (!tabelaPrincipal) return;

        const linhasHtml = anexosExtras.map(a =>
            `<tr>
                <td class="menor"><a href="${a.href}" target="_blank" title="${a.nome}"><span class="cred-truncate">${a.nome}</span></a></td>
                <td class="menor">${a.numDespacho}</td>
                <td class="menor">Despacho</td>
            </tr>`
        ).join('');

        const novaLinha = document.createElement('tr');
        novaLinha.id = 'cred-outros-anexos';
        novaLinha.innerHTML = `
            <td class="menor">Outros documentos anexos</td>
            <td>
                <small>
                    <table cellspacing="0" width="100%" class="table clearfix table-condensed table-striped sm">
                        <thead>
                            <tr>
                                <th width="50%"><small>Arquivo original</small></th>
                                <th width="30%"><small>Em</small></th>
                                <th width="20%"><small>Origem</small></th>
                            </tr>
                        </thead>
                        <tbody>${linhasHtml}</tbody>
                    </table>
                </small>
            </td>
        `;

        tabelaPrincipal.appendChild(novaLinha);
    }

    /**
     * Registra todos os event listeners nos elementos injetados dentro do modal.
     */
    function registrarEventListeners(modal) {
        // Credenciadora (seleção única, persistida)
        modal.querySelectorAll('.cred-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.cred-opt-btn').forEach(b => b.classList.remove('active'));
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

        // CPF — máscara progressiva
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
        modal.querySelectorAll('.cred-toggle-btn[data-funcao]').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.cred-toggle-btn[data-funcao]').forEach(b => {
                    b.classList.remove('active');
                    b.querySelector('i').className = 'icon-check-empty';
                });
                btn.classList.add('active');
                btn.querySelector('i').className = 'icon-white icon-check';
                funcaoSelecionada = btn.dataset.funcao;
            });
        });

        // Regiões (múltipla seleção — toggle)
        modal.querySelectorAll('.cred-toggle-btn[data-regiao]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const ativo = btn.classList.contains('active');
                btn.querySelector('i').className = ativo ? 'icon-white icon-check' : 'icon-check-empty';
                const r = parseInt(btn.dataset.regiao);
                if (ativo) {
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

        // Botão Copiar
        document.getElementById('cred-btn-executar').addEventListener('click', copiarEFechar);
    }

    /**
     * Reseta o estado por candidato (campos do formulário e variáveis).
     */
    function resetarEstadoCandidato() {
        funcaoSelecionada = null;
        regioesSelecionadas = [];
        cpfDigitos = '';
        dadosExtraidos = null;

        const cpfEl = document.getElementById('cred-cpf');
        const nomeEl = document.getElementById('cred-nome-input');
        const protEl = document.getElementById('cred-res-prot');
        const dataEl = document.getElementById('cred-res-data');

        if (cpfEl) cpfEl.value = '';
        if (nomeEl) nomeEl.value = '';
        if (protEl) protEl.innerText = '\u2014';
        if (dataEl) dataEl.innerText = '\u2014';

        const modal = document.getElementById('modal_aprovacao_anexos');
        if (modal) {
            modal.querySelectorAll('.cred-toggle-btn').forEach(b => {
                b.classList.remove('active');
                b.querySelector('i').className = 'icon-check-empty';
            });
        }
    }

    /**
     * Abre o modal (clica no "Tabela"), aguarda e injeta.
     */
    function abrirDialog() {
        const modal = document.getElementById('modal_aprovacao_anexos');
        const jaAberto = modal && (modal.classList.contains('in') || modal.style.display === 'block');

        if (jaAberto) {
            // Modal já está aberto — apenas injetar/resetar
            injetarControlesNoModal(modal);
            return;
        }

        if (abrirModalTabela()) {
            aguardarModalEInjetar();
        }
    }

    function fecharDialog() {
        const modal = document.getElementById('modal_aprovacao_anexos');
        if (modal) {
            // Usar botão nativo de fechar (Bootstrap 2 data-dismiss)
            const btnFechar = modal.querySelector('.modal-footer .cancelar');
            if (btnFechar) btnFechar.click();
        }
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

    function extrairDataEnvio() {
        const el = document.querySelector('.well.well-header .row-fluid.horario > .span12 > span');
        return el ? el.textContent.trim() : '';
    }

    async function executarFluxo() {
        const btnExecutar = document.getElementById('cred-btn-executar');
        if (!btnExecutar) return;
        btnExecutar.disabled = true;
        btnExecutar.textContent = 'Processando...';

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

            btnExecutar.textContent = 'Copiar';
            btnExecutar.disabled = false;
            btnExecutar.focus();

        } catch (error) {
            console.error('Erro no script de Credenciamento:', error);
            alert('Erro ao extrair dados. Certifique-se de que a página carregou completamente.');
            dadosExtraidos = null;
            btnExecutar.textContent = 'Tentar Novamente';
            btnExecutar.disabled = false;
            btnExecutar.focus();
        }
    }

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

            // Limpar elementos injetados e flag para o próximo protocolo
            const modal = document.getElementById('modal_aprovacao_anexos');
            if (modal) {
                modal.removeAttribute('data-cred-injetado');
                // Remover elementos injetados para evitar duplicação
                const credHeader = modal.querySelector('.cred-header');
                if (credHeader) credHeader.remove();
                const infoBlock = modal.querySelector('.cred-info-block');
                if (infoBlock) infoBlock.remove();
                const formContainer = document.getElementById('cred-form-container');
                if (formContainer) formContainer.remove();
                const btnCopiar = document.getElementById('cred-btn-executar');
                if (btnCopiar) btnCopiar.remove();
                // Restaurar header original
                const headerOriginal = modal.querySelector('.modal-header');
                if (headerOriginal) headerOriginal.classList.remove('cred-header-original-hidden');
            }
        }

        if (isPaginaProtocolo() && autoAbrir && !jaRodouNestaPagina) {
            if (document.querySelector('.nd_num') && document.querySelector('span.pp') && document.querySelector('a.link_tabela_revisao_anexos')) {
                jaRodouNestaPagina = true;
                setTimeout(abrirDialog, 1000);
            }
        }
    }, 500);

})();
