# Índice — credenciamento.user.js

> Arquivo: `1doc/credenciamento/credenciamento.user.js`
>
> **Como usar:** ao invés de carregar o script inteiro, consulte este índice para localizar a função ou variável relevante e referencie `#nomeDaFunção` no chat do Copilot para carregar apenas o contexto necessário. Carregue o script completo apenas quando precisar da visão geral do fluxo.

---

## 1. Variáveis de Estado (linhas 19–41)

| Variável | Tipo | Persistência | Descrição |
|---|---|---|---|
| `EQUIPE` | `string[]` | constante | Nomes das credenciadoras |
| `ultimaUrl` | `string` | sessão | Detecta troca de página (SPA navigation) |
| `jaRodouNestaPagina` | `boolean` | sessão | Evita que o auto-abrir dispare mais de uma vez por página |
| `credenciadoraSalva` | `string` | `localStorage` (`1doc_cred_nome`) | Nome da credenciadora ativa |
| `autoAbrir` | `boolean` | `localStorage` (`1doc_cred_auto`) | Abre modal automaticamente ao entrar num protocolo |
| `autoMarcador` | `boolean` | `localStorage` (`1doc_cred_marcador`) | Aplica marcador automaticamente (default: `true`) |
| `dadosExtraidos` | `object\|null` | por candidato | `{ protocolo, url, candidato, dataEnvio }` — preenchido por `executarFluxo` |
| `funcoesSelecionadas` | `string[]` | por candidato | Funções pretendidas selecionadas (`'Ed. Básica'`, `'Ed. Física'`, `'Artes'`) |
| `regioesSelecionadas` | `number[]` | por candidato | Regiões escolares selecionadas (1–5) |
| `cpfDigitos` | `string` | por candidato | Apenas dígitos do CPF (11 chars) |
| `rgDigitos` | `string` | por candidato | Apenas dígitos do RG |
| `nacionalidade` | `string` | por candidato | Default: `'brasileira'` |
| `estadoCivil` | `string` | por candidato | Estado civil selecionado |
| `celularDigitos` | `string` | por candidato | Apenas dígitos do celular (10–11 chars) |
| `email` | `string` | por candidato | E-mail do candidato |
| `cep` | `string` | por candidato | Apenas dígitos do CEP (8 chars) |
| `logradouro` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `numero` | `string` | por candidato | Número do endereço (preenchimento manual) |
| `bairro` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `cidade` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `bancoNome` | `string` | por candidato | Nome do banco (campo de texto livre) |
| `bancoCOMPE` | `string` | por candidato | Sempre vazio — campo de texto livre, sem lookup |
| `chavePix` | `string` | por candidato | Chave Pix (default: CPF formatado; editável) |
| `avaliacoesDocs` | `object` | por candidato | `{ 'I': true/false, 'II': true/false, ... }` — `true`=Sim, `false`=Não, ausente=pendente |

---

## 2. Funções

### Seção 3 — Injeção de Controles no Modal

| Função | Linha | Assinatura | Descrição |
|---|---|---|---|
| `abrirModalTabela` | 316 | `() → boolean` | Clica em `a.link_tabela_revisao_anexos`; retorna `false` se não encontrado no DOM |
| `aguardarModalEInjetar` | 327 | `() → void` | Polling (100ms, até 10s) aguarda `#modal_aprovacao_anexos` visível e com tabela carregada; chama `injetarControlesNoModal` |
| `criarFormulario` | 360 | `() → HTMLElement` | Retorna `<div id="cred-form-container">` com campos: CPF, RG, Nacionalidade, Estado civil, Celular, E-mail, Função, Regiões |
| `formatarCelular` | 431 | `(digits: string) → string` | Formata string de dígitos em `(00) 00000-0000` (11 dígitos) ou `(00) 0000-0000` (10 dígitos); progressivo durante digitação |
| `registrarEventListenersFormulario` | 442 | `(modal: Element) → void` | Registra máscaras progressivas e handlers dos campos: CPF, RG, Nacionalidade, Estado civil, Celular, E-mail, Função (toggle múltiplo), Regiões (toggle múltiplo) |
| `injetarControlesNoModal` | 542 | `(modal: Element) → void` | **Orquestrador principal**: injeta header, info-block, formulário, ficha, outros-anexos, botões Sim/Não e footer; guard via atributo `data-cred-injetado`; chama `resetarEstadoCandidato` e `executarFluxo` |
| `moverFichaInscricao` | 675 | `(modal, modalBody, formContainer) → void` | Remove linha "I - Ficha de Inscrição" da tabela nativa e a reposiciona como `<div id="cred-ficha-inscricao">` acima do formulário; chama `adicionarColunaStatusNaTabela` para categoria `'I'` |
| `injetarOutrosAnexos` | 732 | `(modal: Element) → void` | Compara IDs de `#table_anexos_filhos` com os já no modal (via parâmetro `iea` base64); injeta linha `#cred-outros-anexos` com anexos avulsos de despachos posteriores |
| `criarGrupoBotoes` | 812 | `(categoria: string) → HTMLElement` | Cria `<div class="cred-simnao-group" data-categoria="…">` com botões Sim/Não; toggle: clique duplo deseleciona; atualiza `avaliacoesDocs` e chama `atualizarChipHabilitacao` |
| `adicionarColunaStatusNaTabela` | 846 | `(innerTable: Element, categoria: string) → void` | Reutiliza coluna "Status da revisão" da inner table; injeta `criarGrupoBotoes` com `rowspan`; oculta botões "Revisar" nativos; fallback: adiciona coluna no final |
| `injetarBotoesCategorias` | 897 | `(modal: Element) → void` | Itera linhas da tabela principal; para cada com algarismo romano (I–XI) chama `adicionarColunaStatusNaTabela` |
| `registrarEventListeners` | 915 | `(modal: Element) → void` | Registra handlers: seleção de credenciadora (persiste em `localStorage`, chama `trocarMarcador`), checkboxes de preferência, botão Copiar → `copiarEFechar`; chama `registrarEventListenersFormulario` |
| `atualizarChipHabilitacao` | 956 | `() → void` | Atualiza `#cred-chip-habilitacao`: verde = todos Sim, vermelho = ≥1 Não, cinza = algum pendente |
| `resetarEstadoCandidato` | 980 | `() → void` | Zera todas as variáveis por candidato e limpa os campos do formulário no DOM (inputs, checkboxes, botões toggle) |
| `abrirDialog` | 1027 | `() → void` | Se modal já aberto: re-injeta via `injetarControlesNoModal`; senão: chama `abrirModalTabela` + `aguardarModalEInjetar` |
| `fecharDialog` | 1042 | `() → void` | Clica no botão nativo `.cancelar` do footer do modal (Bootstrap 2 dismiss) |

### Seção 4 — Lógica de Extração e Cópia

| Função | Linha | Assinatura | Descrição |
|---|---|---|---|
| `isPaginaProtocolo` | 1054 | `() → boolean` | `location.href.includes('pg=doc/ver')` |
| `extrairNomeCandidato` | 1058 | `() → string` | Extrai nome de `span.pp`: prioriza atributo `data-content`; fallback: clone sem `<img>`; último fallback: mensagem manual |
| `extrairDataEnvio` | 1074 | `() → string` | Extrai data/hora de `.well.well-header .row-fluid.horario > .span12 > span` |
| `executarFluxo` | 1079 | `async () → void` | Extrai protocolo, URL, nome, data; tenta autoextração de celular/e-mail da `.media-body`; preenche info-block no DOM; ativa botão Copiar |
| `mostrarErroValidacao` | 1142 | `(campoId, mensagem) → void` | Insere `.cred-alert-erro` no `.cred-form-section` do campo e rola o modal até ele |
| `getCategoriaLabel` | 1158 | `(grupo: Element) → string` | Retorna rótulo legível da categoria: categoria I → lê `label.cred-section-label`; demais → primeira `<td>` da linha externa da tabela |
| `mostrarErroBotoes` | 1175 | `(primeiroGrupo, mensagem) → void` | Insere `.cred-alert-erro` próximo ao primeiro grupo pendente e rola até ele |
| `validarFormulario` | 1193 | `() → boolean` | Valida sequencialmente: nome confirmado (checkbox), CPF 11 dígitos, ≥1 função, ≥1 região, e-mail válido (se preenchido), todos os Sim/Não respondidos |
| `copiarEFechar` | 1237 | `async () → void` | Handler do botão Copiar: sem dados → chama `executarFluxo`; com dados → limpa erros, valida, chama `copiarParaPlanilha`, fecha modal |
| `copiarParaPlanilha` | 1261 | `async () → void` | Monta 25 colunas (A–Y); escreve `text/plain` e `text/html` (protocolo como hyperlink) via `navigator.clipboard.write` |
| `trocarMarcador` | 1318 | `(novoNome: string) → void` | Injeta `<script>` inline para alterar `#marcadores_ids` via jQuery do 1Doc: remove marcadores das outras credenciadoras, adiciona o da ativa |

### Seção 5 — Injeção do Botão na UI

| Função | Linha | Assinatura | Descrição |
|---|---|---|---|
| `injetarBotao` | 1362 | `() → void` | Insere `#btn-credenciamento` em `.btn-group-tags` apenas em páginas de protocolo; vincula click a `abrirDialog` |

### Seção 6 — Observação e Inicialização (não-funções)

| Elemento | Linha | Descrição |
|---|---|---|
| `observerUI` (MutationObserver) | 1383 | Observa mudanças em `document.body` para chamar `injetarBotao` quando o DOM for atualizado |
| `setInterval` 500ms | 1388 | Detecta troca de URL (SPA); limpa todos os elementos injetados e flags; dispara `abrirDialog` automático se `autoAbrir` estiver ativo |

---

## 3. IDs de Elementos DOM Injetados

| ID | Criado em | Descrição |
|---|---|---|
| `btn-credenciamento` | `injetarBotao` | Botão "Credenciamento" na barra do 1Doc |
| `cred-form-container` | `criarFormulario` | Container com todos os campos do candidato |
| `cred-ficha-inscricao` | `moverFichaInscricao` | Bloco destacado com a Ficha de Inscrição |
| `cred-outros-anexos` | `injetarOutrosAnexos` | Linha na tabela com anexos avulsos de despachos |
| `cred-btn-executar` | `injetarControlesNoModal` | Botão "Copiar"/"Processando..." no footer do modal |
| `cred-chip-habilitacao` | `injetarControlesNoModal` | Chip de status (Em avaliação / Habilitado / Inabilitado) |
| `cred-cpf` | `criarFormulario` | Input CPF (máscara `000.000.000-00`) |
| `cred-rg` | `criarFormulario` | Input RG (máscara `00.000.000-0`) |
| `cred-banco-input` | `criarFormulario` | Input Banco (campo de texto livre) |
| `cred-nacionalidade` | `criarFormulario` | Input Nacionalidade (default: `brasileira`) |
| `cred-celular` | `criarFormulario` | Input Celular (máscara `(00) 00000-0000`) |
| `cred-email` | `criarFormulario` | Input E-mail |
| `cred-nome-input` | `injetarControlesNoModal` | Input Nome do candidato (editável, preenchido por `executarFluxo`) |
| `cred-nome-confirmado` | `injetarControlesNoModal` | Checkbox "Este nome é igual ao que está na ficha de inscrição" |
| `cred-res-prot` | `injetarControlesNoModal` | Span com número do protocolo (preenchido por `executarFluxo`) |
| `cred-res-data` | `injetarControlesNoModal` | Span com data/hora de envio |
| `cred-auto-abrir` | `injetarControlesNoModal` | Checkbox "Abrir automaticamente nos protocolos" |
| `cred-auto-marcador` | `injetarControlesNoModal` | Checkbox "Aplicar marcador automaticamente" |
| `cred-funcao-group` | `criarFormulario` | Container dos botões de Função (`data-funcao`) |
| `cred-regiao-group` | `criarFormulario` | Container dos botões de Região (`data-regiao`) |
| `cred-estadocivil-group` | `criarFormulario` | Container dos botões de Estado civil (`data-estado`) |

---

## 4. Mapa de Chamadas

```
setInterval (500ms)
└─ abrirDialog
     ├─ abrirModalTabela
     └─ aguardarModalEInjetar
          └─ injetarControlesNoModal
               ├─ criarFormulario
               ├─ moverFichaInscricao
               │    └─ adicionarColunaStatusNaTabela → criarGrupoBotoes → atualizarChipHabilitacao
               ├─ injetarOutrosAnexos
               ├─ injetarBotoesCategorias
               │    └─ adicionarColunaStatusNaTabela (loop)
               ├─ registrarEventListeners
               │    ├─ registrarEventListenersFormulario
               │    ├─ trocarMarcador
               │    └─ copiarEFechar
               │         ├─ executarFluxo
               │         │    ├─ extrairNomeCandidato
               │         │    ├─ extrairDataEnvio
               │         │    ├─ formatarCelular
               │         │    └─ trocarMarcador
               │         ├─ validarFormulario
               │         │    ├─ mostrarErroValidacao
               │         │    ├─ mostrarErroBotoes
               │         │    └─ getCategoriaLabel
               │         ├─ copiarParaPlanilha
               │         └─ fecharDialog
               └─ resetarEstadoCandidato
                    └─ atualizarChipHabilitacao

observerUI (MutationObserver)
└─ injetarBotao → abrirDialog
```

---

## 5. Colunas da Planilha (output de `copiarParaPlanilha`)

| Col | Dado |
|---|---|
| A | Data de envio |
| B | Número do protocolo (hyperlink no HTML, texto puro no plain) |
| C | Credenciadora |
| D | Nome do candidato |
| E | CPF (apenas dígitos) |
| F | CEP (apenas dígitos) |
| G | Logradouro |
| H | Número |
| I | Bairro |
| J | Cidade |
| K | Código COMPE do banco (sempre vazio — campo de texto livre) |
| L | Nome do banco |
| M | Chave Pix |
| N | `Educação Básica` (se selecionada, senão vazio) |
| O | `Educação Física` (se selecionada, senão vazio) |
| P | `Artes` (se selecionada, senão vazio) |
| Q–U | Regiões 1–5 (número da região ou vazio) |
| V–AF | Documentos I–XI (`sim` / `não` / vazio) |
| AG | Resultado: `habilitado` ou `inabilitado` |
