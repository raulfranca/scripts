# Índice — credenciamento.user.js

> Arquivo: `1doc/credenciamento/credenciamento.user.js`
>
> **Como usar:** consulte este índice para identificar a função ou variável relevante pelo nome e depois busque-a no script via regex. Carregue o script completo apenas quando precisar da visão geral do fluxo.

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
| `dataNascimento` | `string` | por candidato | Data de nascimento no formato `'DD/MM/AAAA'`; vazio se não preenchido |
| `estadoCivil` | `string` | por candidato | Estado civil selecionado |
| `celularDigitos` | `string` | por candidato | Apenas dígitos do celular (10–11 chars) |
| `email` | `string` | por candidato | E-mail do candidato |
| `pisDigitos` | `string` | por candidato | Apenas dígitos do PIS/PASEP/NIT/NIS (11 chars); máscara `000.00000.00-0` |
| `cep` | `string` | por candidato | Apenas dígitos do CEP (8 chars) |
| `logradouro` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `numero` | `string` | por candidato | Número do endereço (preenchimento manual) |
| `bairro` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `cidade` | `string` | por candidato | Autopreenchido pelo ViaCEP; editável |
| `bancoNome` | `string` | por candidato | Nome do banco (campo de texto livre) |
| `bancoCOMPE` | `string` | por candidato | Sempre vazio — campo de texto livre, sem lookup |
| `chavePix` | `string` | por candidato | Chave Pix (default: CPF formatado; editável) |
| `avaliacoesDocs` | `object` | por candidato | `{ 'I': true/false, 'II': true/false, ... }` — `true`=Sim, `false`=Não, ausente=pendente |
| `concluido` | `boolean` | por candidato | `true` após clicar em "Concluir" com sucesso; persiste no `localStorage`. Ativa modo congelado ao restaurar progresso. |
| `aguardandoEnvioResposta` | `boolean` | por candidato / sessão | `true` entre a Fase 1 e a Fase 2 do fluxo de conclusão; resetado na navegação SPA. |
| `_deveAplicarMarcadoresResposta` | `boolean` | por candidato | Armazena a escolha do usuário sobre marcadores (da Fase 1) para ser usada na Fase 2. |
| `cicloAtual` | `string` | por candidato | Ciclo identificado pela data de envio (`'01'`–`'10'`, ou `''` se fora de intervalo). Atualizado por `aplicarMarcadorCiclo`; resetado em `resetarEstadoCandidato`. |
| `CICLOS` | `object[]` | constante | Períodos de recebimento de inscrições por ciclo (`{ num, inicio, fim }`). Declarado no escopo de módulo (seção 1). |
| `_salvarProgressoTimer` | `number\|null` | sessão | Timer ID do debounce de auto-save (300ms) |
| `PROGRESSO_PREFIX` | `string` | constante | `'1doc_cred_progresso_'` — prefixo das chaves de progresso no localStorage |
| `PROGRESSO_TTL_DIAS` | `number` | constante | `30` — dias após os quais entradas órfãs são removidas |

---

## 2. Funções

### Seção 3 — Injeção de Controles no Modal

| Função | Descrição |
|---|---|
| `abrirModalTabela` | Clica em `a.link_tabela_revisao_anexos`; retorna `false` se não encontrado no DOM |
| `aguardarModalEInjetar` | Polling (100ms, até 10s) aguarda `#modal_aprovacao_anexos` visível e com tabela carregada; chama `injetarControlesNoModal` |
| `criarFormulario` | Retorna `<div id="cred-form-container">` com campos: CPF, RG, Nacionalidade, Estado civil, Celular, E-mail, Função, Regiões |
| `formatarCelular` | Formata string de dígitos em `(00) 00000-0000` (11 dígitos) ou `(00) 0000-0000` (10 dígitos); progressivo durante digitação |
| `registrarEventListenersFormulario` | Registra máscaras progressivas e handlers dos campos: CPF, RG, Nacionalidade, Estado civil, Celular, E-mail, Função (toggle múltiplo), Regiões (toggle múltiplo) |
| `injetarControlesNoModal` | **Orquestrador principal**: injeta header, info-block, formulário, ficha, outros-anexos, botões Sim/Não e footer; guard via atributo `data-cred-injetado`; chama `resetarEstadoCandidato` e `executarFluxo` |
| `moverFichaInscricao` | Remove linha "I - Ficha de Inscrição" da tabela nativa e a reposiciona como `<div id="cred-ficha-inscricao">` acima do formulário; chama `adicionarColunaStatusNaTabela` para categoria `'I'` |
| `moverDocIdentidade` | Remove linha "II – Cópia de documento de Identidade..." da tabela nativa e a injeta como `<div id="cred-doc-identidade">` no final do `formContainer` (seção Dados Pessoais); chama `adicionarColunaStatusNaTabela` para categoria `'II'`; pula categoria II em `injetarBotoesCategorias` |
| `injetarOutrosAnexos` | Compara IDs de `#table_anexos_filhos` com os já no modal (via parâmetro `iea` base64); injeta linha `#cred-outros-anexos` com anexos avulsos de despachos posteriores |
| `criarGrupoBotoes` | Cria `<div class="cred-simnao-group" data-categoria="…">` com botões Sim/Não; toggle: clique duplo deseleciona; atualiza `avaliacoesDocs` e chama `atualizarChipHabilitacao` |
| `adicionarColunaStatusNaTabela` | Reutiliza coluna "Status da revisão" da inner table; injeta `criarGrupoBotoes` com `rowspan`; oculta botões "Revisar" nativos; fallback: adiciona coluna no final |
| `injetarBotoesCategorias` | Itera linhas da tabela principal; para cada com algarismo romano (I–XI) chama `adicionarColunaStatusNaTabela` |
| `registrarEventListeners` | Registra handlers: seleção de credenciadora (persiste em `localStorage`, chama `trocarMarcador`), checkboxes de preferência, botão Copiar → `copiarEFechar`, botão Dúvida → salva progresso + aplica marcador "Dúvida" + navega ao inbox; chama `registrarEventListenersFormulario` |
| `atualizarChipHabilitacao` | Atualiza `#cred-chip-habilitacao`: verde = todos Sim, vermelho = ≥1 Não, cinza = algum pendente |
| `resetarEstadoCandidato` | Zera todas as variáveis por candidato e limpa os campos do formulário no DOM (inputs, checkboxes, botões toggle) |

### Seção 4B — Persistência de Progresso (localStorage)

| Função | Descrição |
|---|---|
| `salvarProgresso` | Serializa todos os campos do candidato + nome/confirmação e grava em `localStorage` com chave `PROGRESSO_PREFIX + protocolo`. Só opera se `dadosExtraidos` existir. |
| `agendarSalvarProgresso` | Debounce (300ms) para `salvarProgresso`. Chamado pelos event listeners de input/click no formulário e botões Sim/Não. |
| `carregarProgresso` | Busca progresso salvo no localStorage. Retorna objeto parsed ou `null`. |
| `limparProgresso` | Remove a chave de progresso do localStorage. Chamado após cópia bem-sucedida. |
| `restaurarProgresso` | Restaura variáveis JS e DOM (inputs, toggles, botões Sim/Não) a partir de um objeto de progresso salvo. Campos vazios no progresso não sobrescrevem auto-extraídos. Exibe toast "Progresso restaurado" com botão "Descartar". Chama `atualizarChipHabilitacao`. |
| `limparProgressoAntigo` | Varre chaves `1doc_cred_progresso_*` e remove as com `ts` mais antigo que 30 dias. Chamado uma vez na inicialização. |
| `abrirDialog` | Se modal já aberto: re-injeta via `injetarControlesNoModal`; senão: chama `abrirModalTabela` + `aguardarModalEInjetar` |
| `fecharDialog` | Clica no botão nativo `.cancelar` do footer do modal (Bootstrap 2 dismiss) |

### Seção 4 — Lógica de Extração e Cópia

| Função | Descrição |
|---|---|
| `isPaginaProtocolo` | `location.href.includes('pg=doc/ver')` |
| `extrairNomeCandidato` | Extrai nome de `span.pp`: prioriza atributo `data-content`; fallback: clone sem `<img>`; último fallback: mensagem manual |
| `extrairDataEnvio` | Extrai data/hora de `.well.well-header .row-fluid.horario > .span12 > span` |
| `executarFluxo` | Extrai protocolo, URL, nome, data; tenta autoextração de celular/e-mail da `.media-body`; preenche info-block no DOM; ativa botão Copiar |
| `mostrarErroValidacao` | Insere `.cred-alert-erro` no `.cred-form-section` do campo e rola o modal até ele |
| `getCategoriaLabel` | Retorna rótulo legível da categoria: categoria I → lê `label.cred-section-label`; demais → primeira `<td>` da linha externa da tabela |
| `mostrarErroBotoes` | Insere `.cred-alert-erro` próximo ao primeiro grupo pendente e rola até ele |
| `validarFormulario` | Valida sequencialmente (fail-fast): nome confirmado (checkbox), CPF 11 dígitos, RG, data de nascimento preenchida/válida (≥18 anos), estado civil, endereço (CEP/logradouro/número/bairro/cidade), celular, e-mail, banco, Pix, PIS, ≥1 função, ≥1 região, todos os Sim/Não respondidos |
| `copiarEFechar` | **Fase 1:** valida, aplica marcadores credenciadora/ciclo/habilitado, seta `concluido=true`, salva progresso e chama `executarFase1Conclusao`. **Modo concluído:** apenas copia e abre planilha. |
| `aguardarElemento` | Polling (100ms) que aguarda um elemento no DOM por seletor CSS + filtro opcional; resolve com o elemento ou `null` após timeout. |
| `executarFase1Conclusao` | Orquestra o fluxo pós-modal: fecha dialog → clica "Responder" nativo → insere modelo TinyMCE → seleciona destinatário Select2 → seta `aguardandoEnvioResposta=true` → exibe dialog de aviso. |
| `mostrarDialogVerificarMensagens` | Exibe overlay com aviso para o usuário conferir se há novas mensagens no protocolo antes de enviar a resposta padrão. |
| `removerMarcadoresCredenciamento` | Remove do select2 todos os marcadores das credenciadoras (`EQUIPE`) e de status (Habilitado, Inabilitado, Conferido). Chamado pelo botão "Descartar" do toast. |
| `aplicarMarcadorResultado` | Adiciona marcador pelo nome exato. Habilitado ↔ Inabilitado se remove mutuamente. Conferido é só acrescido. |
| `ativarModoCongelado` | Seta `concluido=true`, desabilita inputs/botões do formulário, troca botão para "Copiar" e injeta `#cred-btn-editar` amarelo |
| `desativarModoCongelado` | Seta `concluido=false`, re-habilita campos, remove `#cred-btn-editar`, restaura "Concluir", chama `atualizarBotaoConcluir` e `salvarProgresso` |
| `copiarParaPlanilha` | Monta 38 colunas (A–AL); escreve `text/plain` e `text/html` (protocolo como hyperlink) via `navigator.clipboard.write`. Última coluna (AL) contém `cicloAtual`. |
| `aplicarMarcadorCiclo` | Calcula o ciclo com base em `dataEnvio` ("DD/MM/YYYY HH:MM"); aplica o marcador `— 01`–`— 10` no select2 via script inline; só age se o marcador correto ainda não estiver selecionado; atualiza `cicloAtual`. Usa `CICLOS` do escopo de módulo. |
| `trocarMarcador` | Injeta `<script>` inline para alterar `#marcadores_ids` via jQuery do 1Doc: remove marcadores das outras credenciadoras, adiciona o da ativa |

### Seção 5 — Injeção do Botão na UI

| Função | Descrição |
|---|---|
| `injetarBotao` | Insere `#btn-credenciamento` em `.btn-group-tags` apenas em páginas de protocolo; vincula click a `abrirDialog` |

### Seção 6 — Observação e Inicialização (não-funções)

| Elemento | Descrição |
|---|---|
| `observerUI` (MutationObserver) | Observa mudanças em `document.body` para chamar `injetarBotao` quando o DOM for atualizado |
| `setInterval` 500ms | Detecta troca de URL (SPA); limpa todos os elementos injetados e flags; dispara `abrirDialog` automático se `autoAbrir` estiver ativo |

---

## 3. IDs de Elementos DOM Injetados

| ID | Criado em | Descrição |
|---|---|---|
| `btn-credenciamento` | `injetarBotao` | Botão "Credenciamento" na barra do 1Doc |
| `cred-form-container` | `criarFormulario` | Container com todos os campos do candidato |
| `cred-ficha-inscricao` | `moverFichaInscricao` | Bloco destacado com a Ficha de Inscrição |
| `cred-doc-identidade` | `moverDocIdentidade` | Bloco com o doc de identidade (categoria II) injetado ao final do `formContainer`, dentro de Dados Pessoais |
| `cred-outros-anexos` | `injetarOutrosAnexos` | Linha na tabela com anexos avulsos de despachos |
| `cred-btn-duvida` | `injetarControlesNoModal` | Botão "Dúvida" (vermelho) no footer; visível apenas enquanto `_estaCompleto()` é falso |
| `cred-btn-executar` | `injetarControlesNoModal` | Botão "Copiar"/"Processando..." no footer do modal |
| `cred-chip-habilitacao` | `injetarControlesNoModal` | Chip de status (Em avaliação / Habilitado / Inabilitado) |
| `cred-cpf` | `criarFormulario` | Input CPF (máscara `000.000.000-00`) |
| `cred-rg` | `criarFormulario` | Input RG (máscara `00.000.000-0`) |
| `cred-banco-input` | `criarFormulario` | Input Banco (campo de texto livre) |
| `cred-nacionalidade` | `criarFormulario` | Input Nacionalidade (default: `brasileira`) |
| `cred-nascimento` | `criarFormulario` | Input Data de Nascimento (máscara `DD/MM/AAAA`; inputmode numeric) |
| `cred-nascimento-picker-btn` | `criarFormulario` | Botão calendário que aciona o `input[type=date]` nativo oculto |
| `cred-nascimento-date` | `criarFormulario` | `input[type=date]` invisível usado como date picker nativo |
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
               │    └─ adicionarColunaStatusNaTabela → criarGrupoBotoes → atualizarChipHabilitacao + agendarSalvarProgresso
               ├─ injetarOutrosAnexos
               ├─ injetarBotoesCategorias
               │    └─ adicionarColunaStatusNaTabela (loop)
               ├─ registrarEventListeners
               │    ├─ registrarEventListenersFormulario → agendarSalvarProgresso (delegated)
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
               │         ├─ limparProgresso      ← remove chave do localStorage
               │         └─ fecharDialog
               ├─ resetarEstadoCandidato
               │    └─ atualizarChipHabilitacao
               └─ carregarProgresso + restaurarProgresso   ← restaura estado salvo
                    └─ atualizarChipHabilitacao

limparProgressoAntigo (inicialização)

observerUI (MutationObserver)
└─ injetarBotao → abrirDialog
```

---

## 5. Colunas da Planilha (output de `copiarParaPlanilha`)

| Col | Dado |
|---|---|
| A | Analisado por (credenciadora) |
| B | Data e hora de envio |
| C | Resultado: `habilitado` ou `inabilitado` |
| D | Nome do professor (candidato) |
| E | Protocolo 1Doc (hyperlink no HTML, texto puro no plain) |
| F | Motivo da inabilitação (reservado — sempre vazio) |
| G | CPF (apenas dígitos) |
| H | RG (apenas dígitos) |
| I | Nacionalidade |
| J | Data de Nascimento (`DD/MM/AAAA`) |
| K | Estado Civil |
| L | Etnia (reservado — sempre vazio) |
| M | CEP (apenas dígitos) |
| N | Logradouro |
| O | Número |
| P | Bairro |
| Q | Cidade |
| R | E-mail |
| S | Celular (apenas dígitos) |
| T | Banco |
| U | Chave Pix |
| V | Agência Santander (reservado — sempre vazio) |
| W | Conta Corrente (reservado — sempre vazio) |
| X | Nome no Banco (reservado — sempre vazio) |
| Y | PIS/PASEP/NIT/NIS (apenas dígitos) |
| Z | `Educação Básica` (se selecionada, senão vazio) |
| AA | `Educação Física` (se selecionada, senão vazio) |
| AB | `Artes` (se selecionada, senão vazio) |
| AC–AG | Regiões 1–5 (número da região ou vazio) |
| AH–AR | Documentos I–XI (`sim` / `não` / vazio) |
| AS | Ciclo |

---

## 6. Índice — `inbox.user.js`

### Variáveis e Constantes

| Variável | Tipo | Descrição |
|---|---|---|
| `CICLOS` | `object[]` | Períodos de recebimento de inscrições (`{ num, inicio, fim }`). Idêntico ao de `credenciamento.user.js`. |
| `CICLOS_ANALISE` | `object[]` | Períodos de análise dos documentos de habilitação (`{ num, inicio, fim }`). |
| `protocoloWin` | `Window\|null` | Referência à janela de protocolo aberta via `window.open`. |
| `dividirTela` | `boolean` | Abre protocolo em janela posicionada na metade esquerda. Persiste em `localStorage` (`1doc_cred_dividir`). |
| `filtroCredenciadoras` | `boolean` | Oculta linhas com badge de credenciadora. Persiste em `localStorage`. |
| `filtroCiclo` | `string` | Ciclo selecionado para filtragem (`''` = todos). Persiste em `localStorage`. |

### Funções

| Função | Descrição |
|---|---|
| `textoDosBadges` | Extrai texto dos badges da linha ignorando filhos `<i>` (ícones). |
| `aplicarFiltros` | Oculta/exibe linhas conforme filtros de credenciadora e ciclo. |
| `renderizarPainelInbox` | Popula o body do `#modal-cred-inbox` com os controles de configuração. |
| `criarModal` | Cria o `#modal-cred-inbox` no `document.body` uma única vez. |
| `verificarCicloProtocolo` | Cruza `CICLOS_ANALISE` (ciclo de análise atual) com `CICLOS` (ciclo da data do protocolo). Retorna objeto quando divergem; `null` caso contrário. |
| `mostrarDialogCicloErrado` | Exibe `#modal-cred-ciclo-errado` (Bootstrap 2, `data-backdrop="static"`). Header vermelho. Footer: "Cancelar" (fecha) e "Abrir mesmo assim" (fecha + `onContinuar()`). |
| `injetarBotao` | Injeta botão "Credenciamento" em `div.span7` do inbox. Guard: `data-cred-inbox-injetado`. |
| `abrirProtocolo` | Abre o protocolo: navega no tab atual (se `dividirTela=false`) ou em janela posicionada na metade esquerda. |
| `processarLinhas` | Registra listener de clique em cada linha nova. Antes de abrir, chama `verificarCicloProtocolo` e exibe dialog de aviso se necessário. |
