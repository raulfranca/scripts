// ==UserScript==
// @name         EducaFácil - Auto Preenchimento de Substituições
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Painel de preenchimento automático de solicitações de substituição no EducaFácil
// @author       Raul
// @match        https://professor.educapindamonhangaba.com.br/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
   *  CONSTANTES E ESTADO
   * ───────────────────────────────────────────── */
  const STORAGE_KEY = 'efSubs_rows';
  const STORAGE_STATUS_KEY = 'efSubs_status';

  const COL = {
    STATUS: 0,
    DATA_INICIO: 1,
    DATA_FIM: 2,
    DIAS: 3,
    PERIODO: 4,
    REGIAO: 5,
    ESCOLA: 6,
    TURMA: 7,
    PROFESSOR: 8,
  };

  let rows = [];      // Array de objetos com os dados do CSV
  let fillStatus = {}; // { index: 'pendente' | 'preenchido' | 'ignorado' }

  /* ─────────────────────────────────────────────
   *  PERSISTÊNCIA (localStorage)
   * ───────────────────────────────────────────── */
  function salvarDados() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(fillStatus));
  }

  function carregarDados() {
    try {
      const r = localStorage.getItem(STORAGE_KEY);
      const s = localStorage.getItem(STORAGE_STATUS_KEY);
      if (r) rows = JSON.parse(r);
      if (s) fillStatus = JSON.parse(s);
    } catch (e) {
      console.error('[EF-Sub] Erro ao carregar dados:', e);
    }
  }

  function limparDados() {
    rows = [];
    fillStatus = {};
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_STATUS_KEY);
  }

  /* ─────────────────────────────────────────────
   *  PARSING DO CSV (separado por TAB)
   * ───────────────────────────────────────────── */
  function parsearCSV(texto) {
    const linhas = texto.trim().split('\n');
    // Ignora a linha de cabeçalho se existir
    const inicio = linhas[0].toLowerCase().includes('status') ? 1 : 0;
    const resultado = [];

    for (let i = inicio; i < linhas.length; i++) {
      const colunas = linhas[i].split('\t').map(c => c.trim());
      if (colunas.length < 9) continue;
      resultado.push({
        status: colunas[COL.STATUS],
        dataInicio: colunas[COL.DATA_INICIO],
        dataFim: colunas[COL.DATA_FIM],
        dias: colunas[COL.DIAS],
        periodo: colunas[COL.PERIODO],
        regiao: colunas[COL.REGIAO],
        escola: colunas[COL.ESCOLA],
        turma: colunas[COL.TURMA],
        professor: colunas[COL.PROFESSOR],
      });
    }
    return resultado;
  }

  /* ─────────────────────────────────────────────
   *  HELPERS DE INTERAÇÃO COM ANGULAR / DOM
   * ───────────────────────────────────────────── */

  /** Dispara os eventos necessários para que o Angular reconheça a mudança num <input>. */
  function setInputValue(el, valor) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Aguarda um elemento aparecer no DOM (retorna Promise). */
  function aguardarElemento(seletor, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(seletor);
      if (el) return resolve(el);

      const obs = new MutationObserver(() => {
        const found = document.querySelector(seletor);
        if (found) {
          obs.disconnect();
          resolve(found);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        obs.disconnect();
        reject(new Error(`Timeout aguardando "${seletor}"`));
      }, timeout);
    });
  }

  /** Atraso simples (ms). */
  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Dispara os eventos necessários para que o Angular reconheça a mudança num <textarea>. */
  function setTextareaValue(el, valor) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Seleciona um valor num ng-select pelo seu ID.
   * Abre o dropdown, digita para filtrar e clica na opção mais próxima.
   * @param {string} id        — valor do atributo id do ng-select
   * @param {string} busca     — texto a digitar/pesquisar
   * @param {number} timeout   — ms máximo aguardando opções aparecerem
   */
  async function selecionarNgSelect(id, busca, timeout = 5000) {
    const ngEl = document.querySelector(`ng-select#${id}`);
    if (!ngEl) throw new Error(`ng-select#${id} não encontrado`);

    // Abre o dropdown
    ngEl.querySelector('.ng-select-container').click();
    await esperar(250);

    // Digita o texto de busca no input interno
    const input = ngEl.querySelector('.ng-input input');
    if (!input) throw new Error(`input interno não encontrado em ng-select#${id}`);
    input.value = busca;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await esperar(500);

    // Aguarda opções aparecerem (o painel pode estar dentro do ng-select
    // ou appendado ao body — ng-select trata os dois casos)
    const opcoes = await new Promise((resolve, reject) => {
      const inicio = Date.now();
      const verificar = () => {
        // Primeiro tenta dentro do próprio elemento
        let lista = ngEl.querySelectorAll('.ng-option:not(.ng-option-disabled)');
        // Se não achou, busca no painel global (appendTo: 'body')
        if (!lista.length) {
          lista = document.querySelectorAll('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
        }
        if (lista.length) return resolve(lista);
        if (Date.now() - inicio > timeout) {
          return reject(new Error(`Timeout: nenhuma opção para "${busca}" em ng-select#${id}`));
        }
        setTimeout(verificar, 120);
      };
      verificar();
    });

    // Escolhe a melhor correspondência (exata → contém → primeira)
    const termo = busca.toLowerCase().trim();
    let melhor = null;
    for (const op of opcoes) {
      const label = op.textContent.trim().toLowerCase();
      if (label === termo) { melhor = op; break; }
      if (!melhor && (label.includes(termo) || termo.includes(label))) melhor = op;
    }
    if (!melhor) melhor = opcoes[0];
    melhor.click();
    await esperar(300);
  }

  /**
   * Para o campo professor: digita o nome e pressiona Enter
   * (o ng-select aceita o valor livre sem exigir seleção de opção).
   */
  async function digitarNgSelectEnter(id, busca) {
    const ngEl = document.querySelector(`ng-select#${id}`);
    if (!ngEl) throw new Error(`ng-select#${id} não encontrado`);

    ngEl.querySelector('.ng-select-container').click();
    await esperar(250);

    const input = ngEl.querySelector('.ng-input input');
    if (!input) throw new Error(`input interno não encontrado em ng-select#${id}`);
    input.value = busca;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await esperar(400);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup',  { key: 'Enter', keyCode: 13, bubbles: true }));
    await esperar(200);
  }

  /* ─────────────────────────────────────────────
   *  PREENCHIMENTO DO FORMULÁRIO
   * ───────────────────────────────────────────── */
  async function preencherFormulario(row, idx) {
    try {
      // Verifica se o formulário está na página atual
      if (!document.querySelector('input#dataInicio')) {
        alert('[EF-Sub] Formulário não encontrado.\nNavegue até a página de nova solicitação antes de clicar em Preencher.');
        return;
      }

      atualizarStatusLinha(idx, 'preenchendo');
      renderizarLista();

      // ── 1. TIPO (sempre "Educação Básica") ──────────────────────────
      await selecionarNgSelect('tipo', 'Educação Básica');

      // ── 2. ESCOLA ───────────────────────────────────────────────────
      await selecionarNgSelect('escola', row.escola);
      // Aguarda o backend carregar turmas/professores vinculados à escola
      await esperar(600);

      // ── 3. PERÍODO ──────────────────────────────────────────────────
      await selecionarNgSelect('periodo', row.periodo);

      // ── 4. DATA INÍCIO ──────────────────────────────────────────────
      const inputInicio = document.querySelector('input#dataInicio');
      setInputValue(inputInicio, isoDate(row.dataInicio));
      await esperar(100);

      // ── 5. DATA FIM ─────────────────────────────────────────────────
      const inputFim = document.querySelector('input#dataFim');
      if (inputFim && row.dataFim) {
        setInputValue(inputFim, isoDate(row.dataFim));
        await esperar(100);
      }

      // ── 6. PROFESSOR SUBSTITUTO ─────────────────────────────────────
      // Ignora se o professor for "cancelado o pedido" ou vazio
      const profNome = (row.professor || '').trim();
      if (profNome && profNome.toLowerCase() !== 'cancelado o pedido') {
        await digitarNgSelectEnter('professor', profNome);
      }

      // ── 7. OBSERVAÇÃO (turma) ────────────────────────────────────────
      const textarea = document.querySelector('textarea#observacao');
      if (textarea && row.turma) setTextareaValue(textarea, row.turma);

      atualizarStatusLinha(idx, 'preenchido');
    } catch (e) {
      console.error(`[EF-Sub] Erro ao preencher linha ${idx}:`, e);
      atualizarStatusLinha(idx, 'erro');
    }
    salvarDados();
    renderizarLista();
  }

  /** Converte "dd/mm/aaaa" → "aaaa-mm-dd" (ISO). Retorna '' se inválido. */
  function isoDate(brDate) {
    if (!brDate) return '';
    const p = brDate.split('/');
    if (p.length !== 3) return '';
    return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }

  /* ─────────────────────────────────────────────
   *  ESTADO DE CADA LINHA
   * ───────────────────────────────────────────── */
  function atualizarStatusLinha(idx, status) {
    fillStatus[idx] = status;
  }

  function getStatusLinha(idx) {
    return fillStatus[idx] || 'pendente';
  }

  /* ─────────────────────────────────────────────
   *  INTERFACE (painel flutuante)
   * ───────────────────────────────────────────── */
  const CORES_STATUS = {
    pendente:     { bg: '#fff',    borda: '#ccc',    texto: '#333',   label: 'Pendente'    },
    preenchendo:  { bg: '#fff8e1', borda: '#f59e0b', texto: '#92400e', label: 'Preenchendo' },
    preenchido:   { bg: '#d1fae5', borda: '#10b981', texto: '#065f46', label: 'Preenchido'  },
    ignorado:     { bg: '#f3f4f6', borda: '#9ca3af', texto: '#6b7280', label: 'Ignorado'    },
    erro:         { bg: '#fee2e2', borda: '#ef4444', texto: '#991b1b', label: 'Erro'         },
  };

  function criarPainel() {
    const COLLAPSED_KEY = 'efSubs_collapsed';
    let recolhido = localStorage.getItem(COLLAPSED_KEY) === '1';

    // Painel principal — fixo no topo direito
    const painel = document.createElement('div');
    painel.id = 'efSubs_painel';
    Object.assign(painel.style, {
      position: 'fixed',
      top: '12px',
      right: '20px',
      width: '520px',
      maxHeight: '90vh',
      background: '#fff',
      border: '1px solid #d1d5db',
      borderRadius: '12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      zIndex: '99999',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    painel.innerHTML = `
      <div id="efSubs_header" style="padding:10px 16px;background:#0d9488;color:#fff;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;flex-shrink:0;">
        <strong>📋 EducaFácil — Substituições</strong>
        <span id="efSubs_chevron" style="font-size:12px;line-height:1;">▲</span>
      </div>

      <div id="efSubs_corpo" style="display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0;">
        <div id="efSubs_secaoImport" style="padding:12px 16px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
          <textarea id="efSubs_csv" placeholder="Cole aqui o CSV (separado por Tab)…"
            style="width:100%;height:90px;resize:vertical;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:monospace;box-sizing:border-box;"></textarea>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button id="efSubs_btnImportar" style="flex:1;padding:6px;background:#0d9488;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
              Importar / Substituir
            </button>
            <button id="efSubs_btnLimpar" style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;" title="Apagar todos os dados">
              🗑
            </button>
          </div>
          <div id="efSubs_msgImport" style="margin-top:4px;font-size:11px;color:#6b7280;"></div>
        </div>

        <div id="efSubs_resumo" style="padding:6px 16px;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;display:flex;gap:16px;flex-shrink:0;"></div>

        <div id="efSubs_lista" style="overflow-y:auto;flex:1;padding:8px 0;"></div>
      </div>
    `;

    document.body.appendChild(painel);

    // ── Collapse / Expand ─────────────────────────────────────────────
    function aplicarCollapse() {
      const corpo   = painel.querySelector('#efSubs_corpo');
      const chevron = painel.querySelector('#efSubs_chevron');
      if (recolhido) {
        corpo.style.display = 'none';
        chevron.textContent = '▼';
      } else {
        corpo.style.display = 'flex';
        chevron.textContent = '▲';
      }
    }

    painel.querySelector('#efSubs_header').addEventListener('click', () => {
      recolhido = !recolhido;
      localStorage.setItem(COLLAPSED_KEY, recolhido ? '1' : '0');
      aplicarCollapse();
    });

    aplicarCollapse();

    painel.querySelector('#efSubs_btnImportar').addEventListener('click', () => {
      const texto = painel.querySelector('#efSubs_csv').value;
      if (!texto.trim()) return;

      const novos = parsearCSV(texto);
      if (!novos.length) {
        painel.querySelector('#efSubs_msgImport').textContent = 'Nenhuma linha válida encontrada.';
        return;
      }

      rows = novos;
      // Mantém status das linhas que já existiam pelo índice
      const novoStatus = {};
      rows.forEach((_, i) => {
        novoStatus[i] = fillStatus[i] || 'pendente';
      });
      fillStatus = novoStatus;

      salvarDados();
      painel.querySelector('#efSubs_csv').value = '';
      painel.querySelector('#efSubs_msgImport').textContent = `${novos.length} linhas importadas.`;
      renderizarLista();
    });

    painel.querySelector('#efSubs_btnLimpar').addEventListener('click', () => {
      if (!confirm('Apagar todos os dados importados?')) return;
      limparDados();
      renderizarLista();
      painel.querySelector('#efSubs_msgImport').textContent = 'Dados apagados.';
    });
  }

  function renderizarLista() {
    const lista = document.getElementById('efSubs_lista');
    const resumo = document.getElementById('efSubs_resumo');
    if (!lista) return;

    if (!rows.length) {
      lista.innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;">Nenhuma linha importada.</div>';
      if (resumo) resumo.innerHTML = '';
      return;
    }

    // Resumo
    if (resumo) {
      const contagem = { pendente: 0, preenchido: 0, ignorado: 0, erro: 0, preenchendo: 0 };
      rows.forEach((_, i) => {
        const s = getStatusLinha(i);
        contagem[s] = (contagem[s] || 0) + 1;
      });
      resumo.innerHTML = `
        <span>Total: <strong>${rows.length}</strong></span>
        <span style="color:#10b981;">✓ ${contagem.preenchido}</span>
        <span style="color:#f59e0b;">⏳ ${contagem.pendente + contagem.preenchendo}</span>
        <span style="color:#6b7280;">— ${contagem.ignorado}</span>
        ${contagem.erro ? `<span style="color:#ef4444;">✗ ${contagem.erro}</span>` : ''}
      `;
    }

    // Linhas
    lista.innerHTML = rows.map((row, i) => {
      const st = getStatusLinha(i);
      const cor = CORES_STATUS[st] || CORES_STATUS.pendente;
      const isPendente = st === 'pendente' || st === 'erro';

      return `
        <div style="
          margin:4px 8px;
          padding:8px 10px;
          border:1px solid ${cor.borda};
          border-radius:6px;
          background:${cor.bg};
          color:${cor.texto};
          display:flex;
          align-items:flex-start;
          gap:8px;
        ">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${i + 1}. ${row.escola} — ${row.turma}
            </div>
            <div style="font-size:11px;margin-top:2px;color:inherit;opacity:0.8;">
              ${row.dataInicio}${row.dataFim && row.dataFim !== row.dataInicio ? ' → ' + row.dataFim : ''} · ${row.periodo} · ${row.professor}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
            ${isPendente ? `
              <button data-idx="${i}" class="efSubs_btnPreencher"
                style="padding:4px 8px;background:#0d9488;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;white-space:nowrap;">
                Preencher
              </button>` : ''}
            <button data-idx="${i}" class="efSubs_btnIgnorar"
              style="padding:4px 8px;background:transparent;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:11px;">
              ${st === 'ignorado' ? 'Restaurar' : 'Ignorar'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Delegação de eventos para os botões da lista
    lista.querySelectorAll('.efSubs_btnPreencher').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        preencherFormulario(rows[idx], idx);
      });
    });

    lista.querySelectorAll('.efSubs_btnIgnorar').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const atual = getStatusLinha(idx);
        atualizarStatusLinha(idx, atual === 'ignorado' ? 'pendente' : 'ignorado');
        salvarDados();
        renderizarLista();
      });
    });
  }

  /* ─────────────────────────────────────────────
   *  INICIALIZAÇÃO
   * ───────────────────────────────────────────── */
  function init() {
    carregarDados();
    criarPainel();
    renderizarLista();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
