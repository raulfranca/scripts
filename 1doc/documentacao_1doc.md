# Documentação de Desenvolvimento: Scripts de Usuário (TamperMonkey) para 1Doc

## 1\. Visão Geral e Boas Práticas
Este documento serve como base de conhecimento (Knowledge) para a criação de userscripts focados em otimizar fluxos de trabalho na plataforma 1Doc da Secretaria de Educação (SME).

O objetivo principal é criar scripts leves, com alta performance e que se integrem de forma orgânica à interface nativa do 1Doc.

**Diretrizes de IA:** Ao atuar como assistente de codificação, sempre consulte este documento para utilizar seletores, snippets e padrões de layout já homologados, evitando reescrever lógicas ou criar interfaces que fujam do padrão visual do sistema.

## 2\. Estrutura Padrão de Metadados (Cabeçalho)
Todos os scripts devem obrigatoriamente conter o cabeçalho abaixo. É fundamental para o sistema de atualização automática via GitHub:

```javascript
// ==UserScript==
// @name         1Doc - [Nome da Ferramenta]
// @namespace    http://tampermonkey.net/
// @version      1.0.0 // ATENÇÃO: Aumentar este número a cada atualização, usando SemVer.
// @description  [Descrição clara do que o script faz]
// @author       Raul
// @match        https://*.1doc.com.br/*
// @updateURL    https://raw.githubusercontent.com/SEU_USUARIO/scripts/main/1Doc/[nome-do-script].user.js
// @downloadURL  https://raw.githubusercontent.com/SEU_USUARIO/scripts/main/1Doc/[nome-do-script].user.js
// @grant        none
// ==/UserScript==
```

## 3\. Fluxo de Versionamento e Distribuição

1. **Desenvolvimento:** O código deve ser alterado na branch `dev` localmente (VSCode).

2. **Atualização:** Ao finalizar uma melhoria, a tag `@version` do script deve ser incrementada, usando a lógica do SemVer (MAJOR.minor.patch).

3. **Publicação:** Fazer o merge da branch `dev` para a `main` e realizar o push para o GitHub (https://github.com/raulfranca/scripts/1doc). Os colegas receberão a atualização automaticamente via TamperMonkey com base na `@updateURL`.

Aqui está o conteúdo bruto em um bloco de código Markdown padrão. Você pode usar o botão "Copiar" (Copy) no canto superior direito deste bloco para transferir todo o texto com as marcações perfeitamente preservadas.


## 4. Estrutura do DOM e Seletores Frequentes

O 1Doc possui uma estrutura DOM complexa e, por vezes, poluída. Abaixo estão os seletores confiáveis mapeados e testados para uso nos scripts:

### Navegação e Injeção de UI

* **`.btn-group-tags`**: Container excelente para injetar novos botões no cabeçalho de um documento. Deve ser usado com `.parentNode.insertBefore(novoElemento, tagsBtnGroup)` para garantir o alinhamento correto.
* **`#painel_setor`** ou verificação de URL `pg=doc/ver`: Indica que o usuário está visualizando a página de um documento/protocolo específico.
* **Botão Voltar:** `.icon-chevron-left` (Geralmente contido em um `<a>` ou `<button>`).

### Página do Inbox (`pg=painel/listar`)

* **Linhas da tabela:** `tr[id^="linha_"]` — cada linha corresponde a um protocolo no inbox. O ID segue o padrão `linha_XXXXXXX`.
* **Célula clicável (protocolo):** `td[data-href]` — contém a URL relativa do protocolo no atributo `data-href` (ex: `./?pg=doc/ver&hash=...`). Células sem esse atributo (checkbox, link ZIP) devem ser ignoradas.
* **Resolução de URL relativa:** `new URL(td.dataset.href, location.origin).href` — converte o `data-href` relativo para URL absoluta de forma segura.
* **Interceptação de cliques:** Use `e.target.closest('td[data-href]')` no listener da `<tr>` para identificar se o clique ocorreu em uma célula de protocolo; caso retorne `null`, ignore o evento. Combine com `e.preventDefault()` e `e.stopPropagation()` para suprimir a navegação padrão.
* **MutationObserver para carregamento incremental:** O inbox pode carregar mais linhas via scroll (paginação). Use `MutationObserver` em `document.body` com `{ childList: true, subtree: true }` e marque cada linha processada (ex: `dataset.credInboxOk = '1'`) para evitar listeners duplicados. Neste contexto, o `MutationObserver` é preferível ao `setInterval` porque as linhas chegam em lote via DOM insertion, não por alteração de conteúdo de elementos existentes.
* **Janela controlada (divisão de tela):** Protocolos devem ser abertos via `window.open('cred-protocolo', ...)` em vez de deixar o browser navegar diretamente. Isso permite posicionar e redimensionar a janela programaticamente (o browser não permite controlar janelas abertas diretamente pelo usuário). Reutilize uma referência `let protocoloWin` no escopo da IIFE — se a janela ainda está aberta, redirecione com `protocoloWin.location.href`; caso contrário, recrie com `window.open`.

### Extração de Dados do Documento

* **Número do Protocolo:** `.nd_num` (Geralmente contém texto como "15.932/2026"). Use `.innerText.trim()`.
* **Nomes/Contatos (Remetentes e Candidatos):** `span.pp` (*Atenção:* Existem múltiplos na página. O nome real geralmente está no atributo `data-content`).
* **Data e Hora de Envio do Protocolo:** `document.querySelector('.well.well-header .row-fluid.horario > .span12 > span')`. O container `.row-fluid.horario` é único na página e está dentro do card `.well.well-header` que representa o bloco de informações do protocolo. O seletor de filho direto (`>`) evita falsos positivos. Não requer regex — o elemento já contém exclusivamente o texto da data/hora (`DD/MM/AAAA HH:MM`).

### Timeline, Histórico e Despachos
O 1Doc renderiza o histórico de ações em blocos específicos. O monitoramento destes blocos é a forma mais segura de saber se a página terminou de carregar.

* **Caixa de Despacho/Ação:** `.timeline_conteudo.desp_notificacao`
* **Data e Hora:** `.despacho_data` (Texto interno).
* **Nome de quem executou a ação:** `.marcou_nome`
* **Departamento/Setor:** `.badge_env`
* **Texto da Ação (ex: "solicitou a assinatura de..."):** `.marcou_quem`
* **Badge de Status Interno (ex: Assinado):** `.btn-group.pull-right .badge-success`

### Ações de Barra Flutuante e Modais
* **Botão "Arquivar + Parar de acompanhar":** `.botao_flutuante_4.bf_v_7` ou o fallback seguro `button[title*="Arquivar"][title*="Parar de acompanhar"]`.
* **Botão de Confirmação em Modais (ex: Sim, arquivar):** `#sim` (ID nativo e global para botões de confirmação positiva nos modais do 1Doc).

### Modal de Revisão de Anexos (Tabela)

Usado pelo script de credenciamento como container principal de UI.

* **Botão "Tabela":** `a.link_tabela_revisao_anexos` — Existe um por mensagem/despacho que tem anexos. Possui `data-hash` com o hash do documento e `href="javascript:void(0);"`. O click handler está em JS externo (`functions_utils.js`), abre o modal e carrega o conteúdo via AJAX.
* **Modal:** `#modal_aprovacao_anexos` — Bootstrap 2 padrão (`.modal.hide.fade`). Fica visível com classe `.in` e `display:block`.
* **Container da tabela:** `.div_lista_aprovacao_anexos` — Dentro do `.modal-body`. O conteúdo (tabela com documentos e botões "Revisar") é carregado via AJAX após o click no botão "Tabela".
* **Header nativo:** `#modal_aprovacao_anexos .modal-header` — Contém título `<h3>` e botão fechar `data-dismiss="modal"`.
* **Footer nativo:** `#modal_aprovacao_anexos .modal-footer` — Contém botão "Fechar" com classe `.cancelar` e `data-dismiss="modal"`.
* **Responsividade vertical (telas pequenas):** O Bootstrap 2 não limita a altura do modal, então em monitores de baixa resolução o footer fica cortado. O padrão correto é transformar o modal em flex-coluna com `max-height: 94vh` e `top: 3vh` (ativado apenas com a classe `.in`), deixando o `.modal-body` crescer/encolher com `overflow-y: auto`. Todos os valores de posição precisam de `!important` porque o JS do Bootstrap 2 define `top` e `margin-top` via estilo inline, que tem precedência maior que CSS por classe.

```css
/* Aplicar via GM_addStyle */
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
```

Em telas grandes, o conteúdo raramente atinge 94vh e o modal se comporta como antes (sem scroll). Em telas pequenas, apenas o body rola; header e footer permanecem visíveis. O modal ocupa de `3vh` a `97vh` no máximo. **Não usar `transform: translateY(-50%)`** — o Bootstrap 2 pode não sobrescrever o `top` via `!important` uniformemente e o transform empurraria o modal para cima do viewport.

### Anexos em Despachos (Avulsos)

Anexos enviados em despachos posteriores ficam fora do modal de revisão. Cada anexo é uma `<tr>` dentro de uma `<table class="table_anexos">` adjacente ao bloco `anexos_area_despacho`.

* **Célula do anexo:** `td.index[data-id_anexo]` — Contém `data-id_anexo` (ID único do arquivo) e `data-id_emissao` (ID do despacho). Dentro dela: `<a class="underline">` com o link de download e `<small>nome_do_arquivo.pdf</small>`, e `<small class="tamanho">(281,94 KB)</small>`.
* **Tabela principal (primeiro despacho):** `table#table_anexos` (com classe `sombr`). **Atenção:** Contém os mesmos anexos que aparecem no modal — NÃO usar como fonte de "outros anexos".
* **Tabela de despachos filhos:** `table#table_anexos_filhos` (com classe `sm`, `width="90%"`). **Esta é a fonte correta** para identificar anexos avulsos de despachos posteriores.
* **Área de despacho:** `.anexos_area_despacho.anexos_area_{ID_EMISSAO}` — Container de cada despacho com seus links "Baixar" e "Tabela".
* **Relação com o modal:** Os links no modal contêm o parâmetro `iea` (base64 do `id_anexo`). Para comparar: `atob(iea)` retorna o ID em texto. Anexos da página cujo `data-id_anexo` não está no modal são "avulsos" (não categorizados).

> **Nota:** O modal é reutilizado na página (não destruído ao fechar). Scripts que injetam conteúdo devem usar um guard (`data-cred-injetado`) e remover/restaurar os elementos na navegação SPA.

> **Nota (AJAX reload):** Cada clique no botão "Tabela" recarrega o conteúdo de `.div_lista_aprovacao_anexos` via AJAX, **destruindo** quaisquer elementos injetados dentro do `.modal-body` (formulários, linhas de tabela, etc.). Elementos injetados **fora** do `.modal-body` (como headers customizados no topo do modal) sobrevivem ao reload. O guard `data-cred-injetado` deve verificar se os elementos internos ainda existem e re-injetá-los quando necessário.

### Componentes Nativos do 1Doc (Select2 / Marcadores)

O 1Doc usa a biblioteca Select2 para campos de seleção múltipla, como **Marcadores**. A manipulação visual é diferente da manipulação sistêmica.

* **Botão de Abrir Marcadores:** `a[title="Marcadores"]`
* **Input Invisível de Busca:** `.select2-search-field input, .select2-input` (Usado para focar e abrir o dropdown).
* **Dropdown:** `#select2-drop`
* **Select Oculto Original (Alvo principal para jQuery):** `#marcadores_ids`
* **Marcadores Ativos na Tela (Badges):** `.badge_marcador`

> **⚠️ ATENÇÃO — Simulação visual de cliques no Select2 NÃO funciona de forma confiável.**
> Simular `.select2-input.focus()` + `.click()` + `setTimeout` + `MouseEvent('mouseup')` foi testado e falha consistentemente (o marcador não é persistido). A **única abordagem confiável** é a injeção de `<script>` com jQuery descrita na seção 5.3 abaixo.

## 5. Snippets e Funções Padronizadas

### 5.1. Monitoramento Dinâmico de Carregamento (SPA)

Em vez de usar `setTimeout` cegos, a melhor forma de detectar se o 1Doc carregou os dados dinâmicos da página de um documento é contar os elementos da timeline:

```javascript
let ultimaUrl = location.href;
let ultimaQuantidadeTimeline = -1;

setInterval(() => {
    // Detecta mudança de rota na SPA
    if (location.href !== ultimaUrl) {
        ultimaUrl = location.href;
        ultimaQuantidadeTimeline = -1;
        // Fechar drawers ou resetar variáveis aqui
    }

    // Conta os elementos renderizados. Se mudar de 0 para X, a página carregou.
    // Se mudar de X para Y, o usuário rolou a página e carregou mais despachos antigos.
    const countAtual = document.querySelectorAll('.timeline_conteudo.desp_notificacao').length;
    
    if (countAtual > 0 && countAtual !== ultimaQuantidadeTimeline) {
        ultimaQuantidadeTimeline = countAtual;
        // Disparar lógica principal de varredura aqui
    }
}, 400); // 400ms é leve o suficiente para não afetar a performance
```

### 5.2. Extração Resiliente de Nomes (`span.pp`)

Função para extrair nomes de forma segura, ignorando ícones do Gov.br ou setores genéricos:

```javascript
function extrairNome() {
    const spans = document.querySelectorAll('span.pp');
    for (let span of spans) {
        // 1. Tenta atributo nativo (mais confiável)
        const dataContent = span.getAttribute('data-content');
        if (dataContent && dataContent.trim() !== '') return dataContent.trim();
        
        // 2. Fallback: Se contiver selo Gov.br, é pessoa física
        const imgGov = span.querySelector('img[src*="icon_verify"]');
        if (imgGov) {
            let clone = span.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
            return clone.textContent.replace(/[\n\r]+/g, '').replace(/\s+/g, ' ').trim();
        }
    }
    return "Nome não encontrado";
}

```

### 5.3. Interação Automatizada com Marcadores (Select2)

Simular cliques no Select2 do 1Doc pode falhar dependendo da latência da rede. A forma infalível de adicionar/remover marcadores é injetar um script que usa o jQuery nativo da página:

```javascript
// Exemplo: Adicionando ou removendo a tag "FALTA ASSINAR"
const script = document.createElement('script');
script.textContent = `
    (function() {
        if (typeof $ !== 'undefined' && $('#marcadores_ids').length) {
            var selectObj = $('#marcadores_ids');
            var targetOption = selectObj.find('option').filter(function() {
                return $(this).text().toUpperCase().indexOf('FALTA ASSINAR') > -1;
            });
            
            if (targetOption.length > 0) {
                var tagValue = targetOption.attr('value');
                var currentValues = selectObj.val() || [];
                var index = currentValues.indexOf(tagValue);
                
                // Para ADICIONAR: se index === -1, push(tagValue)
                // Para REMOVER: se index > -1, splice(index, 1)
                
                // Exemplo de Inclusão:
                if (index === -1) {
                    currentValues.push(tagValue);
                    selectObj.val(currentValues).trigger('change'); // Força o 1Doc a salvar
                }
            }
        }
    })();
`;
document.body.appendChild(script);
script.remove(); // Limpa o DOM imediatamente após a execução
```

### 5.4. Cópia Rich Text para Google Sheets

Para que o Sheets reconheça links clicáveis automaticamente, copie usando HTML. Esta é a etapa final do fluxo do `credenciamento.user.js` — após a cópia, o dialog fecha e o usuário cola manualmente na planilha (Ctrl+V).

A função `copiarParaPlanilha()` não recebe parâmetros — lê diretamente das variáveis de estado do módulo. Monta um array de **25 colunas (A–Y)** correspondentes à planilha de controle:

| Col | Conteúdo | Fonte |
|-----|----------|-------|
| A | Data e hora | `dadosExtraidos.dataEnvio` |
| B | Protocolo (hyperlink no HTML, texto no plain) | `dadosExtraidos.protocolo` + `.url` |
| C | Credenciadora | `credenciadoraSalva` |
| D | Nome do professor | `#cred-nome-input` |
| E | CPF (11 dígitos) | `cpfDigitos` |
| F–H | Funções (Educação Básica/Física, Artes) | `funcoesSelecionadas` com mapeamento de rótulos |
| I–M | Regiões 1–5 (número ou vazio) | `regioesSelecionadas` |
| N–X | Documentos I–XI (`sim`/`não`/vazio) | `avaliacoesDocs` |
| Y | Resultado (`habilitado`/`inabilitado`) | calculado de `avaliacoesDocs` |

Formato do clipboard:
* **`text/html`:** `<table><tr>` com 25 `<td>`, coluna B como `<a href="...">`.
* **`text/plain`:** TSV (valores separados por `\t`), protocolo sem URL.

```javascript
// Exemplo simplificado — ver código completo em credenciamento.user.js
const cells = [dataEnvio, protocolo, credenciadoraSalva, candidato, cpfDigitos,
    colF, colG, colH, ...colRegioes, ...colDocs, resultado];
const textData = cells.join('\t');
const htmlCells = cells.map((val, i) =>
    i === 1 && url ? `<td><a href="${url}">${val}</a></td>` : `<td>${val}</td>`
).join('');
const htmlData = `<table><tr>${htmlCells}</tr></table>`;
```
### 5.5 Automação de Modais (Interceptação Rápida)
Quando o script clica em um botão nativo (como Arquivar), o 1Doc abre um modal com animação. Use este snippet para interceptar e confirmar o modal invisivelmente:

```javascript
botaoAcaoNativo.click();

const monitorarDialog = setInterval(() => {
    const btnConfirmar = document.getElementById('sim');
    // Confirma que o botão existe, tem o texto certo e está visível na tela (offsetWidth > 0)
    if (btnConfirmar && btnConfirmar.innerText.includes('Arquivar') && btnConfirmar.offsetWidth > 0) {
        btnConfirmar.click();
        clearInterval(monitorarDialog);
    }
}, 100);

// Fallback de segurança para não vazar memória
setTimeout(() => clearInterval(monitorarDialog), 5000);
```

### 5.6 Scroll Suave e Destaque Visual (Highlight)
Para guiar o olhar do usuário até um elemento específico após uma ação:

```CSS
/* Adicionar via GM_addStyle */
.highlight-target { animation: piscarAmarelo 2s ease-out; }
@keyframes piscarAmarelo {
    0% { background-color: transparent; }
    20% { background-color: #fff3cd; }
    80% { background-color: #fff3cd; }
    100% { background-color: transparent; }
}
```
```javascript
// Função de Scroll (considerando o tamanho de painéis fixos no topo)
const offsetMenuSuperior = 160; // Altura do drawer/menu + respiro
const rect = elementoAlvo.getBoundingClientRect();
const offsetTop = rect.top + window.scrollY - offsetMenuSuperior;

window.scrollTo({ top: offsetTop, behavior: 'smooth' });

// Aplica a classe reiniciando a animação caso seja clicada 2x
elementoAlvo.classList.remove('highlight-target');
setTimeout(() => elementoAlvo.classList.add('highlight-target'), 10);
```

## 6. Diretrizes de Layout e Estilo (UI/UX)

Para manter a consistência visual, os elementos injetados devem parecer nativos do 1Doc ou usar padrões neutros e modernos. Utilize `GM_addStyle` para injetar CSS.

### Botões e Ícones Nativos
Mimetize as classes Bootstrap antigas utilizadas pela plataforma:
* **Classes:** `btn-inverse` (Preto/Cinza), `btn-success` (Verde para sucesso/arquivar), `btn-primary` (Azul para ações padrão), `btn-warning` ou cor customizada `#ffc107` (Amarelo para alertas/marcações).
* **Ícones Frequentes:** `icon-certificate` (Assinatura/Despacho), `icon-tags` (Marcadores), `icon-time` (Pendente), `icon-download-alt` (Arquivar). Sempre precedidos de `icon-white` se o fundo do botão for escuro.

### Padrão Arquitetural de Painéis (Drawers)
Para ferramentas de triagem ou fluxos complexos, evite modais no meio da tela que bloqueiem a leitura do documento. Use o padrão **Drawer Superior (Painel Deslizante)**:
* Deve ter posição fixa (`position: fixed`), começar oculto fora da tela (`top: -600px`) e deslizar para baixo ao receber uma classe `.open` (`top: 0px`).
* Deve conter uma borda inferior colorida (ex: `border-bottom: 4px solid #005fcc;`) para separar visualmente o painel do documento do 1Doc.

### Componentes de Interface Avançados

#### Toggle Switch (Estilo iOS)
Para opções de "Ligar/Desligar" (ex: "Auto-abrir painel"), substitua checkboxes convencionais por *switches* amigáveis:

```html
```html
<label class="toggle-container">
    <div class="switch">
        <input type="checkbox" id="meu-toggle">
        <span class="slider"></span>
    </div>
    Minha Opção
</label>
```
(Requer o CSS específico de switch definido nos nossos scripts base).

#### Chips / Etiquetas para Múltiplas Entidades
Para gestão de listas dinâmicas (ex: múltiplos nomes na busca), utilize Chips:
```html
<div class="name-chip">
    Luciana De Oliveira
    <button class="name-chip-close">&times;</button>
</div>
```
(CSS: Fundo #e6f2ff, texto e borda #005fcc, border-radius: 16px, display: inline-flex).


#### Botões Sim/Não com Toggle (Avaliação de Documentos)

Para avaliações binárias por categoria (ex: documentos ok/não ok), use pares de botões Bootstrap com comportamento de toggle:

* **Seleção:** clicar em um botão adiciona `.inativo` ao outro (cinza via `filter: grayscale(100%)` + `opacity: 0.5`).
* **Deselecionar:** clicar no botão já selecionado remove `.inativo` de ambos, restaurando o estado virgem.
* O estado é registrado em `avaliacoesDocs[categoria]` (`true`=Sim, `false`=Não, ausente=não avaliado).

```css
.cred-simnao-btn { opacity: 1; transition: opacity 0.15s, filter 0.15s; }
.cred-simnao-btn.inativo { opacity: 0.5; filter: grayscale(100%); }
```

```javascript
function selecionarBotao(clicado, outro, valor) {
    if (estado[cat] === valor) {        // toggle: deseleciona
        delete estado[cat];
        clicado.classList.remove('inativo');
        outro.classList.remove('inativo');
    } else {
        estado[cat] = valor;
        clicado.classList.remove('inativo');
        outro.classList.add('inativo');
    }
}
btnSim.addEventListener('click', () => selecionarBotao(btnSim, btnNao, true));
btnNao.addEventListener('click', () => selecionarBotao(btnNao, btnSim, false));
```

#### Validação de Formulário com Erro Visual + Scroll

Ao clicar no botão de ação final (ex: "Copiar"), validar os campos obrigatórios antes de prosseguir. O padrão adotado:

* Limpar todos os `.cred-alert-erro` existentes antes de revalidar.
* Exibir o erro **dentro da própria seção** do campo problemático (`.cred-form-section`), após os outros elementos.
* Rolar suavemente até o erro com `scrollIntoView`.
* A função retorna `false` no primeiro erro encontrado (fail-fast).

```css
.cred-alert-erro {
    background-color: #f2dede; border: 1px solid #ebccd1;
    color: #a94442; border-radius: 4px;
    padding: 6px 10px; font-size: 12px; margin-top: 6px;
}
```

```javascript
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

function validarFormulario() {
    if (cpfDigitos.length !== 11) {
        mostrarErroValidacao('cred-cpf', 'Preencha o CPF completo antes de continuar.');
        return false;
    }
    // Botões Sim/Não — todos os grupos precisam ter seleção
    const grupos = Array.from(modal.querySelectorAll('.cred-simnao-group'));
    const pendentes = grupos.filter(g => !(g.dataset.categoria in avaliacoesDocs));
    if (pendentes.length > 0) {
        const nomes = pendentes.map(getCategoriaLabel);
        const msg = pendentes.length === 1
            ? `Informe se o documento está válido ou não: ${nomes[0]}.`
            : `Informe se cada documento está válido ou não. Pendentes: ${nomes.join('; ')}.`;
        mostrarErroBotoes(pendentes[0], msg); // scroll até o 1º pendente
        return false;
    }
    // adicionar futuras verificações aqui (fail-fast: retorna false no primeiro erro)
    return true;
}

// Em copiarEFechar():
document.querySelectorAll('.cred-alert-erro').forEach(el => el.remove());
if (!validarFormulario()) return;
```

### Campos de Seleção em Dialogs (Evitar `<select>` nativo)

O elemento `<select>` nativo tem renderização controlada pelo SO/browser e **não deve ser usado em dialogs injetados no 1Doc**. Tentativas de corrigir o texto cortado via CSS (`flex-grow`, `flex: 1 1 0 !important`, `min-width: 0 !important`) falharam consistentemente porque o Bootstrap do 1Doc sobrescreve as regras e o rendering interno do browser não é controlável via CSS da página.

**Padrão correto: seletor de botões com classe `.active`**

```javascript
// Geração dos botões (substitui <select> + <option>)
const optionsHtml = OPCOES.map(nome =>
    `<button class="cred-opt-btn${nome === salvo ? ' active' : ''}" data-nome="${nome}">${nome}</button>`
).join('');

// HTML: usa <div> em vez de <select>
// <div class="cred-opts-group">${optionsHtml}</div>

// Event listener: clique alterna a classe .active
document.querySelectorAll('.cred-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cred-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        valorSalvo = btn.dataset.nome;
        localStorage.setItem('chave', valorSalvo);
    });
});
```

```css
.cred-opts-group { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.cred-opt-btn {
    padding: 5px 14px; border: 1px solid #ccc; border-radius: 4px;
    background: #f0f0f0; cursor: pointer; font-size: 13px; color: #333;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.cred-opt-btn:hover { background: #e0e0e0; border-color: #bbb; }
.cred-opt-btn.active { background: #2980b9; color: #fff; border-color: #2471a3; font-weight: bold; }
```

> A seção anterior "Campos `<select>` dentro de containers flex" está obsoleta. Este é o padrão vigente.

## 7. Arquitetura e Preferências de Código

Para facilitar a manutenção, todo script deve seguir as seguintes premissas arquiteturais:

1. **Isolamento Escopo:** Todo o código deve rodar dentro de uma IIFE (`(function() { 'use strict'; ... })();`) para não poluir o escopo global do 1Doc.
2. **Organização Modular:** Divida o script em blocos lógicos usando comentários de sessão:
    * `// 1. CONFIGURAÇÕES E ESTADOS`
    * `// 2. ESTILOS CSS (GM_addStyle)`
    * `// 3. CONSTRUÇÃO DA INTERFACE (DOM Injection)`
    * `// 4. LÓGICA CORE (Extração, Manipulação)`
    * `// 5. OBSERVAÇÃO E INICIALIZAÇÃO (MutationObserver, setInterval)`

3. **Gerenciamento de Estado (Local Storage com JSON):** Use `localStorage` para persistir preferências e listas do usuário. 
    * **Regra 1:** Sempre prefixe as chaves (ex: `1doc_assinatura_nomes`). 
    * **Regra 2:** Para listas ou objetos complexos, envolva a leitura num bloco `try/catch` utilizando `JSON.parse()`, garantindo que um dado corrompido no navegador não quebre o script.

4. **Tratamento de SPA (MutationObserver vs SetInterval):**
    * Use `MutationObserver` no `document.body` **apenas** para identificar a aparição de containers principais (ex: a injeção do seu próprio botão inicial).
    * Para verificar o **conteúdo dinâmico da página** (como o carregamento das caixas de despachos ou mudanças de URL), prefira um `setInterval` muito leve (ex: 400ms) avaliando o `length` dos elementos ou `location.href`. É muito mais seguro e consome menos memória do que observar mutações em árvores de DOM complexas como a do 1Doc.

5. **A abordagem Híbrida (UI + Framework):**
    * Sempre que o script precisar executar uma ação sistêmica nativa (ex: aplicar um marcador), tente simular o "caminho visual" (abrir dropdowns, mudar cores) para dar feedback ao usuário, mas **efetue a alteração de dados** via injeção de `<script>` usando as funções nativas e variáveis globais da página (ex: `$`, `jQuery`). Isso garante máxima resiliência, independentemente do tempo de renderização da UI.

6. **Foco e UX Orientada a Teclado:** 
    * Interfaces de triagem devem ser ágeis. Manipule ativamente o atributo `.disabled` dos botões de ação e use a função `.focus()` com pequenos atrasos (`setTimeout(..., 250)`) quando painéis deslizantes ou modais abrirem. O objetivo é permitir que o usuário conclua a ação final pressionando apenas a tecla `Enter`.