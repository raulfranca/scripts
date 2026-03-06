// ==UserScript==
// @name         1Doc - Credenciamento de Professores
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Automação para extração de dados e cópia para planilha de credenciamento.
// @author       Você
// @match        https://*.1doc.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=1doc.com.br
// @updateURL    https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js
// @downloadURL  https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. CONFIGURAÇÕES E ESTADOS
    // ==========================================
    const EQUIPE = ['Renata', 'Catarina', 'Alessandra'];
    const SHEETS_URL     = 'https://docs.google.com/spreadsheets/d/1OcFrOoA4DQqz1r9cOTKG7kDWyV5jX2xcMFJcf870qzY/edit?gid=0#gid=0';
    const GM_PENDING_KEY = '1doc_cred_pending_paste';
    let ultimaUrl = location.href;
    let jaRodouNestaPagina = false;

    // Recupera dados salvos
    let credenciadoraSalva = localStorage.getItem('1doc_cred_nome') || EQUIPE[0];
    let autoAbrir = localStorage.getItem('1doc_cred_auto') === 'true';
    let dadosExtraidos = null; // { protocolo, url, candidato } — preenchido após extração

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
        .cred-opts-group { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
        .cred-opt-btn {
            padding: 5px 14px; border: 1px solid #ccc; border-radius: 4px;
            background: #f0f0f0; cursor: pointer; font-size: 13px; color: #333;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .cred-opt-btn:hover { background: #e0e0e0; border-color: #bbb; }
        .cred-opt-btn.active { background: #2980b9; color: #fff; border-color: #2471a3; font-weight: bold; }
        
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
            `<button class="cred-opt-btn${nome === credenciadoraSalva ? ' active' : ''}" data-nome="${nome}">${nome}</button>`
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
                            <div class="cred-opts-group">${optionsHtml}</div>
                        </div>
                        
                        <div class="cred-control-group">
                            <label class="cred-toggle">
                                <input type="checkbox" id="cred-auto-abrir" ${autoAbrir ? 'checked' : ''}>
                                Abrir automaticamente nos protocolos
                            </label>
                        </div>

                        <button id="cred-btn-executar" class="cred-btn-action" disabled>Processando...</button>

                        <div id="cred-resultado" class="cred-result-box">
                            <div class="cred-result-title">✔ Marcador aplicado — pressione Enter ou clique para copiar.</div>
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
        
        document.querySelectorAll('.cred-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cred-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                credenciadoraSalva = btn.dataset.nome;
                localStorage.setItem('1doc_cred_nome', credenciadoraSalva);
                if (isPaginaProtocolo()) {
                    trocarMarcador(credenciadoraSalva);
                }
                // Retorna o foco ao botão de cópia para que Enter continue funcionando
                setTimeout(() => {
                    const btnEx = document.getElementById('cred-btn-executar');
                    if (btnEx && !btnEx.disabled) btnEx.focus();
                }, 50);
            });
        });

        document.getElementById('cred-auto-abrir').addEventListener('change', (e) => {
            autoAbrir = e.target.checked;
            localStorage.setItem('1doc_cred_auto', autoAbrir);
        });

        document.getElementById('cred-btn-executar').addEventListener('click', copiarEFechar);
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

    // Extrai dados e aplica marcador — chamado automaticamente ao abrir o dialog.
    // NÃO copia: a cópia fica a cargo de copiarEFechar(), acionada pelo botão.
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

            // 2. Aplicar marcador (e remover marcadores de outros credenciadores)
            trocarMarcador(credenciadoraSalva);

            // 3. Persistir dados para uso posterior no copiarEFechar
            dadosExtraidos = { protocolo, url, candidato };

            // 4. Atualizar UI e habilitar botão de cópia com foco
            document.getElementById('cred-res-prot').innerText = protocolo;
            document.getElementById('cred-res-nome').innerText = candidato;
            document.getElementById('cred-resultado').classList.add('show');
            btnExecutar.innerText = "Copiar para Planilha";
            btnExecutar.disabled = false;
            btnExecutar.focus();

        } catch (error) {
            console.error("Erro no script de Credenciamento:", error);
            alert("Erro ao extrair dados. Certifique-se de que a página carregou completamente.");
            dadosExtraidos = null;
            btnExecutar.innerText = "Tentar Novamente";
            btnExecutar.disabled = false;
            btnExecutar.focus();
        }
    }

    // Copia os dados para o clipboard e fecha o dialog.
    // Se chamada antes da extração (retry), delega para executarFluxo.
    async function copiarEFechar() {
        if (!dadosExtraidos) {
            await executarFluxo();
            return;
        }

        const btnExecutar = document.getElementById('cred-btn-executar');
        btnExecutar.disabled = true;

        try {
            await copiarParaPlanilha(credenciadoraSalva, dadosExtraidos.protocolo, dadosExtraidos.url, dadosExtraidos.candidato);

            // Armazena dados estruturados para o script do Sheets colar automaticamente
            GM_setValue(GM_PENDING_KEY, JSON.stringify({
                credenciadora: credenciadoraSalva,
                protocolo:     dadosExtraidos.protocolo,
                url:           dadosExtraidos.url,
                candidato:     dadosExtraidos.candidato,
                timestamp:     Date.now()
            }));

            // Abre ou foca a aba da planilha (mesmo nome = reutiliza janela existente)
            window.open(SHEETS_URL, 'sheetsWindow');

            fecharDialog();
        } catch (error) {
            console.error("Erro ao copiar dados:", error);
            alert("Erro ao copiar dados para a área de transferência.");
            btnExecutar.disabled = false;
            btnExecutar.focus();
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

    // Troca o marcador: adiciona o do credenciador selecionado e remove os dos demais.
    // Usa jQuery nativo da página via injeção de <script> (abordagem infalível - ver doc seção 5.3)
    function trocarMarcador(novoNome) {
        const outrosNomes = EQUIPE.filter(n => n !== novoNome).map(n => n.toUpperCase());
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                    var selectObj = $('#marcadores_ids');
                    var outrosNomes = ${JSON.stringify(outrosNomes)};
                    var novoNome = ${JSON.stringify(novoNome.toUpperCase())};

                    // Identifica os valores dos marcadores dos outros credenciadores
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

                    // Remove os marcadores dos outros credenciadores da seleção atual
                    var newValues = (selectObj.val() || []).filter(function(v) {
                        return valuesToRemove.indexOf(v) === -1;
                    });

                    // Adiciona o marcador do credenciador selecionado, se ainda não estiver
                    var targetOption = selectObj.find('option').filter(function() {
                        return $(this).text().toUpperCase().indexOf(novoNome) > -1;
                    });
                    if (targetOption.length > 0) {
                        var tagValue = targetOption.attr('value');
                        if (newValues.indexOf(tagValue) === -1) {
                            newValues.push(tagValue);
                        }
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
            dadosExtraidos = null;
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