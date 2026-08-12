// ==UserScript==
// @name         1Doc - Folha de Frequência (Credenciamento)
// @namespace    http://tampermonkey.net/
// @version      0.2.0
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

    const LS_LISTA     = '1doc_folha_lista';     // array: {nome, numero, url, registro, cpf, email, celular, pis, nascimento, assinatura, cep, logradouro, enderecoNumero, bairro, cidade, horas}
    const LS_COLETADOS = '1doc_folha_coletados'; // array: números já coletados
    const LS_PULADOS   = '1doc_folha_pulados';   // array: números pulados (seguem pendentes, mas não são sugeridos como "próximo")
    const LS_MODO      = '1doc_folha_modo';      // 'entrada' | 'coleta'
    const LS_MES       = '1doc_folha_mes';       // string: mês de referência, ex: 'ABR-26'
    const LS_INBOX_URL = '1doc_folha_inbox_url'; // URL do inbox salva ao entrar nele
    const LS_ARQUIVO   = '1doc_folha_arquivo';   // {nome, ts, total, importados, descartados} — resumo do último import
    const LS_AVANCO    = '1doc_folha_avanco';    // {numero, ts} — gravado ao clicar em Enviar; consumido por verificarAvancoPendente

    const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

    // ─── 2. UTILS ────────────────────────────────────────────────────────────

    function lerLista()     { try { return JSON.parse(localStorage.getItem(LS_LISTA)     || '[]'); } catch { return []; } }
    function lerColetados() { try { return JSON.parse(localStorage.getItem(LS_COLETADOS) || '[]'); } catch { return []; } }
    function lerPulados()   { try { return JSON.parse(localStorage.getItem(LS_PULADOS)   || '[]'); } catch { return []; } }
    function lerModo()      { return localStorage.getItem(LS_MODO) || 'entrada'; }
    function lerMes()       { return localStorage.getItem(LS_MES)  || ''; }
    function lerInboxUrl()  { return localStorage.getItem(LS_INBOX_URL) || location.origin; }
    function navegarInbox() { location.href = lerInboxUrl(); }
    function lerArquivoInfo() { try { return JSON.parse(localStorage.getItem(LS_ARQUIVO) || 'null'); } catch { return null; } }

    function salvarLista(lista)     { localStorage.setItem(LS_LISTA, JSON.stringify(lista)); }
    function salvarPulados(lista)   { localStorage.setItem(LS_PULADOS, JSON.stringify(lista)); }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Helpers para trabalhar com lista de objetos
    function listaNumeros()    { return lerLista().map(e => e.numero); }
    function nomeDoNumero(n)   { return (lerLista().find(e => e.numero === n) || {}).nome || ''; }
    // LS_COLETADOS armazena Array<{numero, url}> — helpers de compatibilidade
    function coletadosNumeros() { return lerColetados().map(c => typeof c === 'string' ? c : c.numero); }
    function urlColetado(n)     { const c = lerColetados().find(c => (typeof c === 'string' ? c : c.numero) === n); return c && typeof c === 'object' ? c.url : ''; }

    // Primeiro item da lista com link, ainda não coletado nem pulado — a "fila" de trabalho
    function proximoPendente() {
        const coletados = coletadosNumeros();
        const pulados    = lerPulados();
        return lerLista().find(e => e.url && !coletados.includes(e.numero) && !pulados.includes(e.numero)) || null;
    }

    // Navega na mesma aba para o protocolo do item da lista (decisão do usuário: sem janela dedicada)
    function abrirProtocolo(entrada) {
        if (!entrada || !entrada.url) return;
        location.href = entrada.url;
    }

    // ─── 2B. LEITURA DE PLANILHA (.xlsx) ────────────────────────────────────
    // Sem dependências externas: o .xlsx é um ZIP com XML dentro. Lemos o
    // diretório central do ZIP, inflamos as entradas via DecompressionStream
    // nativo do navegador (Chrome/Edge 103+) e parseamos o XML com DOMParser.

    function parseXml(texto) {
        const doc = new DOMParser().parseFromString(texto, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Arquivo XML corrompido dentro do .xlsx.');
        }
        return doc;
    }

    async function inflar(bytesComprimidos) {
        const stream = new Blob([bytesComprimidos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // Lê o diretório central do ZIP e devolve Map<nomeArquivo, Uint8Array> com todo o conteúdo já descomprimido
    async function lerZip(buffer) {
        const view  = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        // EOCD (End Of Central Directory): varre de trás pra frente — o campo de comentário
        // (0–65535 bytes) impede assumir uma posição fixa a partir do fim do arquivo.
        const EOCD_SIG = 0x06054b50;
        let eocdPos = -1;
        const minPos = Math.max(0, bytes.length - 22 - 65535);
        for (let i = bytes.length - 22; i >= minPos; i--) {
            if (view.getUint32(i, true) === EOCD_SIG) { eocdPos = i; break; }
        }
        if (eocdPos === -1) throw new Error('Arquivo ZIP inválido: fim do diretório central (EOCD) não encontrado.');

        const totalEntradas = view.getUint16(eocdPos + 10, true);
        const offsetCD       = view.getUint32(eocdPos + 16, true);

        const CD_SIG = 0x02014b50;
        const entradas = [];
        let ptr = offsetCD;
        for (let i = 0; i < totalEntradas; i++) {
            if (view.getUint32(ptr, true) !== CD_SIG) throw new Error('Arquivo ZIP inválido: assinatura de diretório central incorreta.');
            const method      = view.getUint16(ptr + 10, true);
            const compSize    = view.getUint32(ptr + 20, true);
            const nomeLen     = view.getUint16(ptr + 28, true);
            const extraLen    = view.getUint16(ptr + 30, true);
            const comentLen   = view.getUint16(ptr + 32, true);
            const offsetLocal = view.getUint32(ptr + 42, true);
            const nome = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nomeLen));
            entradas.push({ nome, offsetLocal, compSize, method });
            ptr += 46 + nomeLen + extraLen + comentLen;
        }

        const arquivos = new Map();
        for (const { nome, offsetLocal, compSize, method } of entradas) {
            if (nome.endsWith('/')) continue; // diretório, sem conteúdo
            const nomeLenLocal  = view.getUint16(offsetLocal + 26, true);
            const extraLenLocal = view.getUint16(offsetLocal + 28, true);
            const dataStart = offsetLocal + 30 + nomeLenLocal + extraLenLocal;
            const comp = bytes.subarray(dataStart, dataStart + compSize);
            let dados;
            if (method === 0) dados = comp; // stored (sem compressão)
            else if (method === 8) dados = await inflar(comp); // deflate
            else throw new Error(`Método de compressão não suportado (${method}) em "${nome}".`);
            arquivos.set(nome, dados);
        }
        return arquivos;
    }

    function parseSharedStrings(xmlBytes) {
        if (!xmlBytes) return [];
        const doc = parseXml(new TextDecoder('utf-8').decode(xmlBytes));
        return Array.from(doc.getElementsByTagName('si')).map(si =>
            Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join('')
        );
    }

    function parseSheetXml(xmlBytes, sharedStrings) {
        const doc = parseXml(new TextDecoder('utf-8').decode(xmlBytes));
        const linhas = [];
        Array.from(doc.getElementsByTagName('row')).forEach(rowEl => {
            const r = parseInt(rowEl.getAttribute('r'), 10);
            const cells = {};
            Array.from(rowEl.getElementsByTagName('c')).forEach(c => {
                const ref = c.getAttribute('r');
                if (!ref) return;
                const col = ref.replace(/\d+/g, '');
                const tipo = c.getAttribute('t');
                let valor = '';
                if (tipo === 'inlineStr') {
                    const isEl = c.getElementsByTagName('is')[0];
                    valor = isEl ? Array.from(isEl.getElementsByTagName('t')).map(t => t.textContent).join('') : '';
                } else {
                    const vEl = c.getElementsByTagName('v')[0];
                    const raw = vEl ? vEl.textContent : '';
                    valor = (tipo === 's') ? (sharedStrings[parseInt(raw, 10)] || '') : raw;
                }
                cells[col] = valor;
            });
            linhas.push({ r, cells });
        });
        return linhas;
    }

    // Hyperlinks da planilha: <hyperlink ref="B4" r:id="rId1"/> na sheet + <Relationship Id="rId1" Target="..."/> no .rels
    function parseHyperlinks(sheetXmlBytes, relsXmlBytes) {
        const links = {};
        if (!relsXmlBytes) return links;
        const relMap = {};
        const relsDoc = parseXml(new TextDecoder('utf-8').decode(relsXmlBytes));
        Array.from(relsDoc.getElementsByTagName('Relationship')).forEach(rel => {
            relMap[rel.getAttribute('Id')] = rel.getAttribute('Target');
        });
        const sheetDoc = parseXml(new TextDecoder('utf-8').decode(sheetXmlBytes));
        Array.from(sheetDoc.getElementsByTagName('hyperlink')).forEach(h => {
            const ref = h.getAttribute('ref');
            const rid = h.getAttribute('r:id');
            if (ref && rid && relMap[rid]) links[ref] = relMap[rid];
        });
        return links;
    }

    // Serial de data do Excel (época 30/12/1899) → 'DD/MM/AAAA'. Math.floor descarta a fração de hora.
    function serialParaData(serial) {
        const n = Math.floor(Number(serial));
        if (!Number.isFinite(n) || n <= 0) return '';
        const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
        const dd   = String(d.getUTCDate()).padStart(2, '0');
        const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
        const aaaa = d.getUTCFullYear();
        return `${dd}/${mm}/${aaaa}`;
    }

    // Extrai 'AAAA-MM-DD' do nome do arquivo (padrão de export: horas-trabalhadas_AAAA-MM-DD_a_AAAA-MM-DD.xlsx) → 'MES-AA'
    function mesDoNomeArquivo(nomeArquivo) {
        const m = (nomeArquivo || '').match(/(\d{4})-(\d{2})-\d{2}/);
        if (!m) return '';
        const mesIdx = parseInt(m[2], 10) - 1;
        if (mesIdx < 0 || mesIdx > 11) return '';
        return `${MESES[mesIdx]}-${m[1].slice(-2)}`;
    }

    function normalizarCabecalho(txt) {
        // NFD decompõe acentos em base + diacrítico; remove as marcas combinantes (acentos) na faixa Unicode U+0300-U+036F
        return (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    // Extrai { linhas, links } da primeira aba do .xlsx (menor número em xl/worksheets/sheetN.xml)
    async function lerXlsx(file) {
        const buffer = await file.arrayBuffer();
        const zip    = await lerZip(buffer);

        const sharedStrings = parseSharedStrings(zip.get('xl/sharedStrings.xml'));

        const nomesAbas = Array.from(zip.keys())
            .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
            .sort((a, b) => parseInt(a.match(/sheet(\d+)/)[1], 10) - parseInt(b.match(/sheet(\d+)/)[1], 10));
        if (nomesAbas.length === 0) throw new Error('Nenhuma planilha (aba) encontrada dentro do arquivo .xlsx.');

        const nomeAba = nomesAbas[0];
        const numAba  = nomeAba.match(/sheet(\d+)/)[1];
        const sheetBytes = zip.get(nomeAba);
        const relsBytes   = zip.get(`xl/worksheets/_rels/sheet${numAba}.xml.rels`);

        return {
            linhas: parseSheetXml(sheetBytes, sharedStrings),
            links: parseHyperlinks(sheetBytes, relsBytes),
        };
    }

    // Orquestra a leitura: localiza o cabeçalho, mapeia colunas por nome, filtra horas > 0, deduplica por protocolo
    async function parsearPlanilha(file) {
        if (!window.DecompressionStream) {
            throw new Error('Navegador sem suporte à leitura de .xlsx (é necessário Chrome/Edge 103+).');
        }

        const { linhas, links } = await lerXlsx(file);
        if (linhas.length === 0) throw new Error('Planilha vazia.');

        // Cabeçalho: primeira linha que contém "protocolo" e "professor" em alguma célula (não assume posição fixa)
        const headerRow = linhas.find(linha => {
            const textos = Object.values(linha.cells).map(normalizarCabecalho);
            return textos.some(t => t.includes('protocolo')) && textos.some(t => t.includes('professor'));
        });
        if (!headerRow) throw new Error('Não foi possível localizar o cabeçalho ("Protocolo" e "Professor") na planilha.');

        const mapaCampos = {
            protocolo:      ['protocolo'],
            nome:           ['professor'],
            cpf:            ['cpf'],
            email:          ['e-mail', 'email'],
            celular:        ['celular'],
            pis:            ['pis'],
            nascimento:     ['data de nascimento'],
            assinatura:     ['data de assinatura'],
            cep:            ['cep'],
            logradouro:     ['logradouro'],
            enderecoNumero: ['numero'],
            bairro:         ['bairro'],
            cidade:         ['cidade'],
            horas:          ['horas trabalhadas'],
            registro:       ['registro'],
        };
        const colunaPorCampo = {};
        Object.entries(headerRow.cells).forEach(([col, texto]) => {
            const norm = normalizarCabecalho(texto);
            for (const [campo, alvos] of Object.entries(mapaCampos)) {
                if (colunaPorCampo[campo]) continue;
                if (alvos.some(alvo => norm.includes(alvo))) colunaPorCampo[campo] = col;
            }
        });
        if (!colunaPorCampo.protocolo || !colunaPorCampo.nome) {
            throw new Error('Colunas obrigatórias "Protocolo 1Doc" e "Professor Credenciado" não encontradas.');
        }

        const protoRegex = /(\d+\.\d{3}\/\d{4})/;
        const vistos = new Set();
        let total = 0, descartados = 0;
        const registros = [];

        const idxHeader = linhas.indexOf(headerRow);
        linhas.slice(idxHeader + 1).forEach(linha => {
            const get = campo => {
                const col = colunaPorCampo[campo];
                return col ? String(linha.cells[col] || '').trim() : '';
            };
            const m = get('protocolo').match(protoRegex);
            if (!m) return; // linha sem protocolo válido (ex: rodapé, linha em branco)
            const numero = m[1];
            if (vistos.has(numero)) return;

            total++;

            const horas = parseFloat(get('horas').replace(',', '.')) || 0;
            if (horas <= 0) { descartados++; return; } // decisão do usuário: só importa quem trabalhou

            vistos.add(numero);
            registros.push({
                nome: get('nome'),
                numero,
                url: links[`${colunaPorCampo.protocolo}${linha.r}`] || '',
                registro: get('registro'),
                cpf: get('cpf').replace(/\D/g, ''),
                email: get('email'),
                celular: get('celular').replace(/\D/g, ''),
                pis: get('pis').replace(/\D/g, ''),
                nascimento: serialParaData(get('nascimento')),
                assinatura: serialParaData(get('assinatura')),
                cep: get('cep').replace(/\D/g, ''),
                logradouro: get('logradouro'),
                enderecoNumero: get('enderecoNumero'),
                bairro: get('bairro'),
                cidade: get('cidade'),
                horas,
            });
        });

        return { registros, total, descartados, mes: mesDoNomeArquivo(file.name) };
    }

    // ─── 3. DISPATCH ─────────────────────────────────────────────────────────

    if (location.href.includes('pg=painel') && !location.href.includes('pg=painel/ver')) {
        iniciarInbox();
    } else if (location.href.includes('pg=doc/ver') && lerModo() === 'coleta') {
        iniciarPaginaProtocolo();
    }
    verificarAvancoPendente(); // independente do modo — cobre os dois destinos possíveis após o envio

    // ════════════════════════════════════════════════════════════════════════
    // INBOX
    // ════════════════════════════════════════════════════════════════════════

    function iniciarInbox() {
        // Salvar URL limpa — remove params transitórios que o 1Doc injeta após ações
        // (forcaajax=1 causa toast + history.replaceState, confundindo a detecção de mudança de URL)
        try {
            const u = new URL(location.href);
            ['forcaajax', 'erros', 'rol'].forEach(p => u.searchParams.delete(p));
            localStorage.setItem(LS_INBOX_URL, u.toString());
        } catch {
            localStorage.setItem(LS_INBOX_URL, location.href);
        }

        let ultimaUrl      = '';
        let ultimaQtdLinks = -1;

        function tick() {
            const urlAtual = location.href;
            const links    = document.querySelectorAll('a.link_emissao_a');
            const qtd      = links.length;

            // Sempre re-aplicar destaques no modo coleta (idempotente)
            if (qtd > 0 && lerModo() === 'coleta') aplicarDestaques();

            const mudou = urlAtual !== ultimaUrl || qtd !== ultimaQtdLinks;

            ultimaUrl      = urlAtual;
            ultimaQtdLinks = qtd;

            if (qtd === 0) return;

            // Garante o painel mesmo que o 1Doc tenha removido o elemento do DOM
            const painelExiste = !!document.getElementById('folha-painel');
            if (!painelExiste) criarPainel();

            if (mudou || !painelExiste) atualizarPainel();
        }

        // MutationObserver: reage imediatamente quando o 1Doc insere os links no DOM via AJAX
        // (resolve o caso em que forcaajax=1 faz a URL mudar antes dos links aparecerem,
        // deixando o setInterval "achar" que nada mudou quando os links finalmente chegam)
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(tick, 100);
        });

        function iniciar() {
            observer.observe(document.body, { childList: true, subtree: true });
            tick();
            setInterval(tick, 1500);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar);
        } else {
            iniciar();
        }

        // BFCache: browser restaura a página do cache ao pressionar Voltar —
        // os setIntervals podem não reiniciar; forçar tick com estado resetado
        window.addEventListener('pageshow', e => {
            if (e.persisted) {
                ultimaUrl      = '';
                ultimaQtdLinks = -1;
                tick();
            }
        });
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
        renderizarBotoesTransferencia(painel);
    }

    // ── Modo Entrada ───────────────────────────────────────────────────────
    function renderizarModoEntrada(painel) {
        const lista       = lerLista();
        const arquivoInfo = lerArquivoInfo();

        // ── Import da planilha ────────────────────────────────────────────
        const labelImport = document.createElement('label');
        labelImport.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:4px;';
        labelImport.textContent = 'Planilha de horas trabalhadas (.xlsx):';
        painel.appendChild(labelImport);

        const dropZone = document.createElement('div');
        dropZone.id = 'folha-dropzone';
        dropZone.style.cssText = [
            'border:2px dashed #ccc', 'border-radius:6px',
            'padding:14px 10px', 'text-align:center',
            'font-size:12px', 'color:#888', 'cursor:pointer',
            'margin-bottom:6px', 'transition:background 0.15s,border-color 0.15s',
        ].join(';');
        dropZone.innerHTML = '📂 <strong style="color:#2980b9;">Importar planilha</strong> ou arraste aqui';
        painel.appendChild(dropZone);

        const msgImport = document.createElement('div');
        msgImport.id = 'folha-msg-import';
        msgImport.style.cssText = 'font-size:11px;margin-bottom:10px;min-height:14px;line-height:1.5;';
        if (arquivoInfo) {
            msgImport.style.color = '#555';
            msgImport.innerHTML = `<strong>${escapeHtml(arquivoInfo.nome)}</strong><br>${arquivoInfo.importados} importado(s) · ${arquivoInfo.descartados} sem horas trabalhadas`;
        }
        painel.appendChild(msgImport);

        const inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.accept = '.xlsx';
        inputFile.style.display = 'none';
        painel.appendChild(inputFile);

        const acionarImport = file => {
            if (!file) return;
            if (!/\.xlsx$/i.test(file.name)) {
                msgImport.textContent = 'Selecione um arquivo .xlsx.';
                msgImport.style.color = '#c0392b';
                return;
            }
            processarArquivoImportado(file, msgImport);
        };

        dropZone.addEventListener('click', () => inputFile.click());
        inputFile.addEventListener('change', () => acionarImport(inputFile.files[0]));
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.style.borderColor = '#27ae60';
            dropZone.style.background  = '#f6ffed';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#ccc';
            dropZone.style.background  = '';
        });
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.style.borderColor = '#ccc';
            dropZone.style.background  = '';
            acionarImport(e.dataTransfer.files[0]);
        });

        // ── Seletor de mês ─────────────────────────────────────────────────
        const labelMes = document.createElement('label');
        labelMes.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:4px;';
        labelMes.textContent = 'Mês de referência:';
        painel.appendChild(labelMes);

        const mesAtual = lerMes();
        const ano      = String(new Date().getFullYear()).slice(-2);

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

        // ── Resumo da lista atual ─────────────────────────────────────────
        if (lista.length > 0) {
            const resumoLista = document.createElement('div');
            resumoLista.style.cssText = 'font-size:11px;color:#555;margin-bottom:8px;';
            resumoLista.textContent = `${lista.length} professor(es) na lista.`;
            painel.appendChild(resumoLista);
        }

        // ── Botão Iniciar ──────────────────────────────────────────────────
        const btnIniciar = document.createElement('button');
        btnIniciar.textContent = '▶ Iniciar coleta';
        btnIniciar.disabled = lista.length === 0;
        btnIniciar.style.cssText = [
            'display:block', 'width:100%',
            'padding:7px 10px',
            'background:' + (lista.length === 0 ? '#a5d6b1' : '#27ae60'), 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:' + (lista.length === 0 ? 'not-allowed' : 'pointer'), 'font-size:13px',
        ].join(';');
        btnIniciar.addEventListener('click', () => {
            if (lerLista().length === 0) return;
            if (!lerMes()) {
                mesBtns.style.outline      = '2px solid #c0392b';
                mesBtns.style.borderRadius = '3px';
                return;
            }
            localStorage.setItem(LS_MODO, 'coleta');
            removerTodosDestaques();
            aplicarDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnIniciar);
    }

    // Lê o arquivo .xlsx selecionado/arrastado, decide se mescla ou substitui a lista e atualiza o resumo
    async function processarArquivoImportado(file, msgEl) {
        msgEl.textContent = 'Lendo planilha…';
        msgEl.style.color = '#555';

        let resultado;
        try {
            resultado = await parsearPlanilha(file);
        } catch (err) {
            msgEl.textContent = 'Erro ao importar: ' + err.message;
            msgEl.style.color = '#c0392b';
            return;
        }

        if (resultado.registros.length === 0) {
            msgEl.textContent = 'Nenhum professor com horas trabalhadas > 0 encontrado nesta planilha.';
            msgEl.style.color = '#c0392b';
            return;
        }

        const mesAtual  = lerMes();
        const mesNovo   = resultado.mes;
        const temColeta = lerColetados().length > 0;

        const aplicar = zerarProgresso => {
            salvarLista(resultado.registros);
            if (zerarProgresso) {
                localStorage.setItem(LS_COLETADOS, '[]');
                salvarPulados([]);
            }
            if (mesNovo) localStorage.setItem(LS_MES, mesNovo);
            localStorage.setItem(LS_ARQUIVO, JSON.stringify({
                nome: file.name, ts: Date.now(),
                total: resultado.total, importados: resultado.registros.length, descartados: resultado.descartados,
            }));
            atualizarPainel();
        };

        if (mesNovo && mesAtual && mesNovo !== mesAtual && temColeta) {
            const zerar = confirm(
                `Nova competência (${mesNovo}), diferente da atual (${mesAtual}).\n\n` +
                `Zerar o progresso (${lerColetados().length} coletado(s)) e substituir a lista?\n\n` +
                `OK = zerar progresso · Cancelar = manter progresso e mesclar`
            );
            aplicar(zerar);
        } else {
            aplicar(false);
        }
    }

    // ── Modo Coleta ────────────────────────────────────────────────────────
    function renderizarModoColeta(painel) {
        const lista      = lerLista();
        const coletados  = lerColetados();
        const pulados    = lerPulados();
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
            (pulados.length > 0 ? `Pulados: <strong style="color:#e67e22;">${pulados.length}</strong><br>` : '') +
            `Faltam: <strong style="color:${faltam > 0 ? '#c0392b' : '#27ae60'};">${faltam}</strong>`;
        painel.appendChild(stats);

        // Botão Abrir próximo pendente — fila de trabalho baseada nos links importados da planilha
        const proximo = proximoPendente();
        const btnProximo = document.createElement('button');
        btnProximo.disabled = !proximo;
        if (proximo) {
            const posicao = lista.findIndex(e => e.numero === proximo.numero) + 1;
            btnProximo.innerHTML = `▶ Abrir próximo pendente<br><span style="font-weight:400;font-size:11px;opacity:.9;">${escapeHtml(proximo.nome || proximo.numero)} (${posicao}/${total})</span>`;
        } else {
            btnProximo.textContent = '✓ Nenhum pendente';
        }
        btnProximo.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px',
            'padding:7px 10px',
            'background:' + (proximo ? '#27ae60' : '#ccc'), 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:' + (proximo ? 'pointer' : 'default'), 'font-size:12px', 'font-weight:700',
            'line-height:1.5', 'text-align:center',
        ].join(';');
        if (proximo) btnProximo.addEventListener('click', () => abrirProtocolo(proximo));
        painel.appendChild(btnProximo);

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

        const btnReimportar = document.createElement('button');
        btnReimportar.textContent = '📂 Reimportar planilha';
        btnReimportar.style.cssText = [
            'display:block', 'width:100%', 'margin-bottom:6px',
            'padding:6px 10px',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:12px',
        ].join(';');
        btnReimportar.addEventListener('click', () => {
            localStorage.setItem(LS_MODO, 'entrada');
            removerTodosDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnReimportar);

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
            salvarPulados([]);
            localStorage.removeItem(LS_MES);
            localStorage.removeItem(LS_ARQUIVO);
            localStorage.setItem(LS_MODO, 'entrada');
            removerTodosDestaques();
            atualizarPainel();
        });
        painel.appendChild(btnLimpar);
    }

    // ── Exportar / Importar ────────────────────────────────────────────────
    function renderizarBotoesTransferencia(painel) {
        const sep = document.createElement('div');
        sep.style.cssText = 'border-top:1px solid #eee;margin:10px 0 8px;';
        painel.appendChild(sep);

        const label = document.createElement('div');
        label.style.cssText = 'font-size:11px;color:#aaa;margin-bottom:5px;text-align:center;';
        label.textContent = 'Transferência entre navegadores';
        painel.appendChild(label);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;';

        const btnExp = document.createElement('button');
        btnExp.textContent = '⬇ Exportar';
        btnExp.title = 'Salvar dados em arquivo JSON';
        btnExp.style.cssText = [
            'flex:1', 'padding:5px 0',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:11px',
        ].join(';');
        btnExp.addEventListener('click', () => {
            const keys = [LS_LISTA, LS_COLETADOS, LS_PULADOS, LS_MODO, LS_MES, LS_INBOX_URL, LS_ARQUIVO];
            const data = {};
            keys.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `folha-frequencia-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
        row.appendChild(btnExp);

        const btnImp = document.createElement('button');
        btnImp.textContent = '⬆ Importar';
        btnImp.title = 'Carregar dados de arquivo JSON exportado';
        btnImp.style.cssText = [
            'flex:1', 'padding:5px 0',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:11px',
        ].join(';');
        btnImp.addEventListener('click', () => {
            const input  = document.createElement('input');
            input.type   = 'file';
            input.accept = '.json,application/json';
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    try {
                        const data = JSON.parse(e.target.result);
                        let count = 0;
                        Object.entries(data).forEach(([k, v]) => {
                            localStorage.setItem(k, v);
                            count++;
                        });
                        alert(`${count} chave(s) importada(s). A página será recarregada.`);
                        location.reload();
                    } catch {
                        alert('Arquivo inválido. Verifique se é o JSON exportado pelo script.');
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
        row.appendChild(btnImp);

        painel.appendChild(row);
    }

    function mostrarModalLista() {
        if (document.getElementById('folha-modal-lista')) return;
        const lista     = lerLista();
        const coletados = lerColetados();
        const colNums   = coletadosNumeros();
        const pulados   = lerPulados();

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
            (pulados.length > 0 ? `Pulados: <strong style="color:#e67e22;">${pulados.length}</strong> &nbsp;|&nbsp;` : '') +
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
            lista.forEach(entry => {
                const { nome, numero, celular, horas } = entry;
                const coletado = colNums.includes(numero);
                const pulado   = !coletado && pulados.includes(numero);
                const linkUrl  = entry.url || urlColetado(numero); // entry.url = link importado; fallback = url gravada na coleta (entradas antigas)

                const item = document.createElement('div');
                item.style.cssText = [
                    'display:flex', 'justify-content:space-between', 'align-items:center',
                    'padding:5px 16px', 'border-bottom:1px solid #f0f0f0',
                    coletado ? 'background:#f6ffed' : '',
                    linkUrl ? 'cursor:pointer' : '',
                ].join(';');

                const info = document.createElement('div');
                info.style.cssText = 'min-width:0;';
                const nomeEl = document.createElement('div');
                nomeEl.style.cssText = 'font-size:12px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;';
                nomeEl.textContent = nome || '—';
                const numEl = document.createElement('div');
                numEl.style.cssText = 'font-size:11px;color:#888;font-family:monospace;';
                numEl.textContent = numero + (horas ? ` · ${horas}h` : '');
                info.appendChild(nomeEl);
                info.appendChild(numEl);

                const badgeCss = [
                    'font-size:11px', 'padding:2px 7px', 'border-radius:10px',
                    'white-space:nowrap', 'margin-left:8px', 'flex-shrink:0',
                    'background:'       + (coletado ? '#dff0d8' : pulado ? '#fdebd0' : '#fcf8e3'),
                    'color:'            + (coletado ? '#3c763d' : pulado ? '#af601a' : '#8a6d3b'),
                    'border:1px solid ' + (coletado ? '#d6e9c6' : pulado ? '#fad7a0' : '#faebcc'),
                ].join(';');
                const badge = document.createElement('span');
                badge.style.cssText = badgeCss;
                badge.textContent = coletado ? '✓ Coletado' : pulado ? '⤼ Pulado' : '⏳ Pendente';

                // Lado direito: badge + botão WhatsApp
                const direita = document.createElement('div');
                direita.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
                direita.appendChild(badge);

                if (celular) {
                    const fone       = '55' + celular.replace(/\D/g, '');
                    const primeiroNome = (nome || '').split(' ')[0];
                    const mesAbrev   = lerMes().split('-')[0].toUpperCase();
                    const mesesNomes = {JAN:'janeiro',FEV:'fevereiro',MAR:'março',ABR:'abril',
                        MAI:'maio',JUN:'junho',JUL:'julho',AGO:'agosto',
                        SET:'setembro',OUT:'outubro',NOV:'novembro',DEZ:'dezembro'};
                    const mesExtenso = mesesNomes[mesAbrev] || lerMes();
                    let waUrl;
                    if (!coletado) {
                        const msg = `Olá, ${primeiroNome}! Aqui é o Raul, da Secretaria de Educação. Ainda não recebemos sua folha de frequência do mês de ${mesExtenso} pelo 1Doc, necessária para processar o seu pagamento.\n\nPara enviar, siga o tutorial: https://sme-pinda.vercel.app/credenciamento/Tutorial%20Folha%20de%20Frequ%C3%AAncia.pdf`;
                        waUrl = `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
                    } else {
                        waUrl = `https://wa.me/${fone}`;
                    }
                    const wa = document.createElement('a');
                    wa.href   = waUrl;
                    wa.target = '_blank';
                    wa.rel    = 'noopener';
                    wa.title  = celular;
                    wa.style.cssText = 'font-size:16px;text-decoration:none;line-height:1;flex-shrink:0;opacity:0.8;';
                    wa.textContent = '💬';
                    direita.appendChild(wa);
                }

                item.appendChild(info);
                item.appendChild(direita);

                if (linkUrl) {
                    item.addEventListener('click', e => {
                        if (e.target.closest('a')) return; // não interceptar o botão WhatsApp
                        overlay.remove();
                        location.href = linkUrl;
                    });
                }

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

            criarPainelProtocolo(numero);

            const jaColetado = coletadosNumeros().includes(numero);
            if (!jaColetado) {
                // Rolar para o fim da página
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }

            // Nome vem da lista salva (mais confiável que extração do DOM)
            const mesRef = lerMes();
            const nome   = nomeDoNumero(numero) || extrairNomeRemetente();

            // Interceptar cliques em links de anexo — sempre abre em janela na metade direita;
            // se já coletado, não copia clipboard nem reabre o dialog "foi salva?" (decisão do usuário)
            function interceptarAnexo(e) {
                const link = e.target.closest('a[href*="pg=doc/anexo"]');
                if (!link) return;
                e.preventDefault();
                e.stopPropagation();

                if (!jaColetado) {
                    // Escrever no clipboard dentro do gesto (clique)
                    const texto = [mesRef, nome].filter(Boolean).join(' ');
                    if (texto) navigator.clipboard.writeText(texto).catch(() => {});
                }

                const w    = Math.floor(screen.availWidth  / 2);
                const h    = screen.availHeight;
                const left = Math.floor(screen.availWidth  / 2);
                window.open(link.href, 'folha-anexo', `width=${w},height=${h},left=${left},top=0`);

                if (!jaColetado) mostrarDialogColeta(numero, interceptarAnexo);
            }

            document.addEventListener('click', interceptarAnexo, true);
        }, 400);
    }

    // Mini-painel fixo na página do protocolo: nome/posição na fila + navegação (Ver lista, Pular, Próximo, Inbox)
    function criarPainelProtocolo(numero) {
        if (document.getElementById('folha-painel-protocolo')) return;

        const lista    = lerLista();
        const idx      = lista.findIndex(e => e.numero === numero);
        const nome     = nomeDoNumero(numero) || extrairNomeRemetente();
        const coletado = coletadosNumeros().includes(numero);

        const painel = document.createElement('div');
        painel.id = 'folha-painel-protocolo';
        painel.style.cssText = [
            'position:fixed', 'top:60px', 'right:20px',
            'background:#fff', 'border:1px solid #ccc', 'border-radius:6px',
            'padding:10px 14px', 'z-index:99999',
            'box-shadow:0 2px 10px rgba(0,0,0,.2)',
            'font-size:12px', 'width:220px',
            'font-family:sans-serif', 'line-height:1.5',
        ].join(';');

        const titulo = document.createElement('div');
        titulo.style.cssText = 'font-weight:700;font-size:13px;color:#333;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        titulo.textContent = '📋 ' + (nome || numero);
        painel.appendChild(titulo);

        const posicao = document.createElement('div');
        posicao.style.cssText = 'color:#888;margin-bottom:8px;';
        posicao.textContent = (idx >= 0 ? `${idx + 1}/${lista.length}` : '') + (coletado ? ' · ✓ já coletado' : '');
        painel.appendChild(posicao);

        const btnCssSecundario = [
            'flex:1', 'padding:5px 0',
            'background:#f5f5f5', 'color:#333',
            'border:1px solid #ccc', 'border-radius:4px',
            'cursor:pointer', 'font-size:11px',
        ].join(';');

        const linha1 = document.createElement('div');
        linha1.style.cssText = 'display:flex;gap:5px;margin-bottom:5px;';
        const btnVer = document.createElement('button');
        btnVer.textContent = '👁 Ver lista';
        btnVer.style.cssText = btnCssSecundario;
        btnVer.addEventListener('click', mostrarModalLista);
        const btnInbox = document.createElement('button');
        btnInbox.textContent = '↩ Inbox';
        btnInbox.style.cssText = btnCssSecundario;
        btnInbox.addEventListener('click', navegarInbox);
        linha1.appendChild(btnVer);
        linha1.appendChild(btnInbox);
        painel.appendChild(linha1);

        const linha2 = document.createElement('div');
        linha2.style.cssText = 'display:flex;gap:5px;';
        const btnPular = document.createElement('button');
        btnPular.textContent = '⤼ Pular';
        btnPular.style.cssText = btnCssSecundario;
        btnPular.addEventListener('click', () => {
            const pulados = lerPulados();
            if (!pulados.includes(numero)) { pulados.push(numero); salvarPulados(pulados); }
            const proximo = proximoPendente();
            if (proximo) abrirProtocolo(proximo); else navegarInbox();
        });
        const btnProximo = document.createElement('button');
        btnProximo.textContent = '▶ Próximo';
        btnProximo.style.cssText = [
            'flex:1', 'padding:5px 0',
            'background:#27ae60', 'color:#fff',
            'border:none', 'border-radius:4px',
            'cursor:pointer', 'font-size:11px', 'font-weight:600',
        ].join(';');
        btnProximo.addEventListener('click', () => {
            const proximo = proximoPendente();
            if (proximo) abrirProtocolo(proximo); else navegarInbox();
        });
        linha2.appendChild(btnPular);
        linha2.appendChild(btnProximo);
        painel.appendChild(linha2);

        document.body.appendChild(painel);
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

    // Grava LS_AVANCO no clique em "Enviar" (feito manualmente pelo usuário) — consumido por
    // verificarAvancoPendente() na página seguinte, seja ela o protocolo ou o inbox
    function armarListenerEnvio(numeroAlvo) {
        let tentativas = 0;
        const ivBtn = setInterval(() => {
            tentativas++;
            const btn = document.getElementById('enviar_documento');
            if (btn) {
                clearInterval(ivBtn);
                btn.addEventListener('click', () => {
                    localStorage.setItem(LS_AVANCO, JSON.stringify({ numero: numeroAlvo, ts: Date.now() }));
                }, { capture: true, once: true });
            } else if (tentativas > 60) { // ~12s a 200ms
                clearInterval(ivBtn);
            }
        }, 200);
    }

    function responderProtocolo(numero) {
        // 1. Clicar no botão flutuante "Responder" (bf_v_1)
        const btnResp = document.querySelector('button.bf_v_1');
        if (!btnResp) { navegarInbox(); return; }
        btnResp.click();
        armarListenerEnvio(numero);

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

                        // 6. Marcar "Arquivar" — usuário completa o envio manualmente
                        setTimeout(() => {
                            const chkArquivar = document.querySelector('input[name="marcar_resolvido"]');
                            if (chkArquivar && !chkArquivar.checked) chkArquivar.click();
                        }, 400);
                    }, 300);
                }, 200);
            }, 200);
        }, 300);
    }

    // ════════════════════════════════════════════════════════════════════════
    // AVANÇO NA FILA (após clicar em Enviar)
    // ════════════════════════════════════════════════════════════════════════

    // Roda no dispatch de qualquer página — cobre os dois destinos possíveis após o envio da resposta
    function verificarAvancoPendente() {
        let avanco;
        try { avanco = JSON.parse(localStorage.getItem(LS_AVANCO) || 'null'); } catch { avanco = null; }
        if (!avanco) return;
        localStorage.removeItem(LS_AVANCO);
        if (Date.now() - avanco.ts > 5 * 60 * 1000) return; // expirado (>5 min) — evita disparo tardio

        mostrarDialogProximo(proximoPendente());
    }

    function mostrarDialogProximo(proximo) {
        if (document.getElementById('folha-dialog-proximo')) return;

        const overlay = document.createElement('div');
        overlay.id = 'folha-dialog-proximo';
        overlay.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,.35)', 'z-index:100000',
            'display:flex', 'align-items:center', 'justify-content:center',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:8px',
            'padding:22px 26px', 'max-width:360px', 'width:90%',
            'box-shadow:0 4px 24px rgba(0,0,0,.3)',
            'font-family:sans-serif', 'font-size:13px', 'text-align:center',
        ].join(';');

        const titulo = document.createElement('div');
        titulo.style.cssText = 'font-size:15px;font-weight:700;color:#333;margin-bottom:8px;';
        titulo.textContent = '✓ Resposta enviada';
        box.appendChild(titulo);

        const lista    = lerLista();
        const posicao  = proximo ? lista.findIndex(e => e.numero === proximo.numero) + 1 : 0;

        const sub = document.createElement('div');
        sub.style.cssText = 'color:#555;margin-bottom:20px;line-height:1.5;';
        sub.innerHTML = proximo
            ? `Próximo: <strong>${escapeHtml(proximo.nome || proximo.numero)}</strong> (${posicao}/${lista.length})`
            : 'Não há mais pendentes na lista.';
        box.appendChild(sub);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:10px;justify-content:center;';

        const btnAbrir = document.createElement('button');
        btnAbrir.textContent = proximo ? '▶ Abrir' : '✓ OK';
        btnAbrir.style.cssText = [
            'padding:8px 22px', 'background:#27ae60', 'color:#fff',
            'border:none', 'border-radius:4px', 'cursor:pointer',
            'font-size:13px', 'font-weight:700',
        ].join(';');
        btnAbrir.addEventListener('click', () => {
            overlay.remove();
            if (proximo) abrirProtocolo(proximo); else navegarInbox();
        });
        btns.appendChild(btnAbrir);

        if (proximo) {
            const btnInbox = document.createElement('button');
            btnInbox.textContent = '↩ Voltar ao inbox';
            btnInbox.style.cssText = [
                'padding:8px 18px', 'background:#f5f5f5', 'color:#555',
                'border:1px solid #ccc', 'border-radius:4px',
                'cursor:pointer', 'font-size:13px',
            ].join(';');
            btnInbox.addEventListener('click', () => { overlay.remove(); navegarInbox(); });
            btns.appendChild(btnInbox);
        }

        box.appendChild(btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        setTimeout(() => btnAbrir.focus(), 50);
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); btnAbrir.click(); }
        });
    }

})();
