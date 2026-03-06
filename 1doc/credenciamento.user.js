// ==UserScript==
// @name         1Doc - Credenciamento de Professores
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Automação para extração de dados e cópia para planilha de credenciamento.
// @author       Você
// @match        https://*.1doc.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=1doc.com.br
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

    // Recupera dados salvos
    let credenciadoraSalva = localStorage.getItem('1doc_cred_nome') || EQUIPE[0];
    let autoAbrir = localStorage.getItem('1doc_cred_auto') === 'true';

    // ==========================================
    // 2. ESTILOS CSS (Dialog e Botão)
    // ==========================================
    GM_addStyle(`
        /* Botão injetado no 1Doc */
        #btn-credenciamento {
            margin-right: 5px;
            background-color: #34495e;
            color: #fff;
            text-shadow: none;
            border-color: #2c3e50;
        }
        #btn-credenciamento:hover { background-color: #2c3e50; }

        /* Overlay do Dialog */
        #cred-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 999998;
            display: none; align-items: center; justify-content: center;
        }
        #cred-overlay.active { display: flex; }

        /* Caixa do Dialog */
        #cred-dialog {
            background: #fff; width: 450px; border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow: hidden; z-index: 999999;
        }

        /* Cabeçalho */
        .cred-header {
            background: #2980b9; color: white; padding: 15px 20px;
            display: flex; justify-content: space-between; align-items: center;
            font-size: 16px; font-weight: bold;
        }
        .cred-close {
            cursor: pointer; font-size: 20px; color: white; opacity: 0.8;
            border: none; background: transparent;
        }
        .cred-close:hover { opacity: 1; }

        /* Corpo */
        .cred-body { padding: 20px; }
        
        /* Controles */
        .cred-control-group { margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px;}
        .cred-select {
            padding: 8px; border-radius: 4px; border: 1px solid #ccc;
            flex-grow: 1; /* Garante que ocupe o espaço correto sem cortar */
            font-size: 14px; box-sizing: border-box;
        }
        
        .cred-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #555; cursor: pointer; }
        .cred-toggle input { cursor: pointer; }

        /* Aviso */
        .cred-warning {
            background: #fff3cd; color: #856404; border-left: 4px solid #ffeeba;
            padding: 10px; font-size: 13px; border-radius: 4px; margin-top: 15px;
        }

        /* Resultado */
        .cred-result-box {
            background: #f8f9fa; border: 1px dashed #adb5bd; padding: 15px;
            border-radius: 6px; display: none; margin-top: 15px;
        }
        .cred-result-box.show { display: block; }
        .cred-result-title { font-size: 12px; font-weight: bold; color: #28a745; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;}
        .cred-data-row { font-size: 13px; margin-bottom: 4px; color: #333;}
        .cred-data-row strong { color: #000; }

        /* Botão Ação */
        .cred-btn-action {
            width: 100%; padding: 10px; background: #27ae60; color: white;
            border: none; border-radius: 4px; font-size: 15px; cursor: pointer;
            font-weight: bold; transition: background 0.2s;
        }
        .cred-btn-action:hover { background: #219653; }
        .cred-btn-action:disabled { background: #95a5a6; cursor: not-allowed; }
    `);

    // ==========================================
    // 3. CONSTRUÇÃO DA INTERFACE DO DIALOG
    // ==========================================
    function criarDialog() {
        if (document.getElementById('cred-overlay')) return;

        const optionsHtml = EQUIPE.map(nome => 
            `<option value="${nome}" ${nome === credenciadoraSalva ? 'selected' : ''}>${nome}</option>`
        ).join('');

        const html = `
            <div id="cred-overlay">
                <div id="cred-dialog">
                    <div class="cred-header">
                        <span>📋 Credenciamento</span>
                        <button class="cred-close" id="cred-btn-close">✖</button>
                    </div>
                    <div class="cred-body">
                        <div class="cred-control-group">
                            <label style="white-space: nowrap;"><strong>Credenciador(a):</strong></label>
                            <select id="cred-select-nome" class="cred-select">${optionsHtml}</select>
                        </div>
                        
                        <div class="cred-control-group">
                            <label class="cred-toggle">
                                <input type="checkbox" id="cred-auto-abrir" ${autoAbrir ? 'checked' : ''}>
                                Abrir automaticamente nos protocolos
                            </label>
                        </div>

                        <button id="cred-btn-executar" class="cred-btn-action">Extrair e Copiar Dados</button>

                        <div id="cred-resultado" class="cred-result-box">
                            <div class="cred-result-title">✔ Marcador aplicado e dados copiados para colar na planilha!</div>
                            <div class="cred-data-row"><strong>Protocolo:</strong> <span id="cred-res-prot"></span></div>
                            <div class="cred-data-row"><strong>Candidato(a):</strong> <span id="cred-res-nome"></span></div>
                        </div>

                        <div class="cred-warning">
                            ⚠️ <strong>Atenção:</strong> Verifique sempre se o nome de quem enviou o protocolo é o mesmo da pessoa que está se candidatando.
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Event Listeners do Dialog
        document.getElementById('cred-btn-close').addEventListener('click', fecharDialog);
        
        document.getElementById('cred-select-nome').addEventListener('change', (e) => {
            credenciadoraSalva = e.target.value;
            localStorage.setItem('1doc_cred_nome', credenciadoraSalva);
        });

        document.getElementById('cred-auto-abrir').addEventListener('change', (e) => {
            autoAbrir = e.target.checked;
            localStorage.setItem('1doc_cred_auto', autoAbrir);
        });

        document.getElementById('cred-btn-executar').addEventListener('click', executarFluxo);
    }

    function abrirDialog() {
        criarDialog();
        document.getElementById('cred-resultado').classList.remove('show');
        document.getElementById('cred-overlay').classList.add('active');
        
        // Se abrir auto ou manualmente, já tentamos executar o fluxo para ganhar tempo
        if(isPaginaProtocolo()) {
           executarFluxo();
        }
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
        // Busca todos os elementos span.pp da página
        const spans = document.querySelectorAll('span.pp');
        
        for (let span of spans) {
            // Tenta achar o atributo data-content (mais confiável)
            const dataContent = span.getAttribute('data-content');
            if (dataContent && dataContent.trim() !== '') {
                return dataContent.trim();
            }
            
            // Fallback: se não tiver data-content, mas tiver o ícone do Gov.br dentro dele
            const imgGov = span.querySelector('img[src*="icon_verify"]');
            if (imgGov) {
                // Remove elementos filhos (como a imagem) temporariamente para pegar só o texto
                let clone = span.cloneNode(true);
                clone.querySelectorAll('img').forEach(img => img.remove());
                return clone.textContent.replace(/[\n\r]+/g, '').replace(/\s+/g, ' ').trim();
            }
        }
        
        return "Nome não encontrado. Preencha manualmente.";
    }

    async function executarFluxo() {
        const btnExecutar = document.getElementById('cred-btn-executar');
        btnExecutar.disabled = true;
        btnExecutar.innerText = "Processando...";

        try {
            // 1. Extração
            const numEl = document.querySelector('.nd_num');
            
            if (!numEl) throw new Error("Não foi possível encontrar o número do protocolo na página.");

            const protocolo = numEl.innerText.trim();
            const url = window.location.href;
            const candidato = extrairNomeCandidato();

            // 2. Aplicar Marcador
            aplicarMarcador(credenciadoraSalva);

            // 3. Copiar para o Clipboard (Rich Text para a Planilha do Google)
            await copiarParaPlanilha(credenciadoraSalva, protocolo, url, candidato);

            // 4. Atualizar UI
            document.getElementById('cred-res-prot').innerText = protocolo;
            document.getElementById('cred-res-nome').innerText = candidato;
            document.getElementById('cred-resultado').classList.add('show');
            btnExecutar.innerText = "Dados Copiados com Sucesso!";

        } catch (error) {
            console.error("Erro no script de Credenciamento:", error);
            alert("Erro ao extrair dados. Certifique-se de que a página carregou completamente.");
            btnExecutar.innerText = "Tentar Novamente";
        } finally {
            setTimeout(() => { if (btnExecutar) btnExecutar.disabled = false; }, 2000);
        }
    }

    // Cria os dados no formato HTML (para gerar hiperlink) e Plain Text (fallback)
    async function copiarParaPlanilha(credenciadora, protocolo, url, candidato) {
        const htmlData = `<table><tr><td>${credenciadora}</td><td><a href="${url}">${protocolo}</a></td><td>${candidato}</td></tr></table>`;
        const textData = `${credenciadora}\t${protocolo}\t${candidato}`;

        const blobHtml = new Blob([htmlData], { type: 'text/html' });
        const blobText = new Blob([textData], { type: 'text/plain' });

        const data = [new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
        })];

        await navigator.clipboard.write(data);
    }

    // Tenta simular a aplicação do marcador no 1Doc
    function aplicarMarcador(nomeMarcador) {
        try {
            const tagInput = document.querySelector('.select2-input');
            if (!tagInput) return;

            tagInput.focus();
            tagInput.click();

            setTimeout(() => {
                const dropDownItems = document.querySelectorAll('#select2-drop .select2-result-label');
                for (let item of dropDownItems) {
                    if (item.innerText.includes(nomeMarcador)) {
                        const event = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
                        item.dispatchEvent(event);
                        break;
                    }
                }
            }, 300);
        } catch (e) {
            console.log("Aviso: Não foi possível aplicar o marcador automaticamente.", e);
        }
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
                <a id="btn-credenciamento" class="btn btn-mini btn-inverse" title="Abrir Painel de Credenciamento">
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
    const observerUI = new MutationObserver(() => {
        injetarBotao();
    });
    observerUI.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        if (location.href !== ultimaUrl) {
            ultimaUrl = location.href;
            jaRodouNestaPagina = false;
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