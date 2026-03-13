# Changelog

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número de versão representa o que está **publicado** (branch `main`). O progresso está em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

## [0.3.0] — 2026-03-13

### Adicionado — `inbox.user.js`

- **Novo script** que intercepta cliques nas linhas do inbox (`pg=painel/listar`) e abre o protocolo em janela controlada posicionada na metade esquerda da tela.
- **Botão "Credenciamento" no inbox:** injetado como primeiro filho de `div.span7`; abre o Painel de Controle via modal Bootstrap 2.
- **Modal "Painel de Controle"** (`#modal-cred-inbox`): header verde institucional (`#005400`); criado uma única vez no `document.body`.
- **Controle "Dividir tela ao abrir protocolo":** checkbox persistido em `localStorage` (`1doc_cred_dividir`, padrão `true`). Quando desmarcado, abre o protocolo no próprio tab.
- **Filtro "Ocultar protocolos com credenciadora atribuída":** checkbox persistido em `localStorage` (`1doc_cred_filtro_credenciadoras`, padrão `false`). Oculta linhas do inbox com badge de Renata, Catarina ou Alessandra.
- **Filtro de ciclo:** `<select>` persistido em `localStorage` (`1doc_cred_filtro_ciclo`). Oculta linhas com badge de ciclo diferente do selecionado; mantém visíveis linhas sem badge de ciclo.
- **`aplicarFiltros()`:** aplica os dois filtros a todas as `tr[id^="linha_"]`; chamada na inicialização, ao alterar controles e a cada mutação do DOM.

### Alterado — `inbox.user.js`

- **`@grant`** alterado de `none` para `GM_addStyle`.

### Adicionado — `credenciamento.user.js`

- **Marcador de credenciadora existente prevalece:** ao abrir o modal, se o protocolo já tiver marcador de credenciadora aplicado, ele é preservado e a UI é sincronizada. Só aplica novo marcador quando nenhum da equipe está presente. Nova função auxiliar `credenciadorJaAplicado`.
- **Dialog de confirmação ao concluir com `autoMarcador` desativado:** ao clicar "Concluir e copiar" com o checkbox desmarcado, exibe dialog com 3 opções — **Aplicar marcadores** (aplica Credenciador, Ciclo, Habilitado/Inabilitado e Conferido), **Não aplicar** (conclui sem marcadores), **Voltar** (retorna ao modal). Nova função auxiliar `mostrarDialogMarcadores`.

### Alterado — `credenciamento.user.js`

- **Janela de anexos** (`cred-anexos`) posicionada na metade direita da tela (`width=metade, left=screen.availLeft+metade`).
- **Marcador de ciclo** (`aplicarMarcadorCiclo`) agora respeita `autoMarcador`: com o checkbox desmarcado, nenhum marcador é aplicado na abertura do modal.

### Corrigido — `credenciamento.user.js`

- **PIS/PASEP/NIT/NIS:** campo tornado obrigatório (`validarFormulario` exige 11 dígitos; `_estaCompleto` atualiza o botão em tempo real) e persistido no `localStorage` (`salvarProgresso` salva, `restaurarProgresso` restaura com formatação correta).
- **Botão "Revisar" nativo** ocultado via CSS global no `GM_addStyle` (`a.anexo_galeria_item_hover_btn { display: none !important }`), cobrindo todas as categorias independentemente do timing de AJAX.

## [0.2.1] — 2026-03-12

### Adicionado

- **Campo PIS/PASEP/NIT/NIS** no formulário de pagamento, à direita da Chave Pix. Máscara progressiva `XXX.XXXXX.XX-X` (11 dígitos). Valor armazenado em `pisDigitos` (apenas dígitos); resetado a cada protocolo.

### Alterado

- **Array `cells` em `copiarParaPlanilha` reescrito** com 40 posições (0–39, colunas A–AN): adicionada coluna Etnia reservada (colüna I, sempre vazia por enquanto), PIS/PASEP na coluna S, e ajuste de todas as colunas subsequentes (funções T–V, regiões W–AA, documentos AB–AL, resultado AM, ciclo AN).

## [0.2.0] — 2026-03-12

### Adicionado

- **Marcador de ciclo automático:** ao executar o fluxo de extração, a função `aplicarMarcadorCiclo` calcula o ciclo do protocolo com base na data de envio (tabela de 10 ciclos, de 25/02 a 30/11/2026) e aplica o marcador correspondente (`— 01` a `— 10`) no select2 do 1Doc. Só age se o marcador correto ainda não estiver selecionado; remove qualquer outro marcador de ciclo antes de aplicar o novo. Se a data não se enquadrar em nenhum ciclo, registra `console.warn` e não altera os marcadores.
- **Variável `cicloAtual`:** armazena o ciclo identificado (`'01'`–`'10'` ou `''`); resetada a cada candidato.
- **Coluna AL na planilha:** `cicloAtual` adicionada como última coluna (posição 37) no array copiado para o Google Sheets. O total de colunas passa de 37 para **38** (A–AL).
- **Abertura de anexos em janela separada:** links de anexo (`pg=doc/anexo`) dentro do modal abrem em uma janela popup dedicada (`window.open` com dimensões explícitas). O primeiro clique cria a janela; cliques seguintes abrem novas abas dentro dela (via `_credAnexosWin.open(url, '_blank')`), permitindo alternar entre o 1Doc e os PDFs com Alt+Tab sem perder a aba anterior.

## [0.1.0] — 2026-03-11

Versão inicial funcional do painel de conferência de credenciamento.

### Adicionado

- **Botão de ativação** injetado na barra de ferramentas do 1Doc (`.btn-group-tags`), que abre o modal de revisão de documentos.
- **Opção "Abrir automaticamente"** (persistida em `localStorage`): ao entrar em um protocolo, o script clica automaticamente no botão "Tabela" do 1Doc sem intervenção do usuário.
- **Cabeçalho customizado** (verde institucional) dentro do modal nativo, com:
  - Seleção de credenciadora (3 botões de alternância: Renata, Catarina, Alessandra).
  - Checkbox **"Abrir automaticamente nos protocolos"**.
  - Checkbox **"Aplicar marcador automaticamente"** — quando desmarcado, nenhuma ação sobre os marcadores do 1Doc é realizada.
- **Bloco de identificação** (fundo verde claro) fixo no topo do modal, com:
  - Número do protocolo e data/hora de envio extraídos automaticamente do DOM.
  - Campo editável **"Nome do candidato"** pré-preenchido com o nome da página.
  - Checkbox **"Este nome é igual ao que está na ficha de inscrição"** — deve ser marcado pelo credenciador antes de copiar.
- **Formulário de credenciamento** inserido acima da tabela de documentos:
  - Campo **CPF** com máscara progressiva `000.000.000-00`.
  - Botões de **Função pretendida** (múltipla seleção): Educação Básica, Educação Física, Artes.
  - Botões de **Regiões Escolares** (múltipla seleção): 1-Centro, 2-Zona Oeste, 3-Zona Leste, 4-Moreira César, 5-Zona Rural.
- **Botões Sim/Não por categoria** (grupos I–XI) na tabela de documentos, com toggle visual (opacidade 50%/100%).
- **Seção de destaque para a Ficha de Inscrição** (categoria I): removida da tabela principal e exibida separadamente, com aviso sobre a versão retificada da ficha (regiões Leste e Moreira César).
- **Seção "Outros documentos anexos"**: detecta arquivos enviados em despachos posteriores (não categorizados no modal nativo) e os exibe ao final, com link, data e número do despacho de origem.
- **Chip de habilitação** no rodapé do modal com status em tempo real:
  - Cinza — "Em avaliação" (ao menos um grupo sem avaliação).
  - Verde — "Habilitado(a)" (todos os 11 grupos marcados Sim).
  - Vermelho — "Inabilitado(a)" (ao menos um grupo marcado Não).
- **Botão "Copiar"** no rodapé, com validação antes de copiar:
  1. Nome confirmado pelo checkbox.
  2. CPF com 11 dígitos.
  3. Ao menos uma função selecionada.
  4. Ao menos uma região selecionada.
  5. Todos os 11 grupos de documentos avaliados.
- **Cópia para área de transferência** em dois formatos simultâneos — HTML rico (25 colunas, protocolo como hiperlink) e TSV (fallback) — compatível com colagem direta no Google Sheets.
- **Aplicação automática de marcador** via jQuery nativo da página: ao abrir o painel e ao trocar o credenciador, insere o marcador correspondente e remove os dos demais membros da equipe.
- **Persistência de preferências** em `localStorage` entre sessões: credenciadora ativa, abertura automática e aplicação de marcador.
- **Resiliência a SPA**: ao navegar entre protocolos sem recarregar a página, o script restaura o modal ao estado original e reseta o estado do candidato automaticamente.

[Não publicado]: https://github.com/raulfranca/scripts/compare/v0.3.0...dev
[0.3.0]: https://github.com/raulfranca/scripts/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/raulfranca/scripts/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/raulfranca/scripts/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/raulfranca/scripts/releases/tag/v0.1.0
