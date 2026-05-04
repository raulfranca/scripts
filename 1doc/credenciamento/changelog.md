# Changelog

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número de versão representa o que está **publicado** (branch `main`). O progresso está em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

### Adicionado — educafacil

- **Novo script `educafacil.user.js` (v0.1.0):** Painel fixo no topo direito da tela no portal EducaFácil (`professor.educapindamonhangaba.com.br`) para preenchimento automático de solicitações de substituição de professores. Permite colar CSV separado por Tab (colunas: Status, Data Início, Data Fim, Dias, Período, Região, Escola, Turma, Professor). Dados persistidos em `localStorage` (`efSubs_rows`, `efSubs_status`). Lista de controle com status por linha (`pendente`, `preenchendo`, `preenchido`, `ignorado`, `erro`). Botões "Preencher" e "Ignorar/Restaurar" por linha. Resumo de contagem no topo.
- **Preenchimento automático:** Tipo (fixo "Educação Básica") → Escola (`ng-select#escola`) → Período (`ng-select#periodo`) → Data Início (`input#dataInicio`) → Data Fim (`input#dataFim`) → Professor (`ng-select#professor`, digita o nome + Enter) → Observação/Turma (`textarea#observacao`). Campo "Turmas" (`ng-select#turmas`, desabilitado) não é preenchido.
- **Helpers:** `selecionarNgSelect()` (abre dropdown, filtra, clica melhor opção); `digitarNgSelectEnter()` (abre, digita, tecla Enter — usado no campo professor); `setTextareaValue()` (setter nativo para Angular).
- **Painel collapse:** Header clicável recolhe/expande o corpo do painel; estado salvo em `localStorage` (`efSubs_collapsed`). Painel sempre visível no topo — sem botão flutuante separado.

### Adicionado — folha

- **Novo script `folha.user.js` (v0.1.0):** Painel com dois modos: **Entrada** (seletor de 12 meses em grade + textarea de protocolos + botão "Iniciar coleta") e **Coleta** (stats: Mês, Na lista, Visíveis, Já coletados, Faltam; botões "Editar lista" e "Limpar tudo"). Mês salvo em `LS_MES` (`1doc_folha_mes`). Lista em `LS_LISTA`, progresso em `LS_COLETADOS`, modo em `LS_MODO`. Destaque visual das linhas encontradas via `setProperty('background-color', ..., 'important')` nos `<td>` (sobrepõe estilos inline do 1Doc). Ao clicar em protocolo destacado na página `pg=doc/ver`: rola para o fim, copia `MÊS-AA NomeDaPessoa` para o clipboard, intercepta cliques em `a[href*="pg=doc/anexo"]` para abrir em janela metade da tela (direita), exibe dialog centralizado (backdrop `pointer-events:none`) perguntando se a folha foi salva; "Sim" registra coleta em `LS_COLETADOS` e volta ao inbox; "Não" apenas fecha o dialog. Preserva coletados ao editar lista; "Limpar tudo" zera tudo inclusive o mês.

### Alterado — folha

- **Resposta automática ao coletar:** Após "Sim" no dialog, em vez de voltar ao inbox diretamente, o script clica no botão flutuante "Responder" (`button.bf_v_1`), aguarda o TinyMCE inicializar, insere mensagem confirmando recebimento da folha de frequência (com nome da pessoa e mês de referência) e clica em `#enviar_documento`. Só volta ao inbox após o envio (~2,5 s).
- **Formato de entrada `Nome\tProtocolo`:** Textarea agora aceita linhas separadas por tabulação (`Nome\tNúmero`). `parsearEntrada` extrai o par; `LS_LISTA` passa a armazenar `Array<{nome, numero}>` em vez de `string[]`. O nome da lista é usado no clipboard ao coletar (mais confiável que extração do DOM).
- **Botão "👁 Ver lista" no modo coleta:** Abre modal overlay com todos os protocolos da lista, exibindo nome + número e badge "✓ Coletado" / "⏳ Pendente" para cada um. Clicar fora do modal fecha-o.
- **Label textarea atualizado:** Placeholder e label refletem o novo formato `Nome\tNúmero`.

### Adicionado — desconcluir

- **Novo script `desconcluir.user.js` (v0.1.0):** Etapa 1 — painel de controle no inbox de arquivados (`caixa=arquivo`) que lista protocolos via `a.link_emissao_a`, mantém log de verificados em `localStorage` (`1doc_desconcluir_log`) e abre um por um em janela controlada (`window.open` com nome fixo `desconcluir-protocolo`). Protocolos já verificados são exibidos com opacidade reduzida.

### Alterado — desconcluir

- **v0.2.0 — Etapa 2:** Script agora age na página do protocolo (branch `pg=doc/ver`). Quando encontra o botão `button.bf_v_19` ("Reabrir conclusão"), clica nele, aguarda o modal Bootstrap (`.modal.in #sim`) e confirma. Depois navega de volta ao inbox via `history.back()`. Novos keys de localStorage: `LS_REABERTOS`, `LS_ATIVO`, `LS_EM_PROCESSO`, `LS_ULTIMO`. Painel do inbox exibe resultado do último protocolo processado e contador de reabertos. Abertura migrou de `window.open` para navegação na mesma aba (`location.href`).
- **v0.3.0 — Modo automático + log:** Adicionado `LS_AUTO` para avanço automático entre protocolos. Botão principal substituído por toggle "▶ Iniciar / ⏸ Pausar" (vermelho quando ativo). Ao retornar ao inbox com modo automático ativo, o próximo protocolo abre automaticamente após 800 ms. Adicionado botão "📋 Ver log" que abre modal overlay com todos os protocolos analisados, indicando quais foram reabertos e quais não precisaram de ação.
- **v0.4.0 — Detecção contínua de página:** Substituído polling único por `setInterval` de 1 s que detecta mudanças de URL (`num_pagina=N`) e de quantidade de links. Ao navegar para uma nova página, o painel atualiza automaticamente e o modo automático retoma se estiver ativo. Opacidade das linhas verificadas é reaplicada a cada tick (idempotente), garantindo que linhas recém-renderizadas fiquem cinzas.
- **v0.5.0 — Interceptação de confirm nativo:** `processarReabertura` agora sobrescreve `window.confirm = () => true` antes de clicar no botão `bf_v_19`, aceitando automaticamente o dialog nativo do navegador (síncrono). Após o clique, o intervalo de verificação trata dois caminhos: A) modal Bootstrap `.modal.in #sim` aparece → clica; B) `bf_v_19` desaparece diretamente via AJAX sem modal → marca reaberto. Eliminada dependência do modal Bootstrap como único critério de sucesso.
- **v0.6.0 — Espera manual infinita ao reabrir:** Quando `bf_v_19` é encontrado, o script clica, contabiliza o sucesso imediatamente e aguarda **indefinidamente** o botão sumir (sem timeout). Removidos `window.confirm` override e `aguardarSucessoReabertura`. O automatismo retoma sozinho quando o usuário conclui os dialogs manualmente e o botão desaparece do DOM.
- **v0.7.0 — Paginação automática:** Adicionada `navegarProximaPagina()` que clica em `li.pagination_arrow a.navega_caixa i.icon-chevron-right` quando não há mais protocolos pendentes na página atual e o modo automático está ativo. O `tick()` de 1 s detecta a mudança de URL/conteúdo e retoma o ciclo na nova página automaticamente. Se não houver próxima página, o modo automático é encerrado.

## [0.6.0] — 2026-03-18

### Adicionado — inbox

- **Auto-refresh por inatividade:** a página do inbox recarrega automaticamente após 60 segundos sem interação do usuário, evitando que credenciadoras vejam listas desatualizadas. Comportamento:
  - **Aba em segundo plano:** recarregamento via `location.reload()` ao atingir 60s de inatividade — pelo `setInterval` (verificação a cada 1s) ou imediatamente pelo `visibilitychange` ao trazer a aba à frente.
  - **Aba em primeiro plano (sem interação):** exibe um toast fixo no canto inferior direito com o contador de segundos em tempo real e um botão "Atualizar".
  - Qualquer interação (mouse, teclado, clique, scroll ou toque) zera o contador e oculta o toast.

## [0.5.0] — 2026-03-17

### Alterado — credenciamento

- O botão "Concluir e copiar" foi renomeado para **"Concluir"**.
- O fluxo de conclusão agora ocorre em duas etapas:
  - **Primeira etapa (ao clicar em "Concluir"):** o modal se fecha e o script clica automaticamente no botão "Responder" do 1Doc. Em seguida, insere o modelo padrão de resposta `[CRED-CHP014] Inscrição recebida` no editor de texto e exibe um aviso ao credenciador para que ele:
    - Selecione manualmente o destinatário (mostrando qual é o e-mail do candidato)
    - Verifique se há outras mensagens do candidato no protocolo
    
    Nesta etapa, os marcadores de credenciadora, ciclo, habilitado/inabilitado já são aplicados automaticamente.
  - **Segunda etapa (ao clicar no botão "Responder" para enviar):** o script automaticamente aplica o marcador "Conferido", copia os dados do candidato para a área de transferência, confirma o envio da resposta, arquiva o protocolo no 1Doc e abre/muda para a aba da planilha de controle.

## [0.4.0] — 2026-03-13

### Adicionado — inbox

- **Tag colorida por ciclo:** protocolos de um ciclo de inscrição diferente do que está em análise recebem automaticamente uma marcação colorida na lista do inbox, facilitando a identificação visual sem precisar abrir cada protocolo.
- **Aviso ao abrir protocolo fora do ciclo:** ao clicar em um protocolo de ciclo diferente do atual, um alerta bloqueante é exibido informando a divergência, com as opções de cancelar ou abrir mesmo assim.

### Alterado — inbox

- O Painel de Controle do inbox foi simplificado: os filtros de credenciadora atribuída e de ciclo foram removidos. A única opção disponível agora é "Dividir tela ao abrir protocolo".

### Removido — inbox

- Filtros manuais do inbox (por credenciadora atribuída e por ciclo) removidos. A organização dos protocolos passa a ser gerenciada pelo arquivamento nativo do 1Doc.

### Adicionado — credenciamento

- **Botão "Dúvida"** no rodapé do formulário: visível apenas enquanto o preenchimento está incompleto. Ao clicar, salva o progresso, aplica o marcador "Dúvida" ao protocolo e retorna ao inbox automaticamente.

### Alterado — credenciamento

- O campo RG agora aceita o CPF como documento substituto (conforme previsão legal): ao informar o CPF no campo RG, o sistema reconhece e exibe o número no formato correto.
- O botão "Dúvida" aparece ou desaparece automaticamente conforme os campos do formulário são preenchidos.
- Ao concluir o credenciamento, o protocolo é arquivado automaticamente no 1Doc, sem ação manual do credenciador. Se o arquivamento não for possível, o sistema retorna ao inbox normalmente.

## [0.3.0] — 2026-03-13

### Adicionado — inbox

- **Novo script para o inbox:** ao clicar em um protocolo na lista, ele é aberto em janela separada, posicionada na metade esquerda da tela.
- **Botão "Credenciamento" no inbox:** abre o Painel de Controle em uma janela de opções.
- **Opção "Dividir tela ao abrir protocolo":** quando ativada (padrão), o protocolo abre na metade esquerda da tela; quando desativada, abre na aba atual. A preferência é salva entre sessões.
- **Filtro por credenciadora:** oculta da lista os protocolos já atribuídos a uma credenciadora da equipe. Desativado por padrão; preferência salva entre sessões.
- **Filtro por ciclo:** oculta protocolos de ciclos diferentes do selecionado; protocolos sem marcador de ciclo permanecem visíveis. Preferência salva entre sessões.

### Adicionado — credenciamento

- **Marcador de credenciadora existente é preservado:** ao abrir o painel em um protocolo que já tem marcador de credenciadora, o sistema mantém o marcador existente. Um novo marcador só é inserido quando nenhum da equipe está presente.
- **Diálogo de confirmação ao concluir sem marcadores automáticos:** ao clicar em "Concluir e copiar" com a opção "Aplicar marcador automaticamente" desmarcada, o sistema pergunta o que fazer: aplicar os marcadores mesmo assim, concluir sem aplicar ou voltar ao formulário.

### Alterado — credenciamento

- A janela de anexos agora abre na metade direita da tela, complementando a divisão de tela com o protocolo.
- Com a opção "Aplicar marcador automaticamente" desmarcada, nenhum marcador é aplicado — inclusive o de ciclo — ao abrir o painel.

### Corrigido — credenciamento

- O campo PIS/PASEP tornou-se obrigatório: o botão de concluir só é ativado com o número completo (11 dígitos) preenchido, e o valor é salvo e restaurado corretamente entre sessões.
- O botão "Revisar" nativo do 1Doc foi ocultado em todas as categorias de anexo.

## [0.2.1] — 2026-03-12

### Adicionado

- **Campo PIS/PASEP/NIT/NIS** no formulário de dados de pagamento, à direita da Chave Pix, com máscara de formatação automática.

### Alterado

- A planilha copiada para o Google Sheets foi expandida para 40 colunas (A–AN): incluídas a coluna de Etnia (reservada para uso futuro) e a de PIS/PASEP, com reajuste de todas as colunas seguintes.

## [0.2.0] — 2026-03-12

### Adicionado

- **Marcador de ciclo automático:** ao processar um protocolo, o sistema identifica o ciclo de inscrição pela data de envio e aplica o marcador correspondente (— 01 a — 10) no 1Doc. Se o marcador correto já estiver aplicado, nada é alterado; se a data não se enquadrar em nenhum ciclo, uma advertência é registrada internamente e nenhum marcador é modificado.
- **Ciclo incluído na planilha:** o ciclo identificado é copiado como coluna adicional no Google Sheets.
- **Anexos em janela dedicada:** ao clicar em um link de anexo dentro do formulário, ele abre em uma janela separada. Cliques seguintes abrem novas abas dentro da mesma janela, permitindo alternar entre o 1Doc e os PDFs com Alt+Tab sem perder o contexto.

## [0.1.0] — 2026-03-11

Versão inicial funcional do painel de conferência de credenciamento.

### Adicionado

- **Botão de ativação** na barra de ferramentas do 1Doc, que abre o painel de revisão de documentos.
- **Abertura automática do painel** (opcional, salva entre sessões): ao entrar em um protocolo, o painel é aberto automaticamente, sem intervenção manual.
- **Cabeçalho do painel** com seleção de credenciadora (Renata, Catarina ou Alessandra) e opções de "Abrir automaticamente nos protocolos" e "Aplicar marcador automaticamente" — quando esta última está desmarcada, nenhuma ação sobre os marcadores do 1Doc é realizada.
- **Bloco de identificação** fixo no topo do painel, exibindo:
  - Número do protocolo e data/hora de envio.
  - Campo editável com o nome do candidato, pré-preenchido a partir da página.
  - Confirmação de que o nome confere com a ficha de inscrição — obrigatória antes de copiar os dados.
- **Formulário de credenciamento** com:
  - Campo CPF com máscara de formatação automática.
  - Seleção de função pretendida (múltipla): Educação Básica, Educação Física, Artes.
  - Seleção de regiões escolares (múltipla): Centro, Zona Oeste, Zona Leste, Moreira César, Zona Rural.
- **Avaliação por grupo de documentos** (grupos I–XI): botões Sim/Não para cada categoria, com destaque visual para o estado atual.
- **Destaque especial para a Ficha de Inscrição** (grupo I): exibida em seção separada, com aviso sobre a versão retificada para as regiões Leste e Moreira César.
- **Seção "Outros documentos anexos":** detecta e exibe arquivos enviados em despachos posteriores que não aparecem nas categorias do painel nativo do 1Doc.
- **Indicador de habilitação** no rodapé, atualizado em tempo real:
  - Cinza — "Em avaliação" (ao menos um grupo ainda não avaliado).
  - Verde — "Habilitado(a)" (todos os 11 grupos marcados como Sim).
  - Vermelho — "Inabilitado(a)" (ao menos um grupo marcado como Não).
- **Botão "Copiar"** com validação obrigatória antes de copiar os dados:
  1. Nome confirmado pelo credenciador.
  2. CPF com 11 dígitos.
  3. Ao menos uma função selecionada.
  4. Ao menos uma região selecionada.
  5. Todos os 11 grupos de documentos avaliados.
- **Cópia para o Google Sheets** em dois formatos simultâneos: tabela formatada com o protocolo como hiperlink, e texto simples como alternativa.
- **Marcadores automáticos no 1Doc:** ao selecionar a credenciadora, o marcador correspondente é aplicado e os das demais são removidos.
- **Preferências salvas entre sessões:** credenciadora ativa, abertura automática e aplicação de marcador.
- **Funcionamento contínuo entre protocolos:** ao navegar sem recarregar a página, o painel é reiniciado automaticamente para o novo candidato.

[Não publicado]: https://github.com/raulfranca/scripts/compare/v0.4.0...dev
[0.4.0]: https://github.com/raulfranca/scripts/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/raulfranca/scripts/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/raulfranca/scripts/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/raulfranca/scripts/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/raulfranca/scripts/releases/tag/v0.1.0
