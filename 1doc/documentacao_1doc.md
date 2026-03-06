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

### Extração de Dados do Documento

* **Número do Protocolo:** `.nd_num` (Geralmente contém texto como "15.932/2026"). Use `.innerText.trim()`.
* **Nomes/Contatos (Remetentes e Candidatos):** `span.pp` (*Atenção:* Existem múltiplos na página. O nome real geralmente está no atributo `data-content`).

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

### Componentes Nativos do 1Doc (Select2 / Marcadores)

O 1Doc usa a biblioteca Select2 para campos de seleção múltipla, como **Marcadores**. A manipulação visual é diferente da manipulação sistêmica.

* **Botão de Abrir Marcadores:** `a[title="Marcadores"]`
* **Input Invisível de Busca:** `.select2-search-field input, .select2-input` (Usado para focar e abrir o dropdown).
* **Dropdown:** `#select2-drop`
* **Select Oculto Original (Alvo principal para jQuery):** `#marcadores_ids`
* **Marcadores Ativos na Tela (Badges):** `.badge_marcador`

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

Para que o Sheets reconheça links clicáveis automaticamente, copie usando HTML:

```javascript
async function copiarParaPlanilhaSheets(coluna1, textoLink, url, coluna3) {
    const htmlData = `<table><tr><td>${coluna1}</td><td><a href="${url}">${textoLink}</a></td><td>${coluna3}</td></tr></table>`;
    const textData = `${coluna1}\t${textoLink}\t${coluna3}`; // Fallback (TSV)

    const blobHtml = new Blob([htmlData], { type: 'text/html' });
    const blobText = new Blob([textData], { type: 'text/plain' });

    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    await navigator.clipboard.write(data);
}

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