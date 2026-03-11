# Product Requirements Document (PRD)
# Script de Credenciamento de Professores

---

## Script — `credenciamento.user.js`

**Nome (`@name`):** 1Doc - Credenciamento de Professores
**Domínio (`@match`):** `https://*.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/credenciamento.user.js`
**Versão atual:** `0.1.0`

---

**Público-Alvo:** Equipe de triagem/credenciamento (Renata, Catarina, Alessandra)

---

## 1. Objetivo e Visão Geral

Agilizar e padronizar o processo de credenciamento de professores substitutos analisados via 1Doc. O script é um painel completo de conferência que extrai dados automaticamente da página do protocolo, aplica o marcador de responsabilidade e permite ao usuário preencher um formulário de análise (CPF, função pretendida, regiões escolares) antes de copiar as informações para a planilha de controle no Google Sheets.

## 2. Casos de Uso (User Flow)

1. O usuário abre a página de um protocolo específico no 1Doc (`pg=doc/ver`).
2. O script injeta um botão "Credenciamento" no cabeçalho, ao lado dos marcadores.
3. Se a opção "Abrir automaticamente" estiver ativada, o script clica automaticamente no botão "Tabela" (`a.link_tabela_revisao_anexos`) da primeira mensagem para abrir o modal nativo `#modal_aprovacao_anexos`. Caso contrário, o usuário clica no botão "Credenciamento" para disparar a mesma ação.
4. O modal nativo abre (carrega a tabela de revisão de documentos via AJAX). O script aguarda o carregamento e injeta os controles de credenciamento dentro do modal:
   * **Header customizado** (verde institucional) com título, botões de credenciadora e checkboxes de preferência — substitui o header nativo do modal.
   * **Bloco de identificação** (fundo verde claro) com Protocolo e Data/Hora extraídos automaticamente.
   * **Formulário** inserido acima da tabela de documentos: Nome do candidato, CPF, Função pretendida, Regiões Escolares.
   * **Botões Sim/Não por categoria** em cada linha de categoria da tabela nativa. Um par de botões é exibido por categoria (identificada por algarismo romano I–XI), independentemente de quantos arquivos estejam nela. Os botões "Revisar" individuais por arquivo são ocultados. A seção "Outros documentos anexos" não recebe botões. No estado inicial ambos os botões estão com opacidade 100%; ao clicar num, o outro vai a 50%. O estado é armazenado em `avaliacoesDocs` (objeto `{ 'I': true, 'II': false, … }`).
   * **Botão "Copiar"** adicionado ao footer do modal.
5. Ao abrir, o script executa automaticamente a fase de extração:
   * Extrai número do protocolo, data/hora de envio e URL — exibidos no bloco de identificação.
   * Pré-preenche o campo editável "Nome do candidato" com o nome extraído da página.
   * Injeta `<script>` com jQuery para aplicar o marcador do credenciador selecionado e remover marcadores dos demais membros.
   * Habilita o botão "Copiar" e coloca o foco nele.
6. O usuário confere os dados e preenche/corrige:
   * **Nome do candidato** — campo editável pré-preenchido; deve ser corrigido se o protocolo foi enviado por outra pessoa.
   * **CPF** do candidato (campo com máscara automática `000.000.000-00`).
   * **Função pretendida** (múltipla seleção entre Educação Básica/Física/Artes).
   * **Regiões Escolares** de interesse (múltipla seleção entre as 5 regiões do município).
   * **Documentos** — pode clicar nos botões "Revisar" nativos e marcar como "OK" com os toggles injetados.
7. O usuário pode trocar o credenciador no cabeçalho a qualquer momento; o marcador é atualizado imediatamente.
8. O usuário clica em "Copiar" (ou pressiona **Enter**):
   * Os dados são copiados para a área de transferência (HTML rico + TSV).
   * O modal fecha automaticamente.
   * O usuário cola manualmente na planilha do Google Sheets (Ctrl+V).

---

## 3. Requisitos Funcionais (O que o script deve fazer)

### 3.1. Interface de Usuário (UI)

* **Botão de Ativação:** Injetar um botão na barra de ferramentas do 1Doc (`.btn-group-tags`), estilizado como `.btn-info` (verde tema 1Doc).
* **Modal Nativo Modificado:** O script utiliza o modal nativo `#modal_aprovacao_anexos` (Bootstrap 2) que já existe na página, acionado pelo botão "Tabela" (`a.link_tabela_revisao_anexos`). O script clica programaticamente nesse botão, aguarda o carregamento AJAX da tabela de documentos e injeta seus controles dentro do modal. Estrutura em 5 zonas:

  **Cabeçalho customizado (injetado, substitui o header nativo):** header verde escuro (`#005400`) com duas linhas:
  - *Linha 1:* título "Credenciamento" | botões de credenciadora | botão fechar nativo do modal.
  - *Linha 2 (separada por linha tênue):* dois checkboxes brancos lado a lado:
    - **Abrir automaticamente nos protocolos** (persiste em `localStorage`).
    - **Aplicar marcador automaticamente** (persiste em `localStorage`; quando desmarcado, todas as chamadas a `trocarMarcador` são bypassadas).

  **Bloco de Identificação (fundo verde claro institucional):** exibe os dados extraídos automaticamente — Protocolo, Data/Hora e Nome do candidato. O bloco é fixo (não está dentro do `.modal-body`), visível sempre no topo. Layout em duas linhas:
  - *Linha 1:* Protocolo | Data/Hora | **Nome do candidato** (input editável, ocupa o espaço restante com `flex: 1`). Protocolo e Data/Hora renderizados como `—` até a extração ser concluída.
  - *Linha 2 (separada por divider):* checkbox **"Este nome é igual ao que está na ficha de inscrição"** — começa **desmarcado** a cada protocolo. O credenciador precisa conferir o nome antes de marcar.

  **Formulário de credenciamento (dentro do `.modal-body`, acima da tabela):** campos preenchidos/corrigidos pelo usuário:
  * **CPF** — input com máscara progressiva `000.000.000-00` (armazena só dígitos).
  * **Função pretendida** — 3 botões, **múltipla seleção** (toggle): Educação Básica (verde institucional), Educação Física (vermelho), Artes (laranja). Botões inativos com `opacity: 0.35`; ativo com `opacity: 1` e leve escala.
  * **Regiões Escolares** — 5 botões, múltipla seleção (toggle): 1-Centro (amarelo), 2-Zona Oeste (verde institucional), 3-Zona Leste (vermelho), 4-Moreira César (verde), 5-Zona Rural (roxo).

  **Tabela de documentos (conteúdo nativo do 1Doc):** carregada via AJAX dentro de `.div_lista_aprovacao_anexos`. Exibe cada documento categorizado com nome, data e botão "Revisar" nativo. A linha "I - Ficha de Inscrição" é removida da tabela e movida para uma seção de destaque (`.cred-ficha-section`) posicionada entre o formulário e a tabela, contendo: label da categoria, inner table com os documentos e botões Sim/Não, e um aviso em fundo amarelo (*"Conferir se a ficha de inscrição é a versão retificada: 3 – Zona Leste, 4 – Moreira César."*).

  **Outros documentos anexos (injetado):** O script varre a tabela de despachos filhos (`#table_anexos_filhos`) em busca de anexos enviados em despachos posteriores que não são categorizados e portanto não aparecem na tabela nativa. Esses anexos são identificados comparando os `data-id_anexo` dos elementos `td.index` dentro de `#table_anexos_filhos` com os IDs decodificados (base64 `iea`) dos links do modal. A diferença é exibida numa seção "Outros documentos anexos" ao final da tabela, no mesmo formato visual (inner table com colunas Arquivo original, Em, Origem), com links clicáveis. A coluna "Em" mostra o número do despacho de onde o anexo foi extraído (obtido do `<strong data-im>` dentro do `table.despacho` ancestral). Nomes de arquivo longos são truncados via CSS (`text-overflow: ellipsis`, `max-width: 280px`) e o nome completo fica acessível em tooltip (`title`) ao fazer hover. Se não houver despachos posteriores ou anexos extras, a seção não aparece. Ao reabrir o modal (o AJAX do 1Doc recarrega a tabela), a seção é re-injetada automaticamente.

  **Rodapé (footer nativo do modal, modificado):** layout flex. Da esquerda para a direita:
  - **Chip de habilitação** (`#cred-chip-habilitacao`, `margin-right: auto`): atualizado em tempo real ao clicar nos botões Sim/Não e ao resetar o estado. Estados:
    - Cinza ("Em avaliação"): ao menos um dos 11 grupos sem avaliação.
    - Verde ("Habilitado(a)"): todos os 11 grupos marcados SIM.
    - Vermelho ("Inabilitado(a)"): ao menos um grupo marcado NÃO.
  - **Botão "Copiar"** (`btn-success`) adicionado antes do botão "Fechar" existente. Desabilitado durante a extração.

* **Foco:** botão "Copiar" recebe `.focus()` ao fim da extração.
* **Guard de injeção:** O atributo `data-cred-injetado` no modal evita duplicação. Na navegação SPA, os elementos injetados são removidos e o modal restaurado ao estado original.



### 3.2. Extração de Dados

O script deve ler o DOM da página do 1Doc para localizar:

* **Número do Protocolo:** Extraído do elemento `.nd_num`.
* **URL do Documento:** Capturada via `window.location.href`.
* **Nome do Candidato:** Capturado de forma resiliente do elemento `span.pp`, priorizando o atributo `data-content` ou filtrando o texto caso haja um selo de verificação (Gov.br).
* **Data e Hora de Envio:** Extraída via seletor direto `.well.well-header .row-fluid.horario > .span12 > span`. O container `.row-fluid.horario` é único na página (confirmado no DOM real). Se não encontrado, campo fica vazio e o dialog exibe "(não encontrada)".

### 3.3. Estado por Candidato (Não Persistido)

Os campos preenchidos manualmente são **descartados a cada novo protocolo** (não persistem em `localStorage`):

| Variável | Tipo | Comportamento |
|---|---|---|
| `cpfDigitos` | `string` (só dígitos) | Resetado ao reabrir o painel ou mudar de URL |
| `funcoesSelecionadas` | `string[]` | Múltipla seleção; reset limpa o array |
| `regioesSelecionadas` | `number[]` | Múltipla seleção; reset limpa `.active` de todos |
| `avaliacoesDocs` | `object` `{ [romana]: boolean }` | Avaliação Sim/Não por categoria; reset limpa o objeto |
| `#cred-nome-confirmado` | `checkbox (DOM)` | Desmarcado no reset; o credenciador confirma que o nome confere com a ficha |

O reset ocorre em dois momentos: na abertura do painel (`abrirDialog()`) e na detecção de mudança de URL (`setInterval`).

> **Hierarquia de validação ao clicar em "Copiar":**
> 1. Checkbox "Este nome é igual ao que está na ficha de inscrição" — deve estar marcado.
> 2. CPF — 11 dígitos completos.
> 3. Função pretendida — ao menos uma selecionada.
> 4. Regiões Escolares — ao menos uma selecionada.
> 5. Botões Sim/Não — todos os grupos de categoria devem ter avaliação.

### 3.4. Automação de Interface (Marcadores)

* O script deve aplicar a tag (marcador) correspondente ao nome selecionado no dropdown "Credenciador(a)" usando o componente **Select2** nativo do 1Doc.
* **Toda chamada a `trocarMarcador` é condicional:** só ocorre se o checkbox "Aplicar marcador automaticamente" (`autoMarcador`) estiver ativado. Se estiver desmarcado, nenhuma modificação nos marcadores é realizada, em nenhum momento.
* Ao **mudar o credenciador** (clique em outro botão no dialog), o script deve imediatamente (se `autoMarcador` ativo):
  1. Inserir o marcador do credenciador recém-selecionado.
  2. Remover quaisquer marcadores cujo nome corresponda a outros membros da equipe (`EQUIPE`) que estejam aplicados no documento.
* A mesma lógica de troca (inserir novo + remover outros) se aplica ao fluxo completo acionado pelo botão "Copiar" (se `autoMarcador` ativo).
* A manipulação **não deve usar** simulação de cliques via JavaScript (`MouseEvent`, `.click()`, `dispatchEvent`), pois essa abordagem falha de forma consistente no Select2 do 1Doc (o marcador não é persistido).
* A **única abordagem confiável** é injetar um `<script>` que usa o jQuery nativo da página para localizar a opção pelo texto e forçar a seleção via `.val(...).trigger('change')`, conforme o snippet da `documentacao_1doc.md` seção 5.3.

### 3.5. Formatação e Área de Transferência (Clipboard)

Os dados extraídos devem ser enviados para a área de transferência em dois formatos simultâneos para garantir compatibilidade com o Google Sheets:

* **Rich Text (HTML):** Formato principal, envelopado em tags `<table><tr><td>` com 25 colunas.
* **Plain Text (TSV):** Formato de fallback separado por tabulações (`\t`), mesma ordem e quantidade de colunas.

A função `copiarParaPlanilha()` lê diretamente das variáveis de estado do módulo (sem parâmetros). Mapeamento completo das 25 colunas (A–Y):

| Col | Cabeçalho | Valor | Fonte |
|-----|-----------|-------|-------|
| A | Data e hora | Texto livre | `dadosExtraidos.dataEnvio` |
| B | Protocolo 1Doc | Hyperlink no HTML; texto no plain | `dadosExtraidos.protocolo` + `.url` |
| C | Analisado por | `Renata`, `Catarina` ou `Alessandra` | `credenciadoraSalva` |
| D | Nome do professor | Texto livre | `#cred-nome-input` (fallback: `dadosExtraidos.candidato`) |
| E | CPF | 11 dígitos sem formatação | `cpfDigitos` |
| F | Educação Básica | `Educação Básica` ou vazio | `funcoesSelecionadas` (valor interno `Ed. Básica`) |
| G | Educação Física | `Educação Física` ou vazio | `funcoesSelecionadas` (valor interno `Ed. Física`) |
| H | Artes | `Artes` ou vazio | `funcoesSelecionadas` (valor interno `Artes`) |
| I | Reg. 1 - Centro | `1` ou vazio | `regioesSelecionadas` |
| J | Reg. 2 - Oeste | `2` ou vazio | `regioesSelecionadas` |
| K | Reg. 3 - Leste | `3` ou vazio | `regioesSelecionadas` |
| L | Reg. 4 - Moreira | `4` ou vazio | `regioesSelecionadas` |
| M | Reg. 5 - Rural | `5` ou vazio | `regioesSelecionadas` |
| N–X | Documentos I–XI | `sim`, `não` ou vazio | `avaliacoesDocs[cat]` (true→sim, false→não, ausente→vazio) |
| Y | Resultado | `habilitado` ou `inabilitado` | Calculado: algum `false` → inabilitado; todos `true` → habilitado |

Regras de transformação:
* **Funções:** Mapeamento explícito de rótulos internos (`Ed. Básica`→`Educação Básica`, `Ed. Física`→`Educação Física`, `Artes`→`Artes`).
* **Regiões:** Número inteiro (1–5) se selecionado, vazio se não.
* **Documentos:** Valores minúsculos (`sim`/`não`) conforme validação de dados da planilha.
* **Resultado:** Minúsculo, sem acento.

### 3.6. Área de Transferência — Passo Final

Após a cópia bem-sucedida para o clipboard, o painel fecha automaticamente. O usuário deve colar manualmente na planilha do Google Sheets via Ctrl+V. O formato HTML rico garante que o hiperlink na coluna C seja preservado ao colar.

---

## 4. Requisitos Não-Funcionais (Como deve ser feito)

* **Persistência de Estado:** As seguintes preferências são salvas no `localStorage` do navegador e mantidas entre sessões:
  | Chave | Valor padrão | Sobre |
  |---|---|---|
  | `1doc_cred_nome` | primeiro da equipe | Nome do credenciador selecionado |
  | `1doc_cred_auto` | `false` | Abrir dialog automaticamente nos protocolos |
  | `1doc_cred_marcador` | `true` | Aplicar/remover marcadores automaticamente |
* **Resiliência a SPA (Single Page Application):** O 1Doc navega entre protocolos sem recarregar a página (via AJAX). O script implementa `setInterval` para monitorar a mudança de URL. Ao detectar mudança, remove todos os elementos injetados do modal (header, info block, formulário, botão copiar), restaura o header original, limpa o atributo `data-cred-injetado` e reseta o estado do candidato.
* **Isolamento de Escopo:** O código roda em uma IIFE para não gerar conflito de variáveis globais com o sistema do 1Doc.
* **Performance:** A injeção e extração não travam a interface principal do usuário (UI Thread). O uso de `setTimeout` é necessário para dar tempo de o DOM do 1Doc ser completamente renderizado antes da extração. O AJAX do modal nativo é monitorado via `setInterval(100ms)` com timeout de segurança.
* **Sem modal custom:** O script não cria elementos de overlay ou modal próprios. Toda a UI é injetada dentro do modal nativo `#modal_aprovacao_anexos`.

---

## 5. Seletores DOM Específicos

| Seletor | Uso |
|---|---|
| `a.link_tabela_revisao_anexos` | Botão "Tabela" que abre o modal nativo de revisão. Script clica no primeiro encontrado. |
| `#modal_aprovacao_anexos` | Modal nativo Bootstrap 2 onde os controles são injetados. |
| `.div_lista_aprovacao_anexos` | Container dentro do modal-body onde o 1Doc carrega a tabela de documentos via AJAX. |
| `.modal-header` (dentro do modal) | Header original do modal, oculto pelo script via classe `cred-header-original-hidden`. |
| `.modal-footer .cancelar` | Botão nativo "Fechar" do modal, usado para fechar programaticamente. |
| `td.index[data-id_anexo]` | Célula de anexo na página. Contém `data-id_anexo` (ID único) e `data-id_emissao` (ID do despacho). O script compara esses IDs com os do modal para encontrar anexos extras. |