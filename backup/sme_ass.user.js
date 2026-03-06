// ==UserScript==
// @name         1Doc - Triagem de Assinaturas (Pindamonhangaba)
// @namespace    http://tampermonkey.net/
// @version      2.10.0
// @description  Triagem inteligente dos documentos que requerem assinatura no 1Doc.
// @author       Raul Cabral
// @match        https://pindamonhangaba.1doc.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=1doc.com.br
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    let ultimaUrl = location.href;
    let jaAbriuNesteDocumento = false;
    let ultimaQuantidadeTimeline = -1;
    let timerBusca = null;

    // Sistema de memória para múltiplos nomes
    let nomesSalvos = [];
    try {
        const nomesRaw = localStorage.getItem('1doc_assinatura_nomes');
        if (nomesRaw) {
            nomesSalvos = JSON.parse(nomesRaw);
        } else {
            // Migração da versão antiga ou valor padrão
            const nomeAntigo = localStorage.getItem('1doc_assinatura_nome');
            nomesSalvos = nomeAntigo ? [nomeAntigo] : ['Luciana De Oliveira Ferreira'];
        }
    } catch(e) {
        nomesSalvos = ['Luciana De Oliveira Ferreira'];
    }

    function salvarNomes() {
        localStorage.setItem('1doc_assinatura_nomes', JSON.stringify(nomesSalvos));
    }

    // ==========================================
    // 1. ESTILOS CSS
    // ==========================================
    GM_addStyle(`
        #drawer-assinaturas {
            position: fixed; top: -600px; left: 0; width: 100%; max-height: 500px;
            background: #ffffff; z-index: 999999; box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            transition: top 0.3s ease-in-out; border-bottom: 4px solid #005fcc;
            display: flex; flex-direction: column; font-family: Arial, sans-serif;
        }
        #drawer-assinaturas.open { top: 0px; }
        .drawer-header-top {
            background: #f8f9fa; padding: 15px 20px 5px 20px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .drawer-header-bottom {
            background: #f8f9fa; padding: 0px 20px 10px 20px; border-bottom: 1px solid #ddd;
        }
        .drawer-controls { display: flex; gap: 10px; align-items: center; }

        .input-group-nome { display: flex; gap: 5px; align-items: center; }
        .drawer-controls input[type="text"] {
            padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px;
            width: 220px; transition: border-color 0.2s;
        }
        .drawer-controls input[type="text"]:focus { border-color: #005fcc; outline: none; }
        #btn-incluir-nome {
            background: #005fcc; color: white; padding: 6px 12px; border: none;
            border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s;
        }
        #btn-incluir-nome:hover { background: #004ba3; }

        /* Estilos dos Chips */
        .chips-container {
            display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px;
        }
        .name-chip {
            background-color: #e6f2ff; border: 1px solid #b3d7ff; color: #005fcc;
            padding: 4px 10px; border-radius: 16px; font-size: 12px; font-weight: bold;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .name-chip-close {
            background: transparent; border: none; color: #005fcc; cursor: pointer;
            padding: 0; font-size: 14px; font-weight: bold; line-height: 1; margin-top: -2px;
        }
        .name-chip-close:hover { color: #003d82; }

        .toggle-container {
            display: flex; align-items: center; gap: 8px; font-size: 13px; color: #555;
            cursor: pointer; user-select: none; margin-right: 10px; margin-left: 10px;
        }
        .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #ccc; transition: .4s; border-radius: 20px;
        }
        .slider:before {
            position: absolute; content: ""; height: 14px; width: 14px;
            left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;
        }
        input:checked + .slider { background-color: #005fcc; }
        input:checked + .slider:before { transform: translateX(16px); }

        /* Botão de Arquivar (Verde) */
        #btn-arquivar-drawer {
            background: #468847; color: white; padding: 6px 15px; border: none;
            border-radius: 4px; cursor: pointer; font-weight: bold; display: flex;
            align-items: center; gap: 5px; transition: all 0.2s;
        }
        #btn-arquivar-drawer:hover:not(:disabled) { background: #356635; }
        #btn-arquivar-drawer:disabled { display: none; }
        #btn-arquivar-drawer:focus { outline: 3px solid #ffc107; box-shadow: 0 0 8px rgba(255, 193, 7, 0.8); }

        /* Botão de Marcar (Amarelo) */
        #btn-marcar-drawer {
            background: #ffc107; color: #333; padding: 6px 15px; border: none;
            border-radius: 4px; cursor: pointer; font-weight: bold; display: flex;
            align-items: center; gap: 5px; transition: all 0.2s;
        }
        #btn-marcar-drawer:hover:not(:disabled) { background: #e0a800; }
        #btn-marcar-drawer:disabled { display: none; }
        #btn-marcar-drawer:focus { outline: 3px solid #005fcc; box-shadow: 0 0 8px rgba(0, 95, 204, 0.8); }

        .drawer-close {
            background: transparent !important; color: #333 !important; font-size: 20px;
            border: none; cursor: pointer; padding: 0 10px;
        }
        .drawer-stats { display: flex; gap: 15px; font-weight: bold; font-size: 14px; align-items: center; }
        .stat-badge { padding: 5px 10px; border-radius: 12px; color: white; }
        .stat-total { background: #6c757d; }
        .stat-assinados { background: #468847; }
        .stat-pendentes { background: #b94a48; }

        .drawer-body { padding: 20px; overflow-y: auto; flex-grow: 1; background: #f4f5f7; }
        .sig-box {
            background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px 15px;
            margin-bottom: 10px; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            cursor: pointer; transition: all 0.2s ease;
        }
        .sig-box:hover { border-color: #005fcc; box-shadow: 0 3px 8px rgba(0,95,204,0.15); transform: translateY(-1px); }
        .sig-status {
            margin-right: 15px; padding: 4px 8px; border-radius: 3px; font-size: 11.844px;
            font-weight: bold; text-align: center; min-width: 80px; color: white;
        }
        .status-assinado { background-color: #468847; }
        .status-pendente { background-color: #f89406; }
        .sig-content { font-size: 13px; color: #333; line-height: 1.5; }
        .sig-emp {
            background-color: #999999; border-radius: 3px; padding: 2px 4px;
            font-size: 11.844px; color: white; margin: 0 4px; font-weight: bold;
        }
        .sig-name { font-weight: bold; color: #333; }
        .sig-doc { font-weight: bold; }

        .highlight-target { animation: piscarAmarelo 2s ease-out; }
        @keyframes piscarAmarelo {
            0% { background-color: transparent; }
            20% { background-color: #fff3cd; }
            80% { background-color: #fff3cd; }
            100% { background-color: transparent; }
        }
    `);

    // ==========================================
    // 2. CONSTRUÇÃO DA INTERFACE
    // ==========================================
    function initUI(tagsBtnGroup) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn-group btn-group-rapid btn-group-assinaturas';
        btnContainer.style.marginRight = '5px';

        btnContainer.innerHTML = `
            <a title="Triagem de Assinaturas" href="#" id="btn-toggle-assinaturas" class="btn btn-mini btn-primary">
                <i class="icon-certificate"></i>
            </a>
        `;
        tagsBtnGroup.parentNode.insertBefore(btnContainer, tagsBtnGroup);

        if (!document.getElementById('drawer-assinaturas')) {
            buildDrawer();
        }

        document.getElementById('btn-toggle-assinaturas').addEventListener('click', (e) => {
            e.preventDefault();
            const drawer = document.getElementById('drawer-assinaturas');
            drawer.classList.toggle('open');
            if (drawer.classList.contains('open')) {
                buscarAssinaturas(false);
            }
        });
    }

    function renderizarChips() {
        const container = document.getElementById('chips-container');
        if (!container) return;

        container.innerHTML = '';
        nomesSalvos.forEach((nome, index) => {
            const chip = document.createElement('div');
            chip.className = 'name-chip';
            chip.innerHTML = `
                ${nome}
                <button class="name-chip-close" data-index="${index}" title="Remover nome">&times;</button>
            `;
            container.appendChild(chip);
        });

        // Eventos para remover chips
        const botoesRemover = container.querySelectorAll('.name-chip-close');
        botoesRemover.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                nomesSalvos.splice(idx, 1);
                salvarNomes();
                renderizarChips();
                buscarAssinaturas(false); // Refaz a busca sem o nome removido
            });
        });
    }

    function buildDrawer() {
        const drawer = document.createElement('div');
        drawer.id = 'drawer-assinaturas';
        const autoOpenSalvo = localStorage.getItem('1doc_assinatura_autoopen') !== 'false';

        drawer.innerHTML = `
            <div class="drawer-header-top">
                <div class="drawer-controls">
                    <button class="drawer-close" id="btn-fechar-drawer" title="Fechar">✖</button>
                    <div class="input-group-nome">
                        <input type="text" id="input-novo-nome" placeholder="Adicionar nome para pesquisa...">
                        <button id="btn-incluir-nome">Incluir</button>
                    </div>

                    <label class="toggle-container" title="Abrir o painel automaticamente se houver solicitações">
                        <div class="switch">
                            <input type="checkbox" id="toggle-auto-open" ${autoOpenSalvo ? 'checked' : ''}>
                            <span class="slider"></span>
                        </div>
                        Auto-abrir
                    </label>

                    <button id="btn-marcar-drawer" disabled data-status="pendente"><i class="icon-tags"></i> Marcar</button>
                    <button id="btn-arquivar-drawer" disabled title="Aperte Enter para arquivar"><i class="icon-download-alt icon-white"></i> Arquivar</button>
                </div>
                <div class="drawer-stats">
                    <span class="stat-badge stat-total" id="stat-total">Solicitadas: 0</span>
                    <span class="stat-badge stat-assinados" id="stat-assinados">Assinados: 0</span>
                    <span class="stat-badge stat-pendentes" id="stat-pendentes">Pendentes: 0</span>
                </div>
            </div>
            <div class="drawer-header-bottom">
                <div id="chips-container" class="chips-container"></div>
            </div>
            <div class="drawer-body" id="drawer-results">
                <div style="text-align: center; color: #999; padding-top: 20px;">
                    Aguardando carregamento do documento...
                </div>
            </div>
        `;
        document.body.appendChild(drawer);

        renderizarChips();

        // Eventos básicos
        document.getElementById('btn-fechar-drawer').addEventListener('click', () => {
            document.getElementById('drawer-assinaturas').classList.remove('open');
        });
        document.getElementById('btn-arquivar-drawer').addEventListener('click', executarArquivamento);
        document.getElementById('btn-marcar-drawer').addEventListener('click', executarMarcacao);
        document.getElementById('toggle-auto-open').addEventListener('change', (e) => {
            localStorage.setItem('1doc_assinatura_autoopen', e.target.checked);
        });

        // Eventos para inclusão de nomes
        const inputNome = document.getElementById('input-novo-nome');
        const btnIncluir = document.getElementById('btn-incluir-nome');

        const adicionarNome = () => {
            const novoNome = inputNome.value.trim();
            if (novoNome && !nomesSalvos.includes(novoNome)) {
                nomesSalvos.push(novoNome);
                salvarNomes();
                renderizarChips();
                inputNome.value = '';
                buscarAssinaturas(false);
            } else if (nomesSalvos.includes(novoNome)) {
                inputNome.value = ''; // Limpa se já existir
            }
        };

        btnIncluir.addEventListener('click', adicionarNome);
        inputNome.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita que o Enter dispare outras coisas na página
                adicionarNome();
            }
        });
    }

    function converterDataBR(dateStr) {
        const regex = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/;
        const match = dateStr.match(regex);
        if (match) {
            return new Date(match[3], match[2] - 1, match[1], match[4], match[5], match[6]).getTime();
        }
        return 0;
    }

    // ==========================================
    // 3. LÓGICA DE BUSCA, ORDENAÇÃO E SCROLL
    // ==========================================
    function buscarAssinaturas(isAutoBackground = false) {
        const resultsContainer = document.getElementById('drawer-results');
        const btnArquivar = document.getElementById('btn-arquivar-drawer');
        const btnMarcar = document.getElementById('btn-marcar-drawer');
        const toggleAutoOpen = document.getElementById('toggle-auto-open').checked;
        const drawerElement = document.getElementById('drawer-assinaturas');

        // Reseta tudo
        btnArquivar.disabled = true; btnArquivar.style.display = 'none';
        btnMarcar.disabled = true; btnMarcar.style.display = 'none';

        if (nomesSalvos.length === 0) {
            document.getElementById('stat-total').innerText = `Solicitadas: 0`;
            document.getElementById('stat-assinados').innerText = `Assinados: 0`;
            document.getElementById('stat-pendentes').innerText = `Pendentes: 0`;
            resultsContainer.innerHTML = `<div style="text-align: center; color: #666; padding: 20px;">Adicione um ou mais nomes para começar a triagem.</div>`;
            return;
        }

        const nomesBuscaLower = nomesSalvos.map(n => n.toLowerCase());

        let total = 0; let assinados = 0; let pendentes = 0;
        let index = 0;
        const listaResultados = []; // Array para permitir a ordenação cronológica

        const timelineBoxes = document.querySelectorAll('.timeline_conteudo.desp_notificacao');

        timelineBoxes.forEach(caixa => {
            const marcouQuemElement = caixa.querySelector('.marcou_quem');
            if (!marcouQuemElement) return;

            const textoAcao = marcouQuemElement.innerText || marcouQuemElement.textContent;
            const textoAcaoLower = textoAcao.toLowerCase();

            if (textoAcaoLower.includes('solicitou a assinatura de')) {

                // Verifica se a solicitação bate com algum dos nomes da nossa lista
                const nomeEncontradoIndex = nomesBuscaLower.findIndex(nome => textoAcaoLower.includes(nome));

                if (nomeEncontradoIndex !== -1) {
                    const nomeReal = nomesSalvos[nomeEncontradoIndex]; // Pega com a capitalização original

                    const uniqueTargetId = caixa.id || `1doc-sig-target-${index}`;
                    caixa.id = uniqueTargetId; index++;

                    const dataElement = caixa.querySelector('.despacho_data');
                    const dataHora = dataElement ? dataElement.innerText.trim() : "Data N/D";
                    const timestamp = converterDataBR(dataHora) || index; // Fallback para manter ordem do DOM

                    const nomeElement = caixa.querySelector('.marcou_nome');
                    const solicitante = nomeElement ? nomeElement.innerText.trim() : "N/D";
                    const deptElement = caixa.querySelector('.badge_env');
                    const depto = deptElement ? deptElement.innerText.trim() : "N/D";

                    let documento = "Documento N/D";
                    const docMatch = textoAcao.match(/em\s+(Despacho.*?)(?:\n|$)/i) || textoAcao.match(/em\s+(.*?)(?:\n|$)/i);
                    if (docMatch && docMatch[1]) { documento = docMatch[1].trim(); }

                    const assinadoBadge = caixa.querySelector('.btn-group.pull-right .badge-success');
                    const isAssinado = assinadoBadge && assinadoBadge.innerText.toLowerCase().includes('assinado');

                    if (isAssinado) assinados++; else pendentes++;
                    total++;

                    const statusClass = isAssinado ? "status-assinado" : "status-pendente";
                    const icone = isAssinado ? "icon-certificate" : "icon-time";
                    const statusStr = isAssinado ? "Assinado" : "Pendente";

                    const htmlBox = `
                        <div class="sig-box" data-target="${uniqueTargetId}" title="Clique para ir até o despacho na página">
                            <div class="sig-status ${statusClass}">
                                <i class="${icone} icon-white"></i> ${statusStr}
                            </div>
                            <div class="sig-content">
                                ${dataHora} <span class="sig-name">${solicitante}</span> <span class="sig-emp">${depto}</span>
                                solicitou a assinatura de <span class="sig-name">${nomeReal}</span>
                                em <span class="sig-doc">${documento}</span>
                            </div>
                        </div>
                    `;

                    listaResultados.push({
                        id: uniqueTargetId,
                        timestamp: timestamp,
                        index: index,
                        isAssinado: isAssinado,
                        html: htmlBox
                    });
                }
            }
        });

        // ORDENAÇÃO CRONOLÓGICA (Mais antigo para o mais recente)
        listaResultados.sort((a, b) => {
            if (a.timestamp === b.timestamp) return a.index - b.index;
            return a.timestamp - b.timestamp;
        });

        // Atualiza UI
        document.getElementById('stat-total').innerText = `Solicitadas: ${total}`;
        document.getElementById('stat-assinados').innerText = `Assinados: ${assinados}`;
        document.getElementById('stat-pendentes').innerText = `Pendentes: ${pendentes}`;

        if (total === 0) {
            resultsContainer.innerHTML = `<div style="text-align: center; color: #666; padding: 20px;">Nenhuma solicitação encontrada para os nomes da lista.</div>`;
        } else {
            // Renderiza o HTML das caixas ordenadas
            resultsContainer.innerHTML = listaResultados.map(r => r.html).join('');
            adicionarEventosDeClique();
        }

        // ==========================================
        // ATIVAÇÃO DE BOTÕES, FOCO E CÁLCULO DE SCROLL
        // ==========================================
        const tagsNaTela = Array.from(document.querySelectorAll('.badge_marcador'));
        const tagFaltaAssinar = tagsNaTela.find(tag => tag.innerText.toUpperCase().includes('FALTA ASSINAR'));

        if (pendentes > 0) {
            btnMarcar.disabled = false; btnMarcar.style.display = 'flex';
            if (tagFaltaAssinar) {
                btnMarcar.innerHTML = '<i class="icon-tags"></i> ✔ Marcado';
                btnMarcar.title = "Aperte Enter para voltar ao inbox";
                btnMarcar.dataset.status = "marcado";
            } else {
                btnMarcar.innerHTML = '<i class="icon-tags"></i> Marcar';
                btnMarcar.title = "Aperte Enter para marcar como pendente";
                btnMarcar.dataset.status = "pendente";
            }
        } else if (total > 0 || total === 0) { // Mostra arquivar se total for 0 (nenhuma solicitação = pode arquivar)
            btnArquivar.disabled = false; btnArquivar.style.display = 'flex';
        }

        // Define quem é o alvo do scroll inteligente
        let targetToScroll = null;
        if (pendentes > 0) {
            // Rola para a MAIS ANTIGA pendente
            const pendentesList = listaResultados.filter(i => !i.isAssinado);
            if (pendentesList.length > 0) targetToScroll = pendentesList[0].id; // Já está ordenado ascendente
        } else if (total > 0) {
            // Rola para a MAIS RECENTE assinada
            const assinadosList = listaResultados.filter(i => i.isAssinado);
            if (assinadosList.length > 0) targetToScroll = assinadosList[assinadosList.length - 1].id;
        }

        const aplicarFocoEScroll = () => {
            if (pendentes > 0) btnMarcar.focus();
            else btnArquivar.focus();

            if (targetToScroll) {
                const targetElement = document.getElementById(targetToScroll);
                if (targetElement) {
                    const drawerHeight = drawerElement.offsetHeight || 160;
                    const rect = targetElement.getBoundingClientRect();
                    const offset = rect.top + window.scrollY - drawerHeight - 20;

                    window.scrollTo({ top: offset, behavior: 'smooth' });

                    targetElement.classList.remove('highlight-target');
                    setTimeout(() => targetElement.classList.add('highlight-target'), 10);
                }
            }
        };

        if (toggleAutoOpen && isAutoBackground && !jaAbriuNesteDocumento) {
            drawerElement.classList.add('open');
            jaAbriuNesteDocumento = true;
            setTimeout(aplicarFocoEScroll, 350);

        } else if (drawerElement.classList.contains('open')) {
            setTimeout(aplicarFocoEScroll, 250);
        }
    }

    // ==========================================
    // 4. AUTOMAÇÃO DE MARCAÇÃO E VOLTAR
    // ==========================================
    function executarMarcacao() {
        const btnMarcar = document.getElementById('btn-marcar-drawer');

        if (btnMarcar.dataset.status === "marcado") {
            document.getElementById('drawer-assinaturas').classList.remove('open');
            const btnVoltar = document.querySelector('.icon-chevron-left');
            if (btnVoltar) {
                const elClique = btnVoltar.closest('a') || btnVoltar.closest('button') || btnVoltar;
                elClique.click();
            } else {
                window.history.back();
            }
            return;
        }

        const btnTagDropdown = document.querySelector('a[title="Marcadores"]');
        if (btnTagDropdown) btnTagDropdown.click();

        setTimeout(() => {
            const caixaTexto = document.querySelector('.select2-search-field input, .select2-input');
            if (caixaTexto) caixaTexto.focus();

            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                        var selectObj = $('#marcadores_ids');
                        var targetOption = selectObj.find('option').filter(function() {
                            return $(this).text().toUpperCase().indexOf('FALTA ASSINAR') > -1 ||
                                   $(this).attr('title') === 'FALTA ASSINAR';
                        });

                        if (targetOption.length > 0) {
                            var tagValue = targetOption.attr('value');
                            var currentValues = selectObj.val() || [];
                            if (currentValues.indexOf(tagValue) === -1) {
                                currentValues.push(tagValue);
                                selectObj.val(currentValues).trigger('change');
                            }
                        }
                    }
                })();
            `;
            document.body.appendChild(script);
            script.remove();

            document.getElementById('drawer-assinaturas').classList.remove('open');

            setTimeout(() => {
                const btnVoltar = document.querySelector('.icon-chevron-left');
                if (btnVoltar) {
                    const elClique = btnVoltar.closest('a') || btnVoltar.closest('button') || btnVoltar;
                    elClique.click();
                } else {
                    window.history.back();
                }
            }, 800);

        }, 150);
    }

    // ==========================================
    // 5. AUTOMAÇÃO DE ARQUIVAMENTO (Com remoção de Tag)
    // ==========================================
    function executarArquivamento() {
        const processarArquivamentoFinal = () => {
            const btnPageArchive = document.querySelector('.botao_flutuante_4.bf_v_7') ||
                                   document.querySelector('button[title*="Arquivar"][title*="Parar de acompanhar"]');

            if (btnPageArchive) {
                btnPageArchive.click();

                const monitorarDialog = setInterval(() => {
                    const btnConfirmar = document.getElementById('sim');
                    if (btnConfirmar && btnConfirmar.innerText.includes('Arquivar') && btnConfirmar.offsetWidth > 0) {
                        btnConfirmar.click();
                        clearInterval(monitorarDialog);
                        document.getElementById('drawer-assinaturas').classList.remove('open');
                    }
                }, 100);

                setTimeout(() => clearInterval(monitorarDialog), 5000);
            } else {
                alert("Não foi possível encontrar o botão 'Arquivar e Parar de Acompanhar' na página.");
            }
        };

        const tagsNaTela = Array.from(document.querySelectorAll('.badge_marcador'));
        const tagFaltaAssinar = tagsNaTela.find(tag => tag.innerText.toUpperCase().includes('FALTA ASSINAR'));

        if (tagFaltaAssinar) {
            const btnTagDropdown = document.querySelector('a[title="Marcadores"]');
            if (btnTagDropdown) btnTagDropdown.click();

            setTimeout(() => {
                const script = document.createElement('script');
                script.textContent = `
                    (function() {
                        if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
                            var selectObj = $('#marcadores_ids');
                            var targetOption = selectObj.find('option').filter(function() {
                                return $(this).text().toUpperCase().indexOf('FALTA ASSINAR') > -1 ||
                                       $(this).attr('title') === 'FALTA ASSINAR';
                            });

                            if (targetOption.length > 0) {
                                var tagValue = targetOption.attr('value');
                                var currentValues = selectObj.val() || [];
                                var index = currentValues.indexOf(tagValue);

                                if (index > -1) {
                                    currentValues.splice(index, 1);
                                    selectObj.val(currentValues).trigger('change');
                                }
                            }
                        }
                    })();
                `;
                document.body.appendChild(script);
                script.remove();

                setTimeout(() => {
                    if (btnTagDropdown) btnTagDropdown.click();
                    processarArquivamentoFinal();
                }, 500);

            }, 150);
        } else {
            processarArquivamentoFinal();
        }
    }

    function adicionarEventosDeClique() {
        const cards = document.querySelectorAll('.sig-box');
        cards.forEach(card => {
            card.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    document.getElementById('drawer-assinaturas').classList.remove('open');
                    const drawerHeight = document.getElementById('drawer-assinaturas').offsetHeight || 160;
                    const rect = targetElement.getBoundingClientRect();
                    const offset = rect.top + window.scrollY - drawerHeight - 20;

                    window.scrollTo({ top: offset, behavior: 'smooth' });

                    targetElement.classList.remove('highlight-target');
                    setTimeout(() => targetElement.classList.add('highlight-target'), 10);
                }
            });
        });
    }

    // ==========================================
    // 6. OBSERVAÇÃO DE MUDANÇAS E INJEÇÃO
    // ==========================================
    const observerUI = new MutationObserver(() => {
        const btnGroupTags = document.querySelector('.btn-group-tags');
        const nossoBotao = document.getElementById('btn-toggle-assinaturas');
        if (btnGroupTags && !nossoBotao) {
            initUI(btnGroupTags);
        }
    });
    observerUI.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        if (location.href !== ultimaUrl) {
            ultimaUrl = location.href;
            jaAbriuNesteDocumento = false;
            ultimaQuantidadeTimeline = -1;
            document.getElementById('drawer-assinaturas')?.classList.remove('open');
        }

        const timelineBoxes = document.querySelectorAll('.timeline_conteudo.desp_notificacao');
        const countAtual = timelineBoxes.length;

        if (countAtual > 0 && countAtual !== ultimaQuantidadeTimeline) {
            ultimaQuantidadeTimeline = countAtual;
            if (document.getElementById('drawer-assinaturas')) {
                buscarAssinaturas(true);
            }
        }
    }, 400);

})();