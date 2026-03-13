// ==UserScript==
// @name         1Doc - Credenciamento de Professores
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Painel de conferência de credenciamento: extrai dados, aplica marcador e copia para planilha.
// @author       Raul Cabral
// @match        https://*.1doc.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=1doc.com.br
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/credenciamento.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/credenciamento.user.js
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
    let funcoesSelecionadas = []; // string[]
    let regioesSelecionadas = []; // number[]
    let cpfDigitos = '';          // apenas os dígitos do CPF
    let rgDigitos = '';           // apenas os dígitos do RG
    let nacionalidade = 'brasileira'; // pré-preenchido, editável
    let estadoCivil = '';         // estado civil selecionado
    let celularDigitos = '';      // apenas os dígitos do celular
    let email = '';               // e-mail do candidato
    let cep = '';                 // CEP (apenas dígitos)
    let logradouro = '';          // logradouro preenchido pelo ViaCEP
    let numero = '';              // número do endereço (manual)
    let bairro = '';              // bairro preenchido pelo ViaCEP
    let cidade = '';              // cidade preenchida pelo ViaCEP
    let bancoNome = '';           // nome do banco (campo de texto livre)
    let bancoCOMPE = '';          // código COMPE (sempre vazio — campo de texto livre)
    let chavePix = '';            // chave Pix (default: CPF formatado)
    let pisDigitos = '';          // apenas os dígitos do PIS/PASEP (11 chars)
    let avaliacoesDocs = {};      // { 'I': true, 'II': false, ... } — true=Sim, false=Não, ausente=não avaliado
    let concluido = false;        // true após "Concluir e copiar" — ativa modo congelado
    let cicloAtual = '';          // ciclo do protocolo ('01'–'10' ou '' se fora de intervalo)
    let _credAnexosWin = null;    // referência à janela de anexos (popup separada)

    // Períodos de recebimento de inscrições (por ciclo)
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

    // URL da planilha de controle
    const PLANILHA_URL = 'https://docs.google.com/spreadsheets/d/1OcFrOoA4DQqz1r9cOTKG7kDWyV5jX2xcMFJcf870qzY/edit?gid=0#gid=0';

    // Progresso — debounce timer para auto-save
    let _salvarProgressoTimer = null;
    const PROGRESSO_PREFIX = '1doc_cred_progresso_';
    const PROGRESSO_TTL_DIAS = 30;

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

        /* Header de grupo de seção (ex: Dados Pessoais) */
        .cred-section-group-header {
            padding: 6px 15px 4px;
            font-size: 11px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.5px;
            color: #005400; background: rgba(0,84,0,0.07);
            border-top: 1px solid rgba(0,84,0,0.14);
            border-bottom: 1px solid rgba(0,84,0,0.14);
        }

        /* Linha horizontal de campos (CPF, RG, Nacionalidade) */
        .cred-dados-row { display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start; }
        .cred-field-block { display: flex; flex-direction: column; }

        /* Botões de estado civil (seleção única) */
        .cred-estadocivil-btn {
            border: 1px solid #707070 !important; border-radius: 4px;
            background: #8b8b8b !important; background-image: none !important;
            cursor: pointer; color: #fff !important;
            transition: background 0.15s, border-color 0.15s;
        }
        .cred-estadocivil-btn:hover { background: #7a7a7a !important; border-color: #606060 !important; }
        .cred-estadocivil-btn.active { background: #005400 !important; color: #fff !important; border-color: #004400 !important; }

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
            background-color: #8b8b8b !important;
            background-image: none !important;
            border-color: #707070 !important;
            color: #fff !important;
            transition: background-color 0.15s, border-color 0.15s;
            margin-bottom: 3px;
        }
        .cred-toggle-btn:hover {
            background-color: #7a7a7a !important;
        }

        /* Ícone de checkbox: oculto por padrão, visível apenas quando o botão está ativo */
        .cred-toggle-btn i, .cred-estadocivil-btn i { display: none; }
        .cred-toggle-btn.active i, .cred-estadocivil-btn.active i { display: inline; margin-right: 2px; }
        .cred-toggle-btn.active {
            background-color: #005400 !important;
            border-color: #004400 !important;
            color: #fff !important;
        }
        .cred-toggle-btn.active:hover {
            background-color: #006600 !important;
        }

        /* Botão Concluir e copiar no footer */
        #cred-btn-executar {
            margin-right: 5px;
        }
        #cred-btn-executar:not(.cred-incompleto):not([disabled]) {
            background-color: #006600 !important;
            background-image: none !important;
            border-color: #004400 !important;
            color: #fff !important;
        }
        #cred-btn-executar.cred-incompleto {
            background-color: #e6e6e6 !important;
            background-image: none !important;
            border-color: #ccc !important;
            color: #333 !important;
            text-shadow: none !important;
            box-shadow: none !important;
        }
        #cred-btn-executar.cred-incompleto:hover {
            background-color: #d9d9d9 !important;
        }
        #cred-btn-editar {
            margin-right: 5px;
            background-color: #c8a800 !important;
            background-image: none !important;
            border-color: #9e8400 !important;
            color: #fff !important;
            text-shadow: none !important;
        }
        #cred-btn-editar:hover {
            background-color: #b39600 !important;
        }
        #cred-btn-duvida {
            margin-right: 5px;
            background-color: #c0392b !important;
            background-image: none !important;
            border-color: #962d22 !important;
            color: #fff !important;
            text-shadow: none !important;
        }
        #cred-btn-duvida:hover {
            background-color: #a93226 !important;
        }
        /* Campos congelados: legíveis mas visivelmente não-editáveis */
        #modal_aprovacao_anexos input:disabled,
        #modal_aprovacao_anexos textarea:disabled {
            background-color: #f5f5f5 !important;
            color: #555 !important;
            cursor: default !important;
            opacity: 1 !important;
        }
        #modal_aprovacao_anexos .cred-toggle-btn:disabled,
        #modal_aprovacao_anexos .cred-estadocivil-btn:disabled,
        #modal_aprovacao_anexos .cred-simnao-btn:disabled {
            cursor: default !important;
            opacity: 0.8 !important;
        }

        /* Seção da Ficha de Inscrição (destaque acima do formulário) */
        .cred-ficha-section {
            padding: 10px 15px;
            border-bottom: 1px solid rgba(0, 102, 0, 0.2);
            background: rgba(0, 102, 0, 0.04);
        }
        .cred-ficha-section .cred-section-label { margin-bottom: 4px; }
        .cred-ficha-section table { margin-bottom: 0; }
        .cred-ficha-section .cred-truncate { max-width: 220px; }

        /* Truncamento de nomes longos de arquivo nos "outros anexos" */
        .cred-truncate {
            display: inline-block;
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
        }

        /* Nome do candidato dentro do bloco de identificação */
        .cred-info-nome-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            border-top: 1px solid rgba(0, 102, 0, 0.15);
            padding-top: 8px;
        }
        .cred-nome-confirma-label {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            color: #408d40;
            cursor: pointer;
            user-select: none;
            margin-top: 2px;
        }
        .cred-nome-confirma-label input { cursor: pointer; accent-color: #005400; }

        /* Ocultar o header original quando injetado */
        #modal_aprovacao_anexos .cred-header-original-hidden { display: none; }

        /* Botões Sim/Não por categoria de documento */
        .cred-simnao-group {
            display: inline-flex;
            gap: 4px;
        }
        .cred-simnao-group .cred-simnao-btn {
            opacity: 1;
            transition: opacity 0.15s, filter 0.15s;
        }
        .cred-simnao-group .cred-simnao-btn.inativo {
            opacity: 0.5;
            filter: grayscale(100%);
        }
        /* Célula mesclada (rowspan) que contém os botões Sim/Não */
        .cred-simnao-cell {
            vertical-align: middle !important;
            text-align: center;
            white-space: nowrap;
        }
        /* Aviso na seção da Ficha de Inscrição */
        .cred-aviso-ficha {
            background-color: #fcf8e3; border: 1px solid #faebcc;
            color: #8a6d3b; border-radius: 4px;
            padding: 5px 9px; font-size: 12px; margin-top: 6px;
        }

        /* Alerta de erro de validação */
        .cred-alert-erro {
            background-color: #f2dede;
            border: 1px solid #ebccd1;
            color: #a94442;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 12px;
            margin-top: 6px;
        }
        /* Erro injetado diretamente em .div_lista_aprovacao_anexos (fora de .cred-form-section) */
        .div_lista_aprovacao_anexos > .cred-alert-erro {
            margin: 8px 15px;
        }

        /* Toast de progresso restaurado */
        .cred-toast-restaurado {
            display: inline-flex; align-items: center; gap: 8px;
            background: #d9edf7; border: 1px solid #bce8f1; color: #31708f;
            border-radius: 4px; padding: 4px 10px; font-size: 12px;
            margin-right: 8px; animation: credToastIn .3s ease;
        }
        .cred-toast-restaurado button {
            background: none; border: 1px solid #31708f;
            color: #31708f; border-radius: 3px; padding: 1px 7px; font-size: 11px;
            cursor: pointer; line-height: 1.4;
        }
        .cred-toast-restaurado button:hover { background: #31708f; color: #fff; }
        @keyframes credToastIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* Responsividade vertical: footer e header sempre visíveis em telas pequenas.
           Flex-coluna com max-height no modal: apenas .modal-body rola internamente.
           !important necessário para sobrescrever estilos inline definidos pelo JS do Bootstrap 2. */
        #modal_aprovacao_anexos.in {
            display: flex !important;
            flex-direction: column;
            max-height: 94vh !important;
            top: 3vh !important;
            margin-top: 0 !important;
        }
        #modal_aprovacao_anexos .modal-body {
            flex: 1 1 auto;
            overflow-y: auto;
            min-height: 0;
        }

        /* Chip de habilitação */
        #cred-chip-habilitacao {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        #cred-chip-habilitacao.cred-chip-avaliacao {
            background: #e8e8e8; color: #666; border: 1px solid #ccc;
        }
        #cred-chip-habilitacao.cred-chip-habilitado {
            background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6;
        }
        #cred-chip-habilitacao.cred-chip-inabilitado {
            background: #f2dede; color: #a94442; border: 1px solid #ebccd1;
        }

        /* Remover os botões "Revisar" nativos do modal — substituídos pelos botões Sim/Não */
        #modal_aprovacao_anexos a.anexo_galeria_item_hover_btn { display: none !important; }

        /* Dialog de confirmação de marcadores (exibido sobre o Bootstrap modal) */
        #cred-dialog-marcadores {
            position: fixed; inset: 0; z-index: 10050;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.45);
        }
        #cred-dialog-marcadores .cred-dialog-box {
            background: #fff; border-radius: 6px;
            padding: 20px 24px; max-width: 420px; width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.28);
        }
        #cred-dialog-marcadores .cred-dialog-title {
            font-size: 15px; font-weight: 700; color: #8a6d3b; margin-bottom: 10px;
        }
        #cred-dialog-marcadores .cred-dialog-body {
            font-size: 13px; color: #555; margin-bottom: 18px; line-height: 1.5;
        }
        #cred-dialog-marcadores .cred-dialog-footer {
            display: flex; gap: 8px; justify-content: flex-end;
        }


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
     * Cria o container do formulário de credenciamento (nome, CPF, função, regiões).
     * Reutilizado na primeira injeção e nas reaberturas do modal.
     */
    function criarFormulario() {
        const formContainer = document.createElement('div');
        formContainer.id = 'cred-form-container';
        formContainer.innerHTML = `
            <div class="cred-section-group-header">Dados Pessoais</div>
            <div class="cred-form-section">
                <div class="cred-dados-row">
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-cpf">CPF</label>
                        <input type="text" id="cred-cpf" class="cred-cpf-input"
                               placeholder="000.000.000-00" maxlength="14" inputmode="numeric" autocomplete="nope">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-rg">RG</label>
                        <input type="text" id="cred-rg" class="cred-cpf-input"
                               placeholder="00.000.000-0" maxlength="14" inputmode="numeric" autocomplete="nope">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-nacionalidade">Nacionalidade</label>
                        <input type="text" id="cred-nacionalidade" class="cred-cpf-input"
                               value="brasileira" autocomplete="nope">
                    </div>
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Estado civil</label>
                <div class="cred-btn-group" id="cred-estadocivil-group">
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Solteiro(a)"><i class="icon-check-empty"></i> Solteiro(a)</button>
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Casado(a)"><i class="icon-check-empty"></i> Casado(a)</button>
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Divorciado(a)"><i class="icon-check-empty"></i> Divorciado(a)</button>
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Vi\u00favo(a)"><i class="icon-check-empty"></i> Vi\u00favo(a)</button>
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Separado(a)"><i class="icon-check-empty"></i> Separado(a)</button>
                    <button class="btn btn-mini cred-estadocivil-btn" data-estado="Uni\u00e3o est\u00e1vel"><i class="icon-check-empty"></i> Uni\u00e3o est\u00e1vel</button>
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Endereço</label>
                <div class="cred-dados-row" style="margin-bottom: 8px;">
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-cep">CEP</label>
                        <input type="text" id="cred-cep" class="cred-cpf-input"
                               placeholder="00000-000" maxlength="9" inputmode="numeric" autocomplete="nope" style="width: 100px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-logradouro">Logradouro</label>
                        <input type="text" id="cred-logradouro" class="cred-cpf-input"
                               placeholder="Rua, Av., ..." autocomplete="nope" style="width: 280px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-numero">Número</label>
                        <input type="text" id="cred-numero" class="cred-cpf-input"
                               placeholder="Nº" autocomplete="nope" style="width: 70px;">
                    </div>
                </div>
                <div class="cred-dados-row">
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-bairro">Bairro</label>
                        <input type="text" id="cred-bairro" class="cred-cpf-input"
                               placeholder="Bairro" autocomplete="nope" style="width: 180px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-cidade">Cidade</label>
                        <input type="text" id="cred-cidade" class="cred-cpf-input"
                               placeholder="Cidade" autocomplete="nope" style="width: 180px;">
                    </div>
                </div>
            </div>
            <div class="cred-form-section">
                <div class="cred-dados-row">
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-email">E-mail</label>
                        <input type="text" id="cred-email" class="cred-cpf-input"
                               placeholder="email@exemplo.com" inputmode="email" autocomplete="nope" style="width: 260px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-celular">Celular</label>
                        <input type="text" id="cred-celular" class="cred-cpf-input"
                               placeholder="(00) 00000-0000" maxlength="15" inputmode="numeric" autocomplete="nope">
                    </div>
                </div>
            </div>
            <div class="cred-form-section">
                <div class="cred-dados-row">
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-banco-input">Banco</label>
                        <input type="text" id="cred-banco-input" class="cred-cpf-input"
                               placeholder="Nome do banco..." autocomplete="nope" style="width: 220px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-chavepix">Chave Pix</label>
                        <input type="text" id="cred-chavepix" class="cred-cpf-input"
                               placeholder="CPF, e-mail, celular..." autocomplete="nope" style="width: 220px;">
                    </div>
                    <div class="cred-field-block">
                        <label class="cred-section-label" for="cred-pis">PIS/PASEP/NIT/NIS</label>
                        <input type="text" id="cred-pis" class="cred-cpf-input"
                               placeholder="000.00000.00-0" maxlength="14" inputmode="numeric"
                               autocomplete="nope" style="width: 160px;">
                    </div>
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Função pretendida</label>
                <div class="cred-btn-group" id="cred-funcao-group">
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Ed. Básica"><i class="icon-check-empty"></i> Educação Básica</button>
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Ed. Física"><i class="icon-check-empty"></i> Educação Física</button>
                    <button class="btn btn-mini cred-toggle-btn" data-funcao="Artes"><i class="icon-check-empty"></i> Artes</button>
                </div>
            </div>
            <div class="cred-form-section">
                <label class="cred-section-label">Regiões Escolares</label>
                <div class="cred-btn-group" id="cred-regiao-group">
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="1"><i class="icon-check-empty"></i> 1 – Centro</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="2"><i class="icon-check-empty"></i> 2 – Zona Oeste</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="3"><i class="icon-check-empty"></i> 3 – Zona Leste</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="4"><i class="icon-check-empty"></i> 4 – Moreira César</button>
                    <button class="btn btn-mini cred-toggle-btn" data-regiao="5"><i class="icon-check-empty"></i> 5 – Zona Rural</button>
                </div>
            </div>
        `;
        return formContainer;
    }

    /**
     * Formata dígitos de celular no padrão (00) 00000-0000 (11 dígitos)
     * ou (00) 0000-0000 (10 dígitos). Progressivo durante a digitação.
     */
    function formatarCelular(digits) {
        if (digits.length <= 2)  return '(' + digits;
        if (digits.length <= 6)  return '(' + digits.slice(0,2) + ') ' + digits.slice(2);
        if (digits.length <= 10) return '(' + digits.slice(0,2) + ') ' + digits.slice(2,6) + '-' + digits.slice(6);
        return '(' + digits.slice(0,2) + ') ' + digits.slice(2,7) + '-' + digits.slice(7);
    }

    /**
     * Registra listeners dos campos do formulário (CPF, função, regiões).
     * Separado para poder ser chamado na reabertura do modal.
     */
    function registrarEventListenersFormulario(modal) {
        // CPF — máscara progressiva
        const cpfEl = document.getElementById('cred-cpf');
        if (cpfEl) {
            cpfEl.addEventListener('input', (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let fmt = digits;
                if (digits.length > 9)      fmt = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9);
                else if (digits.length > 6) fmt = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6);
                else if (digits.length > 3) fmt = digits.slice(0,3)+'.'+digits.slice(3);
                e.target.value = fmt;
                cpfDigitos = digits;
                // Auto-preencher Chave Pix se ainda não foi editada manualmente ou bate com CPF anterior
                const pixEl = document.getElementById('cred-chavepix');
                if (pixEl) {
                    const pixFmt = digits.length === 11
                        ? digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9)
                        : '';
                    pixEl.value = pixFmt;
                    chavePix = digits.length === 11 ? digits : '';
                }
            });
        }

        // RG — máscara progressiva (00.000.000-0 com 9 dígitos; sem traço se apenas 8)
        // Exceção: aceita 11 dígitos quando iguais ao CPF (uso de CPF no lugar do RG, previsto em lei)
        const rgEl = document.getElementById('cred-rg');
        if (rgEl) {
            rgEl.addEventListener('input', (e) => {
                let digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                if (digits.length > 9) {
                    const ehCpfCompleto = digits.length === 11 && digits === cpfDigitos;
                    const digitandoCpf  = digits.length === 10 && cpfDigitos && cpfDigitos.startsWith(digits);
                    if (ehCpfCompleto) {
                        // Formato CPF: 000.000.000-00
                        e.target.value = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9);
                        rgDigitos = digits;
                        return;
                    } else if (digitandoCpf) {
                        // Digitação incompleta do CPF — exibir parcial sem truncar
                        e.target.value = digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9);
                        rgDigitos = digits;
                        return;
                    } else {
                        digits = digits.slice(0, 9);
                    }
                }
                let fmt = digits;
                if (digits.length > 8)      fmt = digits.slice(0,2)+'.'+digits.slice(2,5)+'.'+digits.slice(5,8)+'-'+digits.slice(8);
                else if (digits.length > 5) fmt = digits.slice(0,2)+'.'+digits.slice(2,5)+'.'+digits.slice(5);
                else if (digits.length > 2) fmt = digits.slice(0,2)+'.'+digits.slice(2);
                e.target.value = fmt;
                rgDigitos = digits;
            });
        }

        // Nacionalidade
        const nacEl = document.getElementById('cred-nacionalidade');
        if (nacEl) {
            nacEl.addEventListener('input', (e) => { nacionalidade = e.target.value; });
        }

        // Estado civil — seleção única com toggle
        modal.querySelectorAll('.cred-estadocivil-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const jaAtivo = btn.classList.contains('active');
                modal.querySelectorAll('.cred-estadocivil-btn').forEach(b => {
                    b.classList.remove('active');
                    b.querySelector('i').className = 'icon-check-empty';
                });
                if (!jaAtivo) {
                    btn.classList.add('active');
                    btn.querySelector('i').className = 'icon-white icon-check';
                    estadoCivil = btn.dataset.estado;
                } else {
                    estadoCivil = '';
                }
            });
        });

        // Celular — máscara progressiva (00) 00000-0000
        const celularEl = document.getElementById('cred-celular');
        if (celularEl) {
            celularEl.addEventListener('input', (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                e.target.value = formatarCelular(digits);
                celularDigitos = digits;
            });
        }

        // E-mail
        const emailEl = document.getElementById('cred-email');
        if (emailEl) {
            emailEl.addEventListener('input', (e) => { email = e.target.value.trim(); });
        }

        // Função (múltipla seleção — toggle)
        modal.querySelectorAll('.cred-toggle-btn[data-funcao]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const ativo = btn.classList.contains('active');
                btn.querySelector('i').className = ativo ? 'icon-white icon-check' : 'icon-check-empty';
                const f = btn.dataset.funcao;
                if (ativo) {
                    if (!funcoesSelecionadas.includes(f)) funcoesSelecionadas.push(f);
                } else {
                    funcoesSelecionadas = funcoesSelecionadas.filter(x => x !== f);
                }
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

        // CEP — máscara + busca automática ao digitar o 8º dígito
        const cepEl = document.getElementById('cred-cep');
        if (cepEl) {
            const camposEndereco = () => [
                document.getElementById('cred-logradouro'),
                document.getElementById('cred-bairro'),
                document.getElementById('cred-cidade'),
            ].filter(Boolean);

            const bloquearCampos = () => {
                camposEndereco().forEach(el => {
                    el.disabled = true;
                    el.placeholder = 'Carregando...';
                    el.value = '';
                });
            };

            const liberarCampos = () => {
                const placeholders = { 'cred-logradouro': 'Rua, Av., ...', 'cred-bairro': 'Bairro', 'cred-cidade': 'Cidade' };
                camposEndereco().forEach(el => {
                    el.disabled = false;
                    el.placeholder = placeholders[el.id] || '';
                });
            };

            const buscarCep = async () => {
                const secaoCep = cepEl.closest('.cred-form-section');
                if (secaoCep) secaoCep.querySelectorAll('.cred-alert-erro').forEach(el => el.remove());
                bloquearCampos();
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (data.erro) throw new Error('CEP não encontrado');
                    logradouro = data.logradouro || '';
                    bairro = data.bairro || '';
                    cidade = data.localidade || '';
                    liberarCampos();
                    const logEl = document.getElementById('cred-logradouro');
                    const baiEl = document.getElementById('cred-bairro');
                    const cidEl = document.getElementById('cred-cidade');
                    if (logEl) logEl.value = logradouro;
                    if (baiEl) baiEl.value = bairro;
                    if (cidEl) cidEl.value = cidade;
                    atualizarBotaoConcluir();
                    const numEl = document.getElementById('cred-numero');
                    if (numEl) numEl.focus();
                } catch (_) {
                    liberarCampos();
                    const erro = document.createElement('div');
                    erro.className = 'cred-alert-erro';
                    erro.textContent = 'CEP inválido ou não encontrado. Preencha o endereço manualmente.';
                    if (secaoCep) secaoCep.appendChild(erro);
                }
            };

            cepEl.addEventListener('input', (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                cep = digits;
                e.target.value = digits.length > 5 ? digits.slice(0,5) + '-' + digits.slice(5) : digits;
                if (digits.length === 8) buscarCep();
            });
        }

        // Campos de endereço (edição manual após autopreenchimento)
        const logradouroEl = document.getElementById('cred-logradouro');
        if (logradouroEl) logradouroEl.addEventListener('input', (e) => { logradouro = e.target.value; });
        const numeroEl = document.getElementById('cred-numero');
        if (numeroEl) numeroEl.addEventListener('input', (e) => { numero = e.target.value; });
        const bairroEl = document.getElementById('cred-bairro');
        if (bairroEl) bairroEl.addEventListener('input', (e) => { bairro = e.target.value; });
        const cidadeEl = document.getElementById('cred-cidade');
        if (cidadeEl) cidadeEl.addEventListener('input', (e) => { cidade = e.target.value; });

        // Chave Pix
        const pixEl = document.getElementById('cred-chavepix');
        if (pixEl) pixEl.addEventListener('input', (e) => { chavePix = e.target.value.replace(/\D/g, ''); });

        // PIS/PASEP
        const pisEl = document.getElementById('cred-pis');
        if (pisEl) pisEl.addEventListener('input', (e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            pisDigitos = digits;
            let masked = digits;
            if (digits.length > 10) masked = digits.slice(0,3) + '.' + digits.slice(3,8) + '.' + digits.slice(8,10) + '-' + digits.slice(10);
            else if (digits.length > 8) masked = digits.slice(0,3) + '.' + digits.slice(3,8) + '.' + digits.slice(8);
            else if (digits.length > 3) masked = digits.slice(0,3) + '.' + digits.slice(3,8);
            else masked = digits;
            e.target.value = masked;
        });

        // Banco — campo de texto simples
        const bancoInput = document.getElementById('cred-banco-input');
        if (bancoInput) {
            bancoInput.addEventListener('input', (e) => { bancoNome = e.target.value; });
        }

        // Auto-save: qualquer input ou click no formulário agenda salvamento
        const formCont = document.getElementById('cred-form-container');
        if (formCont) {
            formCont.addEventListener('input', agendarSalvarProgresso);
            formCont.addEventListener('click', agendarSalvarProgresso);
        }
    }

    /**
     * Injeta header, bloco de info, formulário e botão copiar no modal nativo.
     * Usa atributo data-cred-injetado como guard contra duplicação.
     */
    function injetarControlesNoModal(modal) {
        if (modal.getAttribute('data-cred-injetado') === 'true') {
            // Já injetado — mas o AJAX do 1Doc pode ter destruído conteúdo do modal-body.
            // Re-injetar elementos dependentes da tabela AJAX (formulário, ficha, outros anexos).
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                // Limpar restos antigos que possam ter sobrevivido
                const fichaAntiga = document.getElementById('cred-ficha-inscricao');
                if (fichaAntiga) fichaAntiga.remove();
                const outrosAnexosAntigo = document.getElementById('cred-outros-anexos');
                if (outrosAnexosAntigo) outrosAnexosAntigo.remove();

                let formContainer = document.getElementById('cred-form-container');
                if (!formContainer) {
                    // Formulário foi destruído pelo reload AJAX — recriar
                    formContainer = criarFormulario();
                    modalBody.insertBefore(formContainer, modalBody.firstChild);
                    registrarEventListenersFormulario(modal);
                }

                moverFichaInscricao(modal, modalBody, formContainer);
                injetarOutrosAnexos(modal);
                injetarBotoesCategorias(modal);
            }
            resetarEstadoCandidato();
            if (isPaginaProtocolo()) executarFluxo();
            // Restaurar progresso salvo (se houver) após extração
            if (dadosExtraidos && dadosExtraidos.protocolo) {
                const progressoSalvo = carregarProgresso(dadosExtraidos.protocolo);
                if (progressoSalvo) restaurarProgresso(progressoSalvo);
            }
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
                <div class="cred-info-item" style="flex: 1;">
                    <span class="cred-info-label">Nome do(a) candidato(a)</span>
                    <input type="text" id="cred-nome-input" class="cred-nome-input"
                           placeholder="Nome completo do(a) candidato(a)" autocomplete="nope">
                </div>
                <div class="cred-info-item" style="align-self: flex-end;">
                    <span id="cred-chip-habilitacao" class="cred-chip-avaliacao">Em avaliação</span>
                </div>
            </div>
            <div class="cred-info-nome-row">
                <label class="cred-nome-confirma-label">
                    <input type="checkbox" id="cred-nome-confirmado">
                    Este nome é igual ao que está na ficha de inscrição
                </label>
            </div>
        `;

        // Inserir após o header customizado
        credHeader.insertAdjacentElement('afterend', infoBlock);

        // --- Formulário do credenciamento (antes da tabela de documentos) ---
        const modalBody = modal.querySelector('.modal-body');
        const formContainer = criarFormulario();

        // Inserir formulário antes do conteúdo da tabela de documentos
        modalBody.insertBefore(formContainer, modalBody.firstChild);

        // --- Mover Ficha de Inscrição para posição de destaque ---
        moverFichaInscricao(modal, modalBody, formContainer);

        // --- Injetar "Outros documentos anexos" ---
        injetarOutrosAnexos(modal);

        // --- Injetar botões Sim/Não por categoria ---
        injetarBotoesCategorias(modal);

        // --- Modificar footer: adicionar botão Concluir e copiar e botão Dúvida ---
        const modalFooter = modal.querySelector('.modal-footer');
        const btnCopiar = document.createElement('button');
        btnCopiar.id = 'cred-btn-executar';
        btnCopiar.className = 'btn btn-success cred-incompleto';
        btnCopiar.disabled = true;
        btnCopiar.textContent = 'Processando...';
        modalFooter.insertBefore(btnCopiar, modalFooter.firstChild);

        const btnDuvida = document.createElement('button');
        btnDuvida.id = 'cred-btn-duvida';
        btnDuvida.className = 'btn';
        btnDuvida.textContent = 'Dúvida';
        btnDuvida.title = 'Tem dúvidas sobre o preenchimento desta ficha? Clique aqui para aplicar o marcador "Dúvida" e voltar ao inbox. Seu progresso será salvo e você poderá retomar o credenciamento desta pessoa mais tarde.';
        btnCopiar.insertAdjacentElement('afterend', btnDuvida);

        // Marcar como injetado
        modal.setAttribute('data-cred-injetado', 'true');

        // --- Registrar event listeners ---
        registrarEventListeners(modal);

        // --- Executar extração ---
        resetarEstadoCandidato();
        if (isPaginaProtocolo()) executarFluxo();
        // Restaurar progresso salvo (se houver) após extração
        if (dadosExtraidos && dadosExtraidos.protocolo) {
            const progressoSalvo = carregarProgresso(dadosExtraidos.protocolo);
            if (progressoSalvo) restaurarProgresso(progressoSalvo);
        }

        // Abrir links de anexo numa janela separada (popup).
        // 1.º clique: abre janela nova; seguintes: abrem abas dentro dela.
        // Usa onclick direto (não delegation) para garantir que o handler sobrescreve
        // qualquer comportamento existente e não depende de propagação de evento.
        modal.querySelectorAll('a[href*="pg=doc/anexo"]').forEach(a => {
            a.onclick = function(e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const url = this.href;
                try {
                    if (_credAnexosWin && !_credAnexosWin.closed) {
                        _credAnexosWin.open(url, '_blank');
                        _credAnexosWin.focus();
                        return;
                    }
                } catch (_) { /* referência inválida, criar nova janela */ }
                const sw = screen.availWidth, sh = screen.availHeight;
                const sl = screen.availLeft  ?? 0, st = screen.availTop ?? 0;
                const metade = Math.floor(sw / 2);
                _credAnexosWin = window.open(url, 'cred-anexos',
                    'width=' + metade + ',height=' + sh + ',left=' + (sl + metade) + ',top=' + st);
            };
        });
    }

    /**
     * Move a linha "I - Ficha de Inscrição" da tabela nativa do modal para uma
     * posição de destaque, logo acima do formulário do credenciamento.
     */
    function moverFichaInscricao(modal, modalBody, formContainer) {
        const tabelaPrincipal = modal.querySelector('.div_lista_aprovacao_anexos > table > tbody');
        if (!tabelaPrincipal) return;

        // Localizar a <tr> cuja primeira célula contém "Ficha de Inscrição"
        let fichaRow = null;
        for (const tr of tabelaPrincipal.querySelectorAll(':scope > tr')) {
            const td = tr.querySelector('td');
            if (td && /ficha de inscri/i.test(td.textContent)) {
                fichaRow = tr;
                break;
            }
        }
        if (!fichaRow) return;

        // Extrair o rótulo (ex: "I - Ficha de Inscrição *") e a inner table
        const labelTd = fichaRow.querySelector('td');
        const innerTable = fichaRow.querySelector('table');
        if (!labelTd || !innerTable) return;

        // Aplicar truncamento nos links de arquivo dentro da inner table
        innerTable.querySelectorAll('td.menor > a[target="_blank"]').forEach(link => {
            const nome = link.textContent.trim();
            link.setAttribute('title', nome);
            link.innerHTML = `<span class="cred-truncate">${nome}</span>`;
        });

        // Montar container
        const fichaContainer = document.createElement('div');
        fichaContainer.id = 'cred-ficha-inscricao';
        fichaContainer.className = 'cred-ficha-section';

        const label = document.createElement('label');
        label.className = 'cred-section-label';
        label.innerHTML = labelTd.childNodes[0].nodeType === Node.TEXT_NODE
            ? labelTd.innerHTML.trim()
            : labelTd.innerHTML;
        fichaContainer.appendChild(label);
        adicionarColunaStatusNaTabela(innerTable, 'I');
        fichaContainer.appendChild(innerTable);

        const avisoFicha = document.createElement('div');
        avisoFicha.className = 'cred-aviso-ficha';
        avisoFicha.innerHTML = 'Conferir se a ficha de inscrição é a <b>versão retificada</b>: 3 – Zona Leste, 4 – Moreira César. Caso não, procure ao final desta lista a seção "Outros documentos anexos".';
        fichaContainer.appendChild(avisoFicha);

        // Remover a linha original da tabela
        fichaRow.remove();

        // Inserir acima do formulário
        modalBody.insertBefore(fichaContainer, formContainer);
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

        // 2. Coletar anexos de despachos posteriores (apenas em table_anexos_filhos)
        const anexosExtras = [];
        const tabelaFilhos = document.getElementById('table_anexos_filhos');
        if (!tabelaFilhos) return; // Sem despachos posteriores — sem anexos avulsos
        tabelaFilhos.querySelectorAll('td.index[data-id_anexo]').forEach(td => {
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
     * Cria um par de botões Sim/Não para uma categoria de documento.
     * O estado é registrado em avaliacoesDocs[categoria].
     * Ao selecionar um botão, o outro fica inativo (cinza + 50% opacidade).
     * Clicar no botão já selecionado deseleciona ambos, voltando ao estado inicial.
     */
    function criarGrupoBotoes(categoria) {
        const grupo = document.createElement('div');
        grupo.className = 'cred-simnao-group';
        grupo.dataset.categoria = categoria;
        grupo.innerHTML = `
            <button class="btn btn-success btn-mini cred-simnao-btn">Sim</button>
            <button class="btn btn-danger btn-mini cred-simnao-btn">Não</button>
        `;
        const [btnSim, btnNao] = grupo.querySelectorAll('.cred-simnao-btn');
        function selecionarBotao(clicado, outro, valor) {
            if (avaliacoesDocs[categoria] === valor) {
                delete avaliacoesDocs[categoria];
                clicado.classList.remove('inativo');
                outro.classList.remove('inativo');
            } else {
                avaliacoesDocs[categoria] = valor;
                clicado.classList.remove('inativo');
                outro.classList.add('inativo');
            }
            clicado.blur();
            atualizarChipHabilitacao();
            agendarSalvarProgresso();
        }
        btnSim.addEventListener('click', () => selecionarBotao(btnSim, btnNao, true));
        btnNao.addEventListener('click', () => selecionarBotao(btnNao, btnSim, false));
        return grupo;
    }

    /**
     * Reutiliza a coluna nativa "Status da revisão" da inner table de uma categoria.
     * - Localiza o índice da coluna pelo texto do cabeçalho.
     * - Na primeira linha do corpo: transforma a <td> existente em célula mesclada (rowspan)
     *   com os botões Sim/Não e remove o botão "Revisar" original.
     * - Nas demais linhas: remove a <td> da mesma coluna (cobertas pelo rowspan).
     */
    function adicionarColunaStatusNaTabela(innerTable, categoria) {
        if (!innerTable) return;
        if (innerTable.querySelector('.cred-simnao-cell')) return; // Já injetado

        // Localizar o índice da coluna "Status da revisão" no cabeçalho
        const headerRow = innerTable.querySelector('thead > tr') || innerTable.querySelector('tr');
        let colIndex = -1;
        if (headerRow) {
            Array.from(headerRow.querySelectorAll('th, td')).forEach((th, i) => {
                if (/status da revis/i.test(th.textContent)) colIndex = i;
            });
        }

        // Coletar linhas do corpo (excluindo cabeçalho)
        const tbody = innerTable.querySelector('tbody');
        const bodyRows = tbody
            ? Array.from(tbody.querySelectorAll(':scope > tr'))
            : Array.from(innerTable.querySelectorAll('tr')).slice(1);
        if (bodyRows.length === 0) return;

        if (colIndex !== -1) {
            // Reutilizar a <td> existente da coluna nativa na primeira linha
            const primeiraCell = bodyRows[0].querySelectorAll('td')[colIndex];
            if (primeiraCell) {
                primeiraCell.innerHTML = '';
                primeiraCell.className = 'cred-simnao-cell';
                primeiraCell.rowSpan = bodyRows.length;
                primeiraCell.appendChild(criarGrupoBotoes(categoria));
            }
            // Remover a <td> da mesma coluna nas demais linhas (cobertas pelo rowspan)
            bodyRows.slice(1).forEach(tr => {
                const cell = tr.querySelectorAll('td')[colIndex];
                if (cell) cell.remove();
            });
        } else {
            // Fallback: coluna nativa não encontrada — adicionar célula no final da primeira linha
            const td = document.createElement('td');
            td.className = 'cred-simnao-cell';
            td.rowSpan = bodyRows.length;
            td.appendChild(criarGrupoBotoes(categoria));
            bodyRows[0].appendChild(td);
        }
    }

    /**
     * Percorre as linhas de categoria da tabela nativa e, para cada uma com algarismo romano,
     * injeta a coluna "Status da revisão" com botões Sim/Não mesclados via rowspan.
     */
    function injetarBotoesCategorias(modal) {
        const ROMANA_RE = /^(XI|X|IX|VIII|VII|VI|IV|V|III|II|I)\s*[-–]/;
        const tabelaPrincipal = modal.querySelector('.div_lista_aprovacao_anexos > table > tbody');
        if (!tabelaPrincipal) return;

        for (const tr of tabelaPrincipal.querySelectorAll(':scope > tr')) {
            const td = tr.querySelector('td');
            if (!td) continue;
            const match = td.textContent.trim().match(ROMANA_RE);
            if (!match) continue; // Sem algarismo romano → pular

            adicionarColunaStatusNaTabela(tr.querySelector('table'), match[1]);
        }
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

        // Listeners do formulário (CPF, função, regiões)
        registrarEventListenersFormulario(modal);

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

        // Botão Concluir e copiar
        document.getElementById('cred-btn-executar').addEventListener('click', copiarEFechar);

        // Botão Dúvida: salva progresso, aplica marcador e volta ao inbox
        const btnDuvidaEl = document.getElementById('cred-btn-duvida');
        if (btnDuvidaEl) {
            btnDuvidaEl.addEventListener('click', () => {
                salvarProgresso();
                aplicarMarcadorResultado('Dúvida');
                window.location.href = 'https://pindamonhangaba.1doc.com.br/?pg=painel/listar&meu=0&trocar=1';
            });
        }

        // Auto-save: nome do candidato e confirmação
        const nomeInput = document.getElementById('cred-nome-input');
        if (nomeInput) nomeInput.addEventListener('input', agendarSalvarProgresso);
        const nomeConf = document.getElementById('cred-nome-confirmado');
        if (nomeConf) nomeConf.addEventListener('change', agendarSalvarProgresso);
    }

    /**
     * Atualiza o chip de habilitação no footer com base em avaliacoesDocs.
     * Verde  = todos os grupos marcados SIM.
     * Vermelho = ao menos um grupo marcado NÃO.
     * Cinza  = algum grupo ainda sem avaliação.
     */
    function atualizarChipHabilitacao() {
        const chip = document.getElementById('cred-chip-habilitacao');
        if (!chip) return;
        const modal = document.getElementById('modal_aprovacao_anexos');
        if (!modal) return;
        const categorias = Array.from(modal.querySelectorAll('.cred-simnao-group'))
            .map(g => g.dataset.categoria);
        const algumNao      = categorias.some(cat => avaliacoesDocs[cat] === false);
        const algumPendente = categorias.some(cat => !(cat in avaliacoesDocs));
        if (algumNao) {
            chip.className   = 'cred-chip-inabilitado';
            chip.textContent = 'Inabilitado(a)';
        } else if (algumPendente) {
            chip.className   = 'cred-chip-avaliacao';
            chip.textContent = 'Em avaliação';
        } else {
            chip.className   = 'cred-chip-habilitado';
            chip.textContent = 'Habilitado(a)';
        }
    }

    /**
     * Reseta o estado por candidato (campos do formulário e variáveis).
     */
    function resetarEstadoCandidato() {
        funcoesSelecionadas = [];
        regioesSelecionadas = [];
        cpfDigitos = '';
        rgDigitos = '';
        nacionalidade = 'brasileira';
        estadoCivil = '';
        celularDigitos = '';
        email = '';
        dadosExtraidos = null;
        avaliacoesDocs = {};
        atualizarChipHabilitacao();

        cep = ''; logradouro = ''; numero = ''; bairro = ''; cidade = '';
        bancoNome = ''; bancoCOMPE = ''; chavePix = ''; pisDigitos = '';

        const cpfEl = document.getElementById('cred-cpf');
        const rgEl = document.getElementById('cred-rg');
        const nacEl = document.getElementById('cred-nacionalidade');
        const celularEl = document.getElementById('cred-celular');
        const emailEl = document.getElementById('cred-email');
        const cepEl = document.getElementById('cred-cep');
        const logradouroEl = document.getElementById('cred-logradouro');
        const numeroEl = document.getElementById('cred-numero');
        const bairroEl = document.getElementById('cred-bairro');
        const cidadeEl = document.getElementById('cred-cidade');
        const bancoInputEl = document.getElementById('cred-banco-input');
        const pixElReset  = document.getElementById('cred-chavepix');
        const nomeEl = document.getElementById('cred-nome-input');
        const protEl = document.getElementById('cred-res-prot');
        const dataEl = document.getElementById('cred-res-data');

        if (cpfEl) cpfEl.value = '';
        if (rgEl) rgEl.value = '';
        if (nacEl) nacEl.value = 'brasileira';
        if (celularEl) celularEl.value = '';
        if (emailEl) emailEl.value = '';
        if (cepEl) cepEl.value = '';
        if (logradouroEl) logradouroEl.value = '';
        if (numeroEl) numeroEl.value = '';
        if (bairroEl) bairroEl.value = '';
        if (cidadeEl) cidadeEl.value = '';
        if (bancoInputEl) bancoInputEl.value = '';
        if (pixElReset) pixElReset.value = '';
        const pisElReset = document.getElementById('cred-pis');
        if (pisElReset) pisElReset.value = '';
        if (nomeEl) nomeEl.value = '';
        if (protEl) protEl.innerText = '\u2014';
        if (dataEl) dataEl.innerText = '\u2014';

        const nomeConfirmadoEl = document.getElementById('cred-nome-confirmado');
        if (nomeConfirmadoEl) nomeConfirmadoEl.checked = false;

        const modal = document.getElementById('modal_aprovacao_anexos');
        if (modal) {
            modal.querySelectorAll('.cred-toggle-btn, .cred-estadocivil-btn').forEach(b => {
                b.classList.remove('active');
                const icon = b.querySelector('i');
                if (icon) icon.className = 'icon-check-empty';
            });
            modal.querySelectorAll('.cred-simnao-btn').forEach(btn => {
                btn.classList.remove('inativo');
            });
        }
        concluido = false;
        cicloAtual = '';
        atualizarBotaoConcluir();
    }

    /**
     * Congela todos os campos do modal (modo somente-leitura após conclusão).
     * Troca o botão para "Copiar" e injeta o botão "Editar" amarelo.
     */
    function ativarModoCongelado() {
        concluido = true;
        const modal = document.getElementById('modal_aprovacao_anexos');
        if (!modal) return;

        // Desabilitar inputs e botões interativos do formulário
        modal.querySelectorAll(
            '#cred-form-container input, #cred-nome-input, #cred-nome-confirmado'
        ).forEach(el => { el.disabled = true; });
        modal.querySelectorAll(
            '.cred-toggle-btn, .cred-estadocivil-btn, .cred-simnao-btn'
        ).forEach(btn => { btn.disabled = true; });

        // Ajustar botão principal: "Copiar" verde
        const btnEx = document.getElementById('cred-btn-executar');
        if (btnEx) {
            btnEx.textContent = 'Copiar';
            btnEx.classList.remove('cred-incompleto');
            btnEx.disabled = false;
        }

        // Injetar botão "Editar" se ainda não existir
        if (!document.getElementById('cred-btn-editar')) {
            const btnEditar = document.createElement('button');
            btnEditar.id = 'cred-btn-editar';
            btnEditar.className = 'btn';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', desativarModoCongelado);
            btnEx.parentNode.insertBefore(btnEditar, btnEx);
        }
    }

    /**
     * Descongela os campos e restaura o fluxo normal de edição.
     */
    function desativarModoCongelado() {
        concluido = false;
        const modal = document.getElementById('modal_aprovacao_anexos');
        if (!modal) return;

        // Re-habilitar inputs e botões
        modal.querySelectorAll(
            '#cred-form-container input, #cred-nome-input, #cred-nome-confirmado'
        ).forEach(el => { el.disabled = false; });
        modal.querySelectorAll(
            '.cred-toggle-btn, .cred-estadocivil-btn, .cred-simnao-btn'
        ).forEach(btn => { btn.disabled = false; });

        // Remover botão "Editar"
        const btnEditar = document.getElementById('cred-btn-editar');
        if (btnEditar) btnEditar.remove();

        // Restaurar botão principal: "Concluir e copiar"
        const btnEx = document.getElementById('cred-btn-executar');
        if (btnEx) {
            btnEx.textContent = 'Concluir e copiar';
            atualizarBotaoConcluir();
        }
        // Salvar progresso sem a flag concluido
        salvarProgresso();
    }

    // ==========================================
    // 4B. PERSISTÊNCIA DE PROGRESSO (localStorage)
    // ==========================================

    /**
     * Salva o estado atual do formulário no localStorage.
     * Usa o protocolo como chave. Só opera se dadosExtraidos existir.
     */
    function salvarProgresso() {
        if (!dadosExtraidos || !dadosExtraidos.protocolo) return;
        const nomeEl = document.getElementById('cred-nome-input');
        const nomeConfEl = document.getElementById('cred-nome-confirmado');
        const dados = {
            ts: Date.now(),
            concluido: concluido,
            candidato: nomeEl ? nomeEl.value : '',
            nomeConfirmado: nomeConfEl ? nomeConfEl.checked : false,
            cpf: cpfDigitos,
            rg: rgDigitos,
            nacionalidade: nacionalidade,
            estadoCivil: estadoCivil,
            celular: celularDigitos,
            email: email,
            cep: cep,
            logradouro: logradouro,
            numero: numero,
            bairro: bairro,
            cidade: cidade,
            bancoNome: bancoNome,
            bancoCOMPE: bancoCOMPE,
            chavePix: chavePix,
            pis: pisDigitos,
            funcoes: funcoesSelecionadas.slice(),
            regioes: regioesSelecionadas.slice(),
            avaliacoesDocs: Object.assign({}, avaliacoesDocs),
        };
        try {
            localStorage.setItem(PROGRESSO_PREFIX + dadosExtraidos.protocolo, JSON.stringify(dados));
        } catch (_) { /* localStorage cheio — ignora silenciosamente */ }
    }

    /**
     * Retorna true se todos os campos obrigatórios estiverem preenchidos (verificação silenciosa).
     */
    function _estaCompleto() {
        if (concluido) return true;
        if (!document.getElementById('cred-nome-confirmado')?.checked) return false;
        if (cpfDigitos.length !== 11) return false;
        if (rgDigitos.length < 8 || (rgDigitos.length > 9 && rgDigitos !== cpfDigitos)) return false;
        if (!estadoCivil) return false;
        if (cep.length !== 8) return false;
        if (!logradouro.trim()) return false;
        if (!numero.trim()) return false;
        if (!bairro.trim()) return false;
        if (!cidade.trim()) return false;
        if (celularDigitos.length < 10) return false;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
        if (!bancoNome.trim()) return false;
        if (!(document.getElementById('cred-chavepix')?.value.trim())) return false;
        if (pisDigitos.length !== 11) return false;
        if (funcoesSelecionadas.length === 0) return false;
        if (regioesSelecionadas.length === 0) return false;
        const modal = document.getElementById('modal_aprovacao_anexos');
        const grupos = modal ? Array.from(modal.querySelectorAll('.cred-simnao-group')) : [];
        if (grupos.some(g => !(g.dataset.categoria in avaliacoesDocs))) return false;
        return true;
    }

    /**
     * Atualiza a aparência do botão "Concluir e copiar" conforme o preenchimento.
     * Verde (#006600) = completo; cinza = incompleto mas ainda clicável.
     */
    function atualizarBotaoConcluir() {
        const btn = document.getElementById('cred-btn-executar');
        if (!btn || btn.disabled) return;
        const completo = _estaCompleto();
        if (completo) {
            btn.classList.remove('cred-incompleto');
        } else {
            btn.classList.add('cred-incompleto');
        }
        // Botão Dúvida: visível apenas enquanto o preenchimento não está completo
        const btnDuvida = document.getElementById('cred-btn-duvida');
        if (btnDuvida) btnDuvida.style.display = completo ? 'none' : '';
    }

    /**
     * Agenda salvamento com debounce (300ms). Chamado pelos event listeners.
     */
    function agendarSalvarProgresso() {
        clearTimeout(_salvarProgressoTimer);
        _salvarProgressoTimer = setTimeout(salvarProgresso, 300);
        atualizarBotaoConcluir();
    }

    /**
     * Busca progresso salvo para um protocolo. Retorna objeto ou null.
     */
    function carregarProgresso(protocolo) {
        try {
            const raw = localStorage.getItem(PROGRESSO_PREFIX + protocolo);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    /**
     * Remove o progresso salvo de um protocolo.
     */
    function limparProgresso(protocolo) {
        try { localStorage.removeItem(PROGRESSO_PREFIX + protocolo); } catch (_) {}
    }

    /**
     * Restaura o estado do formulário a partir de um objeto de progresso salvo.
     * Popula variáveis JS e elementos do DOM (inputs, toggles, botões Sim/Não).
     * Campos vazios no progresso NÃO sobrescrevem valores auto-extraídos.
     */
    function restaurarProgresso(dados) {
        if (!dados) return;

        // --- Variáveis JS (só sobrescreve se valor salvo não for vazio) ---
        if (dados.cpf)            cpfDigitos = dados.cpf;
        if (dados.rg)             rgDigitos = dados.rg;
        if (dados.nacionalidade)  nacionalidade = dados.nacionalidade;
        if (dados.estadoCivil)    estadoCivil = dados.estadoCivil;
        if (dados.celular)        celularDigitos = dados.celular;
        if (dados.email)          email = dados.email;
        if (dados.cep)            cep = dados.cep;
        if (dados.logradouro)     logradouro = dados.logradouro;
        if (dados.numero)         numero = dados.numero;
        if (dados.bairro)         bairro = dados.bairro;
        if (dados.cidade)         cidade = dados.cidade;
        if (dados.bancoNome)      bancoNome = dados.bancoNome;
        if (dados.bancoCOMPE)     bancoCOMPE = dados.bancoCOMPE;
        if (dados.chavePix)       chavePix = dados.chavePix;
        if (dados.pis)            pisDigitos = dados.pis;
        if (dados.funcoes && dados.funcoes.length)  funcoesSelecionadas = dados.funcoes.slice();
        if (dados.regioes && dados.regioes.length)  regioesSelecionadas = dados.regioes.slice();
        if (dados.avaliacoesDocs && Object.keys(dados.avaliacoesDocs).length) {
            avaliacoesDocs = Object.assign({}, dados.avaliacoesDocs);
        }

        // --- DOM: campos de texto ---
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

        // CPF formatado
        if (cpfDigitos) {
            const d = cpfDigitos;
            let fmt = d;
            if (d.length > 9)      fmt = d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);
            else if (d.length > 6) fmt = d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6);
            else if (d.length > 3) fmt = d.slice(0,3)+'.'+d.slice(3);
            setVal('cred-cpf', fmt);
        }
        // RG formatado
        if (rgDigitos) {
            const d = rgDigitos;
            let fmt = d;
            if (d.length === 11)   fmt = d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);
            else if (d.length > 8) fmt = d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'-'+d.slice(8);
            else if (d.length > 5) fmt = d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5);
            else if (d.length > 2) fmt = d.slice(0,2)+'.'+d.slice(2);
            setVal('cred-rg', fmt);
        }
        setVal('cred-nacionalidade', nacionalidade);
        if (celularDigitos) setVal('cred-celular', formatarCelular(celularDigitos));
        setVal('cred-email', email);
        if (cep) setVal('cred-cep', cep.length > 5 ? cep.slice(0,5)+'-'+cep.slice(5) : cep);
        setVal('cred-logradouro', logradouro);
        setVal('cred-numero', numero);
        setVal('cred-bairro', bairro);
        setVal('cred-cidade', cidade);
        setVal('cred-banco-input', bancoNome);
        if (chavePix) {
            // Mostrar formatado se for CPF puro de 11 dígitos
            const pixDisplay = /^\d{11}$/.test(chavePix)
                ? chavePix.slice(0,3)+'.'+chavePix.slice(3,6)+'.'+chavePix.slice(6,9)+'-'+chavePix.slice(9)
                : chavePix;
            setVal('cred-chavepix', pixDisplay);
        }
        // PIS/PASEP formatado
        if (pisDigitos) {
            const pd = pisDigitos;
            let pfmt = pd;
            if (pd.length > 10)     pfmt = pd.slice(0,3)+'.'+pd.slice(3,8)+'.'+pd.slice(8,10)+'-'+pd.slice(10);
            else if (pd.length > 8) pfmt = pd.slice(0,3)+'.'+pd.slice(3,8)+'.'+pd.slice(8);
            else if (pd.length > 3) pfmt = pd.slice(0,3)+'.'+pd.slice(3,8);
            setVal('cred-pis', pfmt);
        }
        if (dados.candidato) setVal('cred-nome-input', dados.candidato);
        const nomeConfEl = document.getElementById('cred-nome-confirmado');
        if (nomeConfEl && dados.nomeConfirmado) nomeConfEl.checked = true;

        // --- DOM: botões toggle de estado civil ---
        const modal = document.getElementById('modal_aprovacao_anexos');
        if (modal && estadoCivil) {
            modal.querySelectorAll('.cred-estadocivil-btn').forEach(b => {
                if (b.dataset.estado === estadoCivil) {
                    b.classList.add('active');
                    b.querySelector('i').className = 'icon-white icon-check';
                } else {
                    b.classList.remove('active');
                    b.querySelector('i').className = 'icon-check-empty';
                }
            });
        }

        // --- DOM: botões toggle função ---
        if (modal && funcoesSelecionadas.length) {
            modal.querySelectorAll('.cred-toggle-btn[data-funcao]').forEach(btn => {
                if (funcoesSelecionadas.includes(btn.dataset.funcao)) {
                    btn.classList.add('active');
                    btn.querySelector('i').className = 'icon-white icon-check';
                } else {
                    btn.classList.remove('active');
                    btn.querySelector('i').className = 'icon-check-empty';
                }
            });
        }

        // --- DOM: botões toggle regiões ---
        if (modal && regioesSelecionadas.length) {
            modal.querySelectorAll('.cred-toggle-btn[data-regiao]').forEach(btn => {
                const r = parseInt(btn.dataset.regiao);
                if (regioesSelecionadas.includes(r)) {
                    btn.classList.add('active');
                    btn.querySelector('i').className = 'icon-white icon-check';
                } else {
                    btn.classList.remove('active');
                    btn.querySelector('i').className = 'icon-check-empty';
                }
            });
        }

        // --- DOM: botões Sim/Não por categoria ---
        if (modal && Object.keys(avaliacoesDocs).length) {
            modal.querySelectorAll('.cred-simnao-group').forEach(grupo => {
                const cat = grupo.dataset.categoria;
                if (!(cat in avaliacoesDocs)) return;
                const [btnSim, btnNao] = grupo.querySelectorAll('.cred-simnao-btn');
                if (avaliacoesDocs[cat] === true) {
                    btnSim.classList.remove('inativo');
                    btnNao.classList.add('inativo');
                } else if (avaliacoesDocs[cat] === false) {
                    btnNao.classList.remove('inativo');
                    btnSim.classList.add('inativo');
                }
            });
        }

        atualizarChipHabilitacao();
        if (dados.concluido) {
            ativarModoCongelado();
        } else {
            atualizarBotaoConcluir();
        }

        // --- Toast de feedback ---
        const modalFooter = document.querySelector('#modal_aprovacao_anexos .modal-footer');
        const btnCopiar = document.getElementById('cred-btn-executar');
        if (modalFooter && btnCopiar && !modalFooter.querySelector('.cred-toast-restaurado')) {
            const toast = document.createElement('div');
            toast.className = 'cred-toast-restaurado';
            toast.innerHTML = '<span>Progresso restaurado.</span>';
            const btnDescartar = document.createElement('button');
            btnDescartar.textContent = 'Descartar';
            btnDescartar.addEventListener('click', () => {
                if (dadosExtraidos) limparProgresso(dadosExtraidos.protocolo);
                removerMarcadoresCredenciamento();
                toast.remove();
                if (concluido) desativarModoCongelado();
                resetarEstadoCandidato();
                if (isPaginaProtocolo()) executarFluxo();
            });
            toast.appendChild(btnDescartar);
            const btnEditar = document.getElementById('cred-btn-editar');
            const anchorBtn = btnEditar || btnCopiar;
            modalFooter.insertBefore(toast, anchorBtn);
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8000);
        }
    }

    /**
     * Remove entradas de progresso mais antigas que PROGRESSO_TTL_DIAS.
     */
    function limparProgressoAntigo() {
        const limite = Date.now() - (PROGRESSO_TTL_DIAS * 24 * 60 * 60 * 1000);
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(PROGRESSO_PREFIX)) continue;
            try {
                const dados = JSON.parse(localStorage.getItem(key));
                if (dados && dados.ts && dados.ts < limite) keysToRemove.push(key);
            } catch (_) { keysToRemove.push(key); }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
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

            if (autoMarcador) {
                const membroExistente = credenciadorJaAplicado();
                if (membroExistente) {
                    // Marcador de credenciadora já aplicado: preservar e sincronizar UI
                    if (membroExistente !== credenciadoraSalva) {
                        credenciadoraSalva = membroExistente;
                        localStorage.setItem('1doc_cred_nome', credenciadoraSalva);
                        const modalEl = document.getElementById('modal_aprovacao_anexos');
                        if (modalEl) modalEl.querySelectorAll('.cred-opt-btn').forEach(b =>
                            b.classList.toggle('active', b.dataset.nome === credenciadoraSalva));
                    }
                } else {
                    trocarMarcador(credenciadoraSalva);
                }
                aplicarMarcadorCiclo(dataEnvio);
            }

            dadosExtraidos = { protocolo, url, candidato, dataEnvio };

            // Tentar extrair celular e e-mail da primeira mensagem do protocolo
            const mediaText = document.querySelector('.media-body .media-text');
            if (mediaText) {
                const telEl = mediaText.querySelector('.ind_tel');
                if (telEl) {
                    const digits = telEl.textContent.replace(/\D/g, '').slice(0, 11);
                    if (digits.length >= 10) {
                        celularDigitos = digits;
                        const celEl = document.getElementById('cred-celular');
                        if (celEl) celEl.value = formatarCelular(digits);
                    }
                }
                const cloneMedia = mediaText.cloneNode(true);
                cloneMedia.querySelectorAll('span').forEach(s => s.remove());
                const emailMatch = cloneMedia.textContent.trim().match(/\S+@\S+\.\S+/);
                if (emailMatch) {
                    email = emailMatch[0];
                    const emailEl = document.getElementById('cred-email');
                    if (emailEl) emailEl.value = email;
                }
            }

            document.getElementById('cred-res-prot').innerText = protocolo;
            document.getElementById('cred-res-data').innerText = dataEnvio || '(não encontrada)';
            document.getElementById('cred-nome-input').value = candidato;

            btnExecutar.textContent = 'Concluir e copiar';
            btnExecutar.disabled = false;
            atualizarBotaoConcluir();
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

    /**
     * Exibe uma mensagem de erro vermelha dentro da seção do campo informado e
     * rola o modal para que o erro fique visível.
     */
    function mostrarErroValidacao(campoId, mensagem) {
        const campo = document.getElementById(campoId);
        if (!campo) return;
        const secao = campo.closest('.cred-form-section') || campo.parentElement;
        const erro = document.createElement('div');
        erro.className = 'cred-alert-erro';
        erro.textContent = mensagem;
        secao.appendChild(erro);
        erro.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Retorna o texto legível do label de uma categoria a partir do elemento .cred-simnao-group.
     * - Categoria I (movida para .cred-ficha-section): lê label.cred-section-label
     * - Demais categorias: lê a primeira <td> da linha externa da tabela principal
     */
    function getCategoriaLabel(grupo) {
        const fichaSection = grupo.closest('.cred-ficha-section');
        if (fichaSection) {
            const lbl = fichaSection.querySelector('.cred-section-label');
            return lbl ? lbl.textContent.trim() : grupo.dataset.categoria;
        }
        const outerTr = grupo.closest('table')?.closest('td')?.closest('tr');
        if (outerTr?.cells[0]) {
            return outerTr.cells[0].textContent.trim().replace(/\s+/g, ' ');
        }
        return grupo.dataset.categoria;
    }

    /**
     * Exibe o erro de validação dos botões Sim/Não e rola até o primeiro grupo pendente.
     * Insere o alerta na seção mais próxima fora da estrutura de tabela.
     */
    function mostrarErroBotoes(primeiroGrupo, mensagem) {
        const erro = document.createElement('div');
        erro.className = 'cred-alert-erro';
        erro.textContent = mensagem;
        const fichaSection = primeiroGrupo.closest('.cred-ficha-section');
        if (fichaSection) {
            fichaSection.appendChild(erro);
        } else {
            const listaDiv = primeiroGrupo.closest('.div_lista_aprovacao_anexos');
            if (listaDiv) listaDiv.insertBefore(erro, listaDiv.firstChild);
        }
        primeiroGrupo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Valida os campos obrigatórios antes de copiar.
     * Retorna true se tudo estiver OK; false e exibe o primeiro erro caso contrário.
     */
    function validarFormulario() {
        const checkNome = document.getElementById('cred-nome-confirmado');
        if (!checkNome || !checkNome.checked) {
            const nomeRow = checkNome
                ? checkNome.closest('.cred-info-nome-row')
                : document.querySelector('.cred-info-nome-row');
            if (nomeRow) {
                const erro = document.createElement('div');
                erro.className = 'cred-alert-erro';
                erro.textContent = 'Confirme que o nome do candidato coincide com a ficha de inscrição antes de continuar.';
                nomeRow.appendChild(erro);
            }
            return false;
        }
        if (cpfDigitos.length !== 11) {
            mostrarErroValidacao('cred-cpf', 'Preencha o CPF completo do candidato (11 dígitos) antes de continuar.');
            return false;
        }
        if (rgDigitos.length < 8 || (rgDigitos.length > 9 && rgDigitos !== cpfDigitos)) {
            mostrarErroValidacao('cred-rg', rgDigitos.length > 9
                ? 'RG com mais de 9 dígitos só é aceito quando igual ao CPF (CPF no lugar de RG).'
                : 'Preencha o RG do candidato.');
            return false;
        }
        if (!estadoCivil) {
            mostrarErroValidacao('cred-estadocivil-group', 'Selecione o estado civil do candidato.');
            return false;
        }
        if (cep.length !== 8) {
            mostrarErroValidacao('cred-cep', 'Preencha o CEP completo (8 dígitos).');
            return false;
        }
        if (!logradouro.trim()) {
            mostrarErroValidacao('cred-logradouro', 'Preencha o logradouro.');
            return false;
        }
        if (!numero.trim()) {
            mostrarErroValidacao('cred-numero', 'Preencha o número do endereço.');
            return false;
        }
        if (!bairro.trim()) {
            mostrarErroValidacao('cred-bairro', 'Preencha o bairro.');
            return false;
        }
        if (!cidade.trim()) {
            mostrarErroValidacao('cred-cidade', 'Preencha a cidade.');
            return false;
        }
        if (celularDigitos.length < 10) {
            mostrarErroValidacao('cred-celular', 'Preencha o celular do candidato.');
            return false;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostrarErroValidacao('cred-email', 'Preencha um e-mail válido.');
            return false;
        }
        if (!bancoNome.trim()) {
            mostrarErroValidacao('cred-banco-input', 'Preencha o nome do banco.');
            return false;
        }
        const pixValV = document.getElementById('cred-chavepix')?.value.trim();
        if (!pixValV) {
            mostrarErroValidacao('cred-chavepix', 'Preencha a Chave Pix.');
            return false;
        }
        if (pisDigitos.length !== 11) {
            mostrarErroValidacao('cred-pis', 'Preencha o PIS/PASEP/NIT/NIS completo (11 dígitos).');
            return false;
        }
        if (funcoesSelecionadas.length === 0) {
            mostrarErroValidacao('cred-funcao-group', 'Selecione ao menos uma Função pretendida antes de continuar.');
            return false;
        }
        if (regioesSelecionadas.length === 0) {
            mostrarErroValidacao('cred-regiao-group', 'Selecione ao menos uma Região Escolar antes de continuar.');
            return false;
        }
        const modal = document.getElementById('modal_aprovacao_anexos');
        const grupos = modal ? Array.from(modal.querySelectorAll('.cred-simnao-group')) : [];
        const pendentes = grupos.filter(g => !(g.dataset.categoria in avaliacoesDocs));
        if (pendentes.length > 0) {
            const nomes = pendentes.map(getCategoriaLabel);
            const msg = pendentes.length === 1
                ? `Clique no botão "Sim" ou "Não" de cada documento para informar se é válido. Pendente: ${nomes[0]}.`
                : `Clique no botão "Sim" ou "Não" de cada documento para informar se é válido. Pendentes: ${nomes.join('; ')}.`;
            mostrarErroBotoes(pendentes[0], msg);
            return false;
        }
        return true;
    }

    /**
     * Verifica se algum marcador de credenciadora (EQUIPE) já está aplicado no protocolo.
     * Lê os <option selected> do #marcadores_ids. Retorna o nome do membro ou null.
     */
    function credenciadorJaAplicado() {
        const sel = document.getElementById('marcadores_ids');
        if (!sel) return null;
        for (const opt of sel.options) {
            if (!opt.selected) continue;
            const texto = opt.text.toUpperCase();
            for (const membro of EQUIPE) {
                if (texto.includes(membro.toUpperCase())) return membro;
            }
        }
        return null;
    }

    /**
     * Exibe um dialog perguntando se os marcadores devem ser aplicados.
     * Resolve com 'aplicar', 'nao-aplicar' ou 'voltar'.
     */
    function mostrarDialogMarcadores() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'cred-dialog-marcadores';
            overlay.innerHTML = `
                <div class="cred-dialog-box">
                    <div class="cred-dialog-title">&#9888; Marcadores automáticos desativados</div>
                    <div class="cred-dialog-body">
                        O checkbox <strong>"Aplicar marcador automaticamente"</strong> está desmarcado.<br><br>
                        Deseja aplicar os marcadores <strong>Credenciador(a)</strong>, <strong>Ciclo</strong>, <strong>Habilitado/Inabilitado</strong> e <strong>Conferido</strong> no protocolo ao concluir?
                    </div>
                    <div class="cred-dialog-footer">
                        <button class="btn btn-success" id="cred-dialog-aplicar">Aplicar marcadores</button>
                        <button class="btn" id="cred-dialog-nao-aplicar">Não aplicar</button>
                        <button class="btn btn-danger" id="cred-dialog-voltar">Voltar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            const fechar = (resultado) => { overlay.remove(); resolve(resultado); };
            document.getElementById('cred-dialog-aplicar').addEventListener('click', () => fechar('aplicar'));
            document.getElementById('cred-dialog-nao-aplicar').addEventListener('click', () => fechar('nao-aplicar'));
            document.getElementById('cred-dialog-voltar').addEventListener('click', () => fechar('voltar'));
        });
    }

    async function copiarEFechar() {
        if (!dadosExtraidos) {
            await executarFluxo();
            return;
        }

        const btnExecutar = document.getElementById('cred-btn-executar');

        // --- MODO CONCLUÍDO: apenas copia para o clipboard ---
        if (concluido) {
            btnExecutar.disabled = true;
            try {
                await copiarParaPlanilha();
                window.open(PLANILHA_URL, 'cred-planilha');
            } catch (error) {
                console.error('Erro ao copiar dados:', error);
                alert('Erro ao copiar dados para a área de transferência.');
            } finally {
                btnExecutar.disabled = false;
            }
            return;
        }

        // --- MODO NORMAL: validar, aplicar marcadores, concluir ---
        document.querySelectorAll('.cred-alert-erro').forEach(el => el.remove());
        if (!validarFormulario()) return;

        // Se marcadores automáticos estão desativados, perguntar ao usuário
        let deveAplicarMarcadores = autoMarcador;
        if (!autoMarcador) {
            const escolha = await mostrarDialogMarcadores();
            if (escolha === 'voltar') return;
            deveAplicarMarcadores = (escolha === 'aplicar');
        }

        btnExecutar.disabled = true;

        try {
            // 1. Aplicar marcadores de credenciadora, ciclo, resultado e conferido
            const algumNao = Object.values(avaliacoesDocs).includes(false);
            if (deveAplicarMarcadores) {
                trocarMarcador(credenciadoraSalva);
                if (dadosExtraidos.dataEnvio) aplicarMarcadorCiclo(dadosExtraidos.dataEnvio);
                aplicarMarcadorResultado(algumNao ? 'Inabilitado' : 'Habilitado');
            }

            // 2. Copiar conteúdo para o clipboard
            await copiarParaPlanilha();

            // 3. Aplicar marcador Conferido
            if (deveAplicarMarcadores) {
                aplicarMarcadorResultado('Conferido');
            }

            // 4. Marcar como concluído e salvar progresso
            concluido = true;
            salvarProgresso();

            // 5. Abrir planilha do credenciamento (reutiliza a aba se já estiver aberta)
            window.open(PLANILHA_URL, 'cred-planilha');

            // 6. Arquivar o protocolo (o 1Doc redireciona ao inbox automaticamente após a confirmação)
            const btnArquivar = document.querySelector('button.botao_flutuante_3.bf_v_3[title="Arquivar"]')
                             || document.querySelector('button[title="Arquivar"].botao_flutuante_3');
            if (btnArquivar) {
                btnArquivar.click();
                // Aguardar o dialog de confirmação (#sim) aparecer e clicar nele
                let tentativas = 0;
                const aguardarSim = setInterval(() => {
                    const btnSim = document.getElementById('sim');
                    if (btnSim) {
                        clearInterval(aguardarSim);
                        btnSim.click();
                    } else if (++tentativas >= 50) { // timeout 5s
                        clearInterval(aguardarSim);
                        console.warn('[credenciamento] Dialog de confirmação do Arquivar não apareceu.');
                        window.location.href = 'https://pindamonhangaba.1doc.com.br/?pg=painel/listar&meu=0&trocar=1';
                    }
                }, 100);
            } else {
                // Fallback: botão Arquivar não encontrado, navegar ao inbox diretamente
                console.warn('[credenciamento] Botão Arquivar não encontrado — navegando ao inbox.');
                window.location.href = 'https://pindamonhangaba.1doc.com.br/?pg=painel/listar&meu=0&trocar=1';
            }
        } catch (error) {
            console.error('Erro ao copiar dados:', error);
            alert('Erro ao copiar dados para a área de transferência.');
            btnExecutar.disabled = false;
            btnExecutar.focus();
        }
    }

    async function copiarParaPlanilha() {
        const { dataEnvio, protocolo, url } = dadosExtraidos;
        const candidato = document.getElementById('cred-nome-input').value.trim() || dadosExtraidos.candidato;

        // Funções: mapeamento interno → planilha
        const mapFuncoes = { 'Ed. Básica': 'Educação Básica', 'Ed. Física': 'Educação Física', 'Artes': 'Artes' };
        const colF = funcoesSelecionadas.includes('Ed. Básica') ? mapFuncoes['Ed. Básica'] : '';
        const colG = funcoesSelecionadas.includes('Ed. Física') ? mapFuncoes['Ed. Física'] : '';
        const colH = funcoesSelecionadas.includes('Artes')      ? mapFuncoes['Artes']      : '';

        // Regiões: número se selecionado, vazio se não
        const colRegioes = [1, 2, 3, 4, 5].map(n => regioesSelecionadas.includes(n) ? String(n) : '');

        // Documentos: true→"sim", false→"não", ausente→""
        const catsDocs = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
        const colDocs = catsDocs.map(cat => {
            if (avaliacoesDocs[cat] === true)  return 'sim';
            if (avaliacoesDocs[cat] === false) return 'não';
            return '';
        });

        // Resultado: inabilitado se algum false, habilitado se todos avaliados são true
        const valores = Object.values(avaliacoesDocs);
        const resultado = valores.includes(false) ? 'inabilitado' : 'habilitado';

        // Montar array de 40 posições (0–39) → colunas A–AN
        const cells = [
            dataEnvio,              // 0  A
            protocolo,              // 1  B (texto no plain, hyperlink no html)
            credenciadoraSalva,     // 2  C
            candidato,              // 3  D
            cpfDigitos,             // 4  E
            rgDigitos,              // 5  F
            nacionalidade,          // 6  G
            estadoCivil,            // 7  H
            '',                     // 8  I  — Etnia (campo reservado)
            cep,                    // 9  J
            logradouro,             // 10 K
            numero,                 // 11 L
            bairro,                 // 12 M
            cidade,                 // 13 N
            email,                  // 14 O
            celularDigitos,         // 15 P
            bancoNome,              // 16 Q
            chavePix,               // 17 R
            pisDigitos,             // 18 S  — PIS/PASEP/NIT/NIS
            colF,                   // 19 T  — Educação Básica
            colG,                   // 20 U  — Educação Física
            colH,                   // 21 V  — Artes
            ...colRegioes,          // 22–26 W–AA (5 regiões)
            ...colDocs,             // 27–37 AB–AL (XI docs = 11 cols)
            resultado,              // 38 AM
            cicloAtual              // 39 AN
        ];

        // text/plain: tabs separando valores, protocolo sem URL
        const textData = cells.join('\t');

        // text/html: tabela para o Google Planilhas, protocolo como hyperlink
        const htmlCells = cells.map((val, i) => {
            if (i === 1 && url) return `<td><a href="${url}">${val}</a></td>`;
            return `<td>${val}</td>`;
        }).join('');
        const htmlData = `<table><tr>${htmlCells}</tr></table>`;

        const blobHtml = new Blob([htmlData], { type: 'text/html' });
        const blobText = new Blob([textData], { type: 'text/plain' });

        await navigator.clipboard.write([new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
        })]);
    }

    /**
     * Remove todos os marcadores de credenciadoras (EQUIPE) e de status
     * (Habilitado, Inabilitado, Conferido) do select2 #marcadores_ids.
     * Usado pelo botão "Descartar" do toast de progresso restaurado.
     */
    function removerMarcadoresCredenciamento() {
        const nomesRemover = EQUIPE.map(n => n.toUpperCase())
            .concat(['HABILITADO', 'INABILITADO', 'CONFERIDO']);
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                    var selectObj = $('#marcadores_ids');
                    var nomesRemover = ${JSON.stringify(nomesRemover)};
                    var currentValues = (selectObj.val() || []).filter(function(v) {
                        var optText = selectObj.find('option[value="' + v + '"]').text().toUpperCase().trim();
                        return nomesRemover.indexOf(optText) === -1;
                    });
                    selectObj.val(currentValues).trigger('change');
                }
            })();
        `;
        document.body.appendChild(script);
        script.remove();
    }

    /**
     * Adiciona um marcador por nome no select2 #marcadores_ids.
     * Ao aplicar 'Habilitado', remove 'Inabilitado' e vice-versa.
     * 'Conferido' é sempre acrescido sem remoções.
     */
    function aplicarMarcadorResultado(nome) {
        const nomeUp = nome.toUpperCase();
        const opostoUp = nomeUp === 'HABILITADO' ? 'INABILITADO'
                       : nomeUp === 'INABILITADO' ? 'HABILITADO'
                       : null;
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                    var selectObj = $('#marcadores_ids');
                    var nomeUp = ${JSON.stringify(nomeUp)};
                    var opostoUp = ${JSON.stringify(opostoUp)};

                    // Remover marcador oposto (Habilitado ↔ Inabilitado)
                    var currentValues = (selectObj.val() || []).filter(function(v) {
                        if (!opostoUp) return true;
                        var optText = selectObj.find('option[value="' + v + '"]').text().toUpperCase().trim();
                        return optText !== opostoUp;
                    });

                    // Adicionar o marcador pelo nome (correspondência exata após trim)
                    selectObj.find('option').each(function() {
                        if ($(this).text().toUpperCase().trim() === nomeUp) {
                            var val = $(this).attr('value');
                            if (currentValues.indexOf(val) === -1) currentValues.push(val);
                        }
                    });

                    selectObj.val(currentValues).trigger('change');
                }
            })();
        `;
        document.body.appendChild(script);
        script.remove();
    }

    /**
     * Calcula o ciclo do protocolo com base em dataEnvio ("DD/MM/YYYY HH:MM") e
     * aplica o marcador correspondente ("— 01" a "— 10") no select2 #marcadores_ids.
     * Só altera o select2 se o marcador correto ainda não estiver selecionado.
     */
    function aplicarMarcadorCiclo(dataEnvio) {
        if (!dataEnvio) return;

        const partes = dataEnvio.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!partes) {
            console.warn('[credenciamento] aplicarMarcadorCiclo: formato de data inesperado:', dataEnvio);
            cicloAtual = '';
            return;
        }
        const dia = parseInt(partes[1], 10);
        const mes = parseInt(partes[2], 10);
        const ano = parseInt(partes[3], 10);
        const dataParsed = new Date(ano, mes - 1, dia);

        let novoCiclo = '';
        for (const c of CICLOS) {
            if (dataParsed >= c.inicio && dataParsed <= c.fim) {
                novoCiclo = c.num;
                break;
            }
        }

        if (!novoCiclo) {
            console.warn('[credenciamento] aplicarMarcadorCiclo: data fora dos ciclos definidos:', dataEnvio);
            cicloAtual = '';
            return;
        }

        cicloAtual = novoCiclo;
        const todosCiclos = ['01','02','03','04','05','06','07','08','09','10'];
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                    var selectObj = $('#marcadores_ids');
                    var novoCiclo = ${JSON.stringify(novoCiclo)};
                    var todosCiclos = ${JSON.stringify(todosCiclos)};

                    // Verificar se o marcador correto já está selecionado
                    var currentValues = selectObj.val() || [];
                    var targetOption = selectObj.find('option').filter(function() {
                        return $(this).text().indexOf('\u2014 ' + novoCiclo) > -1;
                    });
                    if (targetOption.length > 0 && currentValues.indexOf(targetOption.attr('value')) > -1) {
                        return; // já aplicado, não fazer nada
                    }

                    // Remover outros marcadores de ciclo (01–10)
                    var valuesToRemove = [];
                    selectObj.find('option').each(function() {
                        var texto = $(this).text();
                        for (var i = 0; i < todosCiclos.length; i++) {
                            if (texto.indexOf('\u2014 ' + todosCiclos[i]) > -1) {
                                valuesToRemove.push($(this).attr('value'));
                                break;
                            }
                        }
                    });
                    var newValues = currentValues.filter(function(v) {
                        return valuesToRemove.indexOf(v) === -1;
                    });

                    // Adicionar o marcador do ciclo correto
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

    // Limpeza de progresso salvo com mais de 30 dias
    limparProgressoAntigo();

    const observerUI = new MutationObserver(() => { injetarBotao(); });
    observerUI.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        if (location.href !== ultimaUrl) {
            ultimaUrl = location.href;
            jaRodouNestaPagina = false;
            dadosExtraidos = null;
            funcoesSelecionadas = [];
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
                const fichaInscricao = document.getElementById('cred-ficha-inscricao');
                if (fichaInscricao) fichaInscricao.remove();
                const outrosAnexos = document.getElementById('cred-outros-anexos');
                if (outrosAnexos) outrosAnexos.remove();
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
