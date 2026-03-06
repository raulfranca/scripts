// ==UserScript==
// @name         1Doc - Colar na Planilha de Credenciamento
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Detecta quando a aba da planilha é focada e cola automaticamente os dados copiados do 1Doc.
// @author       Você
// @match        https://docs.google.com/spreadsheets/d/1OcFrOoA4DQqz1r9cOTKG7kDWyV5jX2xcMFJcf870qzY/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/sheets_paste.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/sheets_paste.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. CONFIGURAÇÕES E ESTADOS
    // ==========================================
    const GM_PENDING_KEY     = '1doc_cred_pending_paste';
    const EXPIRY_MS          = 5 * 60 * 1000; // Descarta dados com mais de 5 minutos
    const WAIT_CTRL_END      = 700;            // ms após Ctrl+End antes de ler o Name Box
    const WAIT_NAVIGATION    = 600;            // ms após Enter no Name Box antes de colar
    const WAIT_NAMEBOX_INPUT = 200;            // ms entre setar value e despachar Enter
    const SHEETS_LOAD_TIMEOUT = 12000;         // ms máximo para aguardar o Sheets carregar

    let _executando = false; // Guard contra execuções concorrentes

    // ==========================================
    // 2. ESTILOS CSS (Toast)
    // ==========================================
    GM_addStyle(`
        #sp-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            padding: 12px 20px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            color: #fff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
        }
        #sp-toast.show          { opacity: 1; transform: translateY(0); }
        #sp-toast.sp-info       { background: #2980b9; }
        #sp-toast.sp-sucesso    { background: #27ae60; }
        #sp-toast.sp-erro       { background: #c0392b; }
    `);

    // ==========================================
    // 3. FUNÇÕES UTILITÁRIAS
    // ==========================================
    let _toastTimer = null;

    function mostrarToast(msg, tipo = 'info') {
        let toast = document.getElementById('sp-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sp-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'show sp-' + tipo;
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, tipo === 'erro' ? 8000 : 4000);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Aguarda o Sheets carregar (Name Box presente = Sheets pronto)
    function esperarSheets() {
        return new Promise((resolve, reject) => {
            const inicio = Date.now();
            const poll = setInterval(() => {
                if (obterNameBox()) {
                    clearInterval(poll);
                    resolve();
                    return;
                }
                if (Date.now() - inicio > SHEETS_LOAD_TIMEOUT) {
                    clearInterval(poll);
                    reject(new Error('Timeout: Sheets não carregou a tempo.'));
                }
            }, 300);
        });
    }

    // Parseia um endereço de célula (ex: "C150") e retorna { col, row }
    function parsearCelula(valor) {
        const match = (valor || '').trim().match(/^([A-Za-z]+)(\d+)$/);
        if (!match) return null;
        return { col: match[1].toUpperCase(), row: parseInt(match[2], 10) };
    }

    // ==========================================
    // 4. NAVEGAÇÃO NA PLANILHA
    // ==========================================

    // Tenta obter o Name Box com 3 seletores em ordem de preferência
    function obterNameBox() {
        return (
            document.querySelector('.docs-name-box-input') ||
            document.querySelector('div.docs-name-box input[type="text"]') ||
            document.querySelector('input[aria-label*="Cell reference"]') ||
            document.querySelector('input[aria-label*="Referência de célula"]') ||
            null
        );
    }

    function despacharCtrlEnd() {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key:        'End',
            code:       'End',
            keyCode:    35,
            which:      35,
            ctrlKey:    true,
            bubbles:    true,
            cancelable: true
        }));
    }

    // Navega para um endereço de célula (ex: "A151") via Name Box
    async function navegarParaCelula(endereco) {
        const nomeBox = obterNameBox();
        if (!nomeBox) throw new Error('Name Box não encontrado');

        nomeBox.focus();
        nomeBox.select();
        nomeBox.value = endereco;

        // Dispara eventos de input/change para que o Sheets atualize o estado interno
        nomeBox.dispatchEvent(new Event('input',  { bubbles: true }));
        nomeBox.dispatchEvent(new Event('change', { bubbles: true }));

        await delay(WAIT_NAMEBOX_INPUT);

        // Enter no próprio input (não no document) confirma a navegação
        nomeBox.dispatchEvent(new KeyboardEvent('keydown', {
            key:        'Enter',
            code:       'Enter',
            keyCode:    13,
            which:      13,
            bubbles:    true,
            cancelable: true
        }));
        nomeBox.dispatchEvent(new KeyboardEvent('keyup', {
            key:     'Enter',
            code:    'Enter',
            keyCode: 13,
            bubbles: true
        }));
    }

    // Vai para a primeira linha vazia na coluna A usando Ctrl+End + Name Box
    async function navegarParaPrimeiraLinhaVazia() {
        // Passo 1: ir para a última célula usada na planilha
        despacharCtrlEnd();
        await delay(WAIT_CTRL_END);

        // Passo 2: ler o Name Box para saber a linha atual
        const nomeBox = obterNameBox();
        if (!nomeBox) throw new Error('Name Box não encontrado após Ctrl+End');

        const celAtual = parsearCelula(nomeBox.value);
        if (!celAtual) throw new Error(`Valor inesperado no Name Box: "${nomeBox.value}"`);

        // Passo 3: calcular a próxima linha vazia.
        // Se Ctrl+End voltou para a linha 1 (planilha vazia ou só cabeçalho), começamos na linha 2.
        const proximaLinha = celAtual.row === 1 ? 2 : celAtual.row + 1;

        // Passo 4: navegar para A{proximaLinha}
        await navegarParaCelula(`A${proximaLinha}`);
        await delay(WAIT_NAVIGATION);

        return proximaLinha;
    }

    // ==========================================
    // 5. COLAGEM DE DADOS (ClipboardEvent)
    // ==========================================

    // Sintetiza um paste event com DataTransfer — contorna a restrição de isTrusted do Ctrl+V
    function sintetizarPaste(htmlData, textData) {
        let dt;
        try {
            dt = new DataTransfer();
            dt.setData('text/html',  htmlData);
            dt.setData('text/plain', textData);
        } catch (e) {
            throw new Error('DataTransfer constructor não suportado: ' + e.message);
        }

        // Despachado em document — onde o Sheets registra seu handler de paste
        document.dispatchEvent(new ClipboardEvent('paste', {
            bubbles:       true,
            cancelable:    true,
            clipboardData: dt
        }));
    }

    function construirPayload(dados) {
        const { credenciadora, protocolo, url, candidato } = dados;
        const htmlData = `<table><tr><td>${credenciadora}</td><td><a href="${url}">${protocolo}</a></td><td>${candidato}</td></tr></table>`;
        const textData = `${credenciadora}\t${protocolo}\t${candidato}`;
        return { htmlData, textData };
    }

    // ==========================================
    // 6. FLUXO PRINCIPAL
    // ==========================================

    async function executarFluxoPaste(dados) {
        if (_executando) return;
        _executando = true;

        try {
            mostrarToast('Dados detectados. Navegando na planilha...', 'info');

            const linhaDestino = await navegarParaPrimeiraLinhaVazia();

            const { htmlData, textData } = construirPayload(dados);
            sintetizarPaste(htmlData, textData);

            // Limpa o flag imediatamente após o paste bem-sucedido
            GM_setValue(GM_PENDING_KEY, '');

            mostrarToast(`✔ Colado na linha ${linhaDestino}.`, 'sucesso');

        } catch (error) {
            console.error('[sheets_paste] Erro no fluxo de paste:', error);
            mostrarToast(
                'Erro ao colar automaticamente. Pressione Ctrl+V para colar manualmente.',
                'erro'
            );
            // Não limpa o flag em erro — Ctrl+V manual (clipboard do sistema) ainda funciona
        } finally {
            _executando = false;
        }
    }

    function verificarEExecutar() {
        const raw = GM_getValue(GM_PENDING_KEY, '');
        if (!raw) return;

        let dados;
        try {
            dados = JSON.parse(raw);
        } catch (e) {
            GM_setValue(GM_PENDING_KEY, ''); // Limpa dado corrompido
            return;
        }

        if (!dados || !dados.timestamp) {
            GM_setValue(GM_PENDING_KEY, '');
            return;
        }

        if (Date.now() - dados.timestamp > EXPIRY_MS) {
            GM_setValue(GM_PENDING_KEY, ''); // Descarta dado expirado silenciosamente
            return;
        }

        executarFluxoPaste(dados);
    }

    // ==========================================
    // 7. INICIALIZAÇÃO
    // ==========================================

    // Cenário A: aba já estava aberta e recebeu foco via window.open
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            verificarEExecutar();
        }
    });

    // Cenário B: aba recém-aberta — aguarda o Sheets carregar antes de verificar
    esperarSheets()
        .then(() => {
            if (document.visibilityState === 'visible') {
                verificarEExecutar();
            }
        })
        .catch(err => {
            console.error('[sheets_paste] Sheets não carregou:', err);
        });

})();
