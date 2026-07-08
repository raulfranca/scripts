# Changelog

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número de versão representa o que está **publicado** (branch `main`). O progresso está em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [0.6.2] — 2026-07-08

### Adicionado — credenciamento

- **Validação do dígito verificador do CPF (`validarFormulario` + nova função `cpfValido`):** ao clicar em "Concluir", além de exigir os 11 dígitos, o script valida o CPF pelos dois dígitos verificadores (algoritmo de https://dicasdeprogramacao.com.br/algoritmo-para-validar-cpf/) e rejeita sequências de dígitos iguais (ex: `111.111.111-11`). Se o CPF não for válido, a conclusão é bloqueada e é exibida a mensagem `"CPF inválido — verifique se houve erro de digitação."` no campo CPF. A checagem foi inserida logo após a validação de quantidade de dígitos. **Exceção:** `00000000000` (11 zeros) é aceito deliberadamente como CPF anulado — permite concluir quando o candidato não enviou o documento e o campo não pode ficar vazio. Nesse caso, a coluna U (Chave Pix) do clipboard sai **vazia** em vez de repetir os 11 zeros.
- **Nova subseção "Dados da Conta Santander" no formulário:** substitui a antiga linha "Banco / Chave Pix / PIS". Contém os campos **Agência** e **Conta**, com título no mesmo padrão de "Endereço" (`label.cred-section-label` acima da linha de campos).
  - **Agência** (`cred-agencia`, estado `agenciaSantander`): exige **exatamente 4 dígitos**, gravada como **texto** para preservar zeros à esquerda. Não presume zeros — `56` continua `56` (inválido), nunca vira `0056` nem `5600`.
  - **Conta** (`cred-conta`, estado `contaSantander`): máscara `XXXXXXXX-X` (8 dígitos + verificador = 9), gravada como **texto**. Caso especial: ao exceder 9 dígitos com zeros à esquerda presentes, os zeros à esquerda são descartados para dar lugar aos novos dígitos.
- **Campo PIS/PASEP/NIT/NIS movido para junto do anexo da categoria VI:** nova função `moverDocPIS` extrai a linha "VI – Cópia da inscrição do PIS..." da tabela nativa e a injeta como seção destacada `#cred-doc-pis` (com os botões Sim/Não da revisão e o campo de digitação do número logo abaixo do anexo), análogo ao doc de identidade (II) com CPF/RG. A seção `#cred-doc-pis` é posicionada **logo abaixo da subseção II** (`#cred-doc-identidade`), dentro de "Dados Pessoais" — para isso `moverDocPIS` passou a receber `formContainer` e insere o container após `#cred-doc-identidade` (fallback: após a Ficha de Inscrição, ou no topo do `modalBody`). A categoria VI passa a ser pulada em `injetarBotoesCategorias`.
- **Dois cabeçalhos de grupo separando o modal em etapas (nova função `injetarHeadersSecao`):** o modal passa a ter dois cabeçalhos `.cred-section-group-header`:
  - **"Preenchimento de Dados Pessoais"** (`#cred-header-preenchimento`) — injetado no `modalBody` **acima da subseção I (Ficha de Inscrição)**. Substitui o antigo cabeçalho "Dados Pessoais" (que ficava dentro de `#cred-form-container`); o header foi removido do template de `criarFormulario` e agora é um elemento independente no `modalBody`.
  - **"Verificação de Documentos"** (`#cred-header-verificacao`) — injetado logo **acima da tabela nativa de anexos** (`.div_lista_aprovacao_anexos`), separando os campos de preenchimento da conferência dos demais documentos (III, IV, V, VII…).
  - Ambos são recriados na re-injeção (reload AJAX) e removidos na navegação SPA. `moverDocIdentidade` deixou de depender do header no `formContainer` (agora sempre faz `appendChild`).

### Alterado — credenciamento

- **Padrão "dado junto do seu documento" aplicado a todos os anexos com campos — cada campo mora dentro da subseção do anexo de onde é lido:**
  - **Anexo I (Ficha de Inscrição) — `moverFichaInscricao` + `criarFormulario`:** os campos gerais lidos da ficha (Estado civil, Endereço, E-mail/Celular, Conta Santander, Função pretendida, Regiões Escolares) agora ficam **dentro** de `#cred-ficha-inscricao`, logo abaixo do anexo/aviso. Foram agrupados no template sob o id `#cred-ficha-campos`, que `moverFichaInscricao` realoca para dentro da subseção I.
  - **Anexo II (Identidade) — `moverDocIdentidade` + `criarFormulario`:** CPF, RG, Nacionalidade e Data de Nascimento ficam **dentro** de `#cred-doc-identidade`. Linha agrupada sob o id `#cred-identidade-campos`, realocada para a subseção II.
  - **Anexo VI (PIS)** já seguia esse padrão (número do PIS dentro de `#cred-doc-pis`).
  - **Re-injeção (reload AJAX do modal):** antes de remover as subseções antigas, o script resgata `#cred-identidade-campos` e `#cred-ficha-campos` de volta ao `#cred-form-container`, preservando os inputs e seus valores; os movers os re-aninham nas novas subseções.
  - **Modo congelado (`ativarModoCongelado`/`desativarModoCongelado`):** o seletor de desabilitação passou a incluir `#cred-ficha-inscricao input`, já que os campos gerais deixaram de estar sob `#cred-form-container`.
  - **Auto-save (`registrarEventListenersFormulario`):** o listener delegado de `input`/`click` passou a ser registrado também em `#cred-ficha-campos` (além de `#cred-form-container`), pois os campos gerais foram movidos para fora do form-container.
  - IDs dos inputs, listeners individuais (via `getElementById`), validação, save/restore e reset inalterados.
- **Ordem final das seções no modal:** Ficha de Inscrição (I) **[+ Estado civil, Endereço, E-mail/Celular, Conta Santander, Função, Regiões]** → cabeçalho "Dados Pessoais" → anexo II **[+ CPF/RG/Nacionalidade/Nascimento]** → anexo VI **[+ número do PIS]**. Mudança puramente de ordem/aninhamento no DOM.
- **Mapeamento do clipboard (colunas bancárias):** coluna T (Banco) agora grava sempre o literal `"Santander"` (não lê mais do formulário); coluna U (Chave Pix) grava sempre o CPF do candidato; coluna V passa a receber a **Agência** (`agenciaSantander`); coluna W passa a receber a **Conta** (`contaSantander`); coluna X passa a receber o **nome do candidato** (titular da conta). As colunas V e W recebem `mso-number-format:'@'` no HTML para o Google Sheets tratá-las como texto e preservar os zeros à esquerda.
- **Removidos os campos "Banco" e "Chave Pix" do formulário** e as variáveis de estado `bancoNome`, `bancoCOMPE` e `chavePix`. O auto-preenchimento da Chave Pix a partir do CPF foi removido (o CPF vai direto para a coluna Pix no clipboard).
- **Data de nascimento agora é campo obrigatório (`validarFormulario`):** ao clicar em "Concluir", o sistema impede a conclusão e exibe erro se a data de nascimento não estiver preenchida — mesmo comportamento dos demais campos obrigatórios. A validação foi inserida logo após a do RG (seguindo a ordem visual do formulário). A mensagem distingue os casos: campo em branco/incompleto (`"Preencha a data de nascimento do candidato (DD/MM/AAAA)."`) e data preenchida mas inválida ou candidato com menos de 18 anos (`"Data de nascimento inválida ou candidato com menos de 18 anos."`), já que `dataNascimento` fica vazio em ambos.

## [0.6.1] — 2026-06-10

### Corrigido — credenciamento

- **Hyperlink do protocolo perdido ao colar na planilha (`prepararDadosClipboard` / `escreverClipboardSync`):** a coluna E (protocolo) não chegava em rich text com link clicável no Google Sheets em dois cenários: (1) o fallback síncrono `escreverClipboardSync` copiava apenas `text/plain` via `<textarea>`, descartando o `text/html` com o `<a href>`; agora usa um listener `copy` que injeta ambos os formatos (`text/html` + `text/plain`) via `clipboardData`. (2) A URL do protocolo (`window.location.href`, que contém `&hash=...`) não era escapada no atributo `href`, gerando HTML inválido; agora passa por `escapeHtml(url)`.

### Alterado — credenciamento

- **Reordenação da seção "Dados Pessoais" no formulário:** o bloco CPF/RG/Nacionalidade foi movido para o final do formulário, imediatamente após "Regiões Escolares" e antes da seção de documentos. O restante dos campos (Estado civil, Endereço, E-mail/Celular, Banco/Pix/PIS, Função pretendida, Regiões Escolares) permanece na mesma ordem.
- **Corrigido: coluna AS (Ciclo) sempre vazia quando `autoMarcador` estava desativado:** `aplicarMarcadorCiclo` só era chamada dentro do bloco `if (autoMarcador)`, portanto `cicloAtual` nunca era calculado quando o checkbox de marcadores estava desmarcado. Solução: a chamada foi movida para antes do `if (autoMarcador)`, com segundo parâmetro `aplicarMarcador = true/false` que separa o cálculo (sempre feito) da aplicação no select2 (condicionada a `autoMarcador`).
- **Corrigido (3ª vez — causa raiz): clipboard no modo "Copiar" com progresso restaurado do localStorage:** `dadosExtraidos` nunca era salvo no localStorage nem restaurado por `restaurarProgresso()`, portanto ao clicar "Copiar" em um protocolo já concluído/restaurado a função `prepararDadosClipboard()` lançava `TypeError: Cannot destructure property of null` — silenciado pelo `catch`, deixando o clipboard intacto com o conteúdo anterior do sistema. Correção: `salvarProgresso()` agora persiste `protocolo`, `url`, `dataEnvio` e `cicloAtual`; `restaurarProgresso()` reconstrói `dadosExtraidos` e `cicloAtual` a partir desses campos. O bloco `catch` do modo concluído foi tornado visível (exibe `alert` com a mensagem de erro) e `window.open` só é chamado após cópia bem-sucedida.
- **Corrigido (2ª vez): clipboard colava conteúdo errado na Fase 2 (`copiarParaPlanilha`):** mesmo após o fallback `execCommand`, o problema regressou porque qualquer `await` (incluindo `aguardarElemento`) descarta o contexto de gesto do usuário necessário ao `execCommand`. Solução definitiva: extração dos dados e gravação no clipboard (via `escreverClipboardSync`) movidas para **antes do primeiro `await`** no handler de `#enviar_documento`, ainda dentro do stack síncrono do click original. A função `copiarParaPlanilha` foi decomposta em `prepararDadosClipboard()` (monta os dados, síncrona) e `escreverClipboardSync(dados)` (grava via textarea + execCommand, síncrona). O modo "concluído" (rebater) também foi atualizado para usar a mesma estratégia.
- **Corrigido (1ª vez): clipboard colava conteúdo errado no Google Sheets (`copiarParaPlanilha`):** na Fase 2 do fluxo de conclusão, `copiarParaPlanilha` era chamada após `setTimeout` e cliques automáticos, perdendo o foco do documento; a `Clipboard API` falhava silenciosamente e o Sheets usava o conteúdo anterior do clipboard do sistema. Correção: adicionado fallback síncrono via `document.execCommand('copy')` (textarea temporária) quando `navigator.clipboard.write` rejeita. O envelope HTML foi corrigido para `<!DOCTYPE html><html><body>…</body></html>` (Sheets requer o documento completo para reconhecer a tabela). Adicionado `escapeHtml()` nos valores das células HTML para evitar injeção de marcação.
- **Coluna F "Motivo da inabilitação" preenchida automaticamente:** quando o resultado é `inabilitado`, a coluna F recebe a lista das categorias com botão "Não" marcado, separadas por vírgula e na ordem canônica I–XI (ex: `VI, X`). Quando habilitado, a coluna fica vazia.
- **Remapeamento completo das colunas do clipboard (`copiarParaPlanilha`):** reordenadas para corresponder à nova estrutura da planilha de destino (46 colunas, A–AS). Nova ordem: Analisado por · Data e hora · Resultado · Nome · Protocolo · Motivo inabilitação · CPF · RG · Nacionalidade · Data de Nascimento · Estado Civil · Etnia · CEP · Logradouro · Número · Bairro · Cidade · E-mail · Celular · Banco · Chave Pix · Agência Santander · Conta Corrente · Nome no Banco · PIS · Ed. Básica · Ed. Física · Artes · Regiões 1–5 · Docs I–XI · Ciclo. Colunas reservadas (Motivo, Etnia, Agência, Conta, Nome no Banco) sempre vazias.
- **Campo "Data de Nascimento" adicionado ao formulário:** posicionado à direita de Nacionalidade na seção Dados Pessoais. Aceita apenas dígitos e aplica máscara progressiva `DD/MM/AAAA`; botão de calendário aciona o `input[type=date]` nativo oculto para seleção via date picker. Valor persiste em progresso (`dataNascimento`) e é restaurado/zerado junto com os demais campos.
- **Documento de identidade (II) incorporado à seção "Dados Pessoais":** nova função `moverDocIdentidade` extrai a linha "II – Cópia de documento de Identidade..." da tabela nativa e a injeta como `#cred-doc-identidade` dentro do `formContainer`, logo após os campos CPF/RG/Nacionalidade — com botões Sim/Não já vinculados à categoria `'II'`. A categoria II é ignorada em `injetarBotoesCategorias` para evitar duplicação.

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
