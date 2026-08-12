# Changelog — credenciamento.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script**. Cada script do monorepo tem changelog e numeração próprios — uma mudança em `folha.user.js` não bumpa `credenciamento.user.js`. Toda tarefa que altera o comportamento do script encerra com o bump da versão: MINOR para funcionalidade/comportamento perceptível, PATCH para correção; MAJOR **somente** com instrução explícita do usuário (ver regra 7 do `CLAUDE.md`). `## [Não publicado]` guarda o trabalho em andamento e é promovido a `## [X.Y.Z] — AAAA-MM-DD` no fim da tarefa.

## [Não publicado]

## [0.7.0] — 2026-08-12

### Alterado

- **Fim do fluxo de conclusão passa a fechar a janela do protocolo (nova função `fecharJanelaProtocolo`):** após o envio da resposta, o arquivamento e a abertura da aba da planilha, o script aguarda 1,5s (para o 1Doc processar o arquivamento) e chama `window.close()` em vez de deixar a janela ser redirecionada. Como o protocolo é aberto pelo `inbox.user.js` via `window.open('cred-protocolo')`, o navegador permite fechá-la por script e o usuário volta ao inbox, que continua aberto na janela de origem. Se o protocolo tiver sido aberto no próprio tab (opção "Dividir tela" desativada), o `close()` é bloqueado pelo navegador — nesse caso o script apenas registra `console.warn` e **não** navega para outra URL.
- **Confirmação do arquivamento passou a usar `aguardarElemento`:** o `setInterval` manual que esperava o `#sim` do dialog de arquivamento foi trocado por `await aguardarElemento('#sim', 5000)`, mesmo timeout de antes. Necessário para que o fechamento da janela só ocorra depois da confirmação do arquivamento.

## [0.6.3] — 2026-08-12

### Corrigido

- **Campo RG passa a aceitar o dígito verificador `X` (`sanitizarRG` + `formatarRG`, novas funções):** RGs de vários estados (SP entre eles) usam `X` como dígito verificador, e a máscara antiga descartava qualquer caractere não numérico, impedindo o preenchimento correto. Agora o campo aceita dígitos e um `X` final (`12.345.678-X`), normalizando para maiúscula e ignorando `X` em qualquer outra posição. A máscara e a exceção "CPF no lugar do RG" (11 dígitos iguais ao CPF, previsto em lei) foram extraídas para as duas funções novas, usadas tanto pelo listener de digitação quanto por `restaurarProgresso`. A variável de estado `rgDigitos` foi renomeada para **`rgValor`**, já que o conteúdo deixou de ser exclusivamente numérico. O `inputmode="numeric"` foi removido do input (bloqueava a letra em teclados móveis) e o placeholder passou a ser `00.000.000-X`.

### Alterado

- **Seleção automática do modelo de mensagem removida do fluxo de conclusão (`executarFase1Conclusao`):** o script deixou de clicar no botão "Inserir modelos" do TinyMCE (`#mceu_11-open`) e de selecionar a opção `[CRED-CHP014] Inscrição recebida`. Motivo: a ordem/composição dos modelos no dropdown muda com o tempo e a seleção automática corria o risco de inserir a mensagem errada no protocolo. A escolha do modelo passa a ser do usuário. O restante da Fase 1 permanece igual (fecha o modal, clica em "Responder" nativo, marca `aguardandoEnvioResposta` e exibe o dialog de aviso), assim como toda a Fase 2. O dialog `mostrarDialogVerificarMensagens` ganhou uma linha pedindo que o usuário insira o modelo de mensagem pelo botão de modelos do editor.

## [0.6.2] — 2026-07-08

### Adicionado

- **Validação do dígito verificador do CPF (`validarFormulario` + nova função `cpfValido`):** ao clicar em "Concluir", além de exigir os 11 dígitos, o script valida o CPF pelos dois dígitos verificadores (algoritmo de https://dicasdeprogramacao.com.br/algoritmo-para-validar-cpf/) e rejeita sequências de dígitos iguais (ex: `111.111.111-11`). Se o CPF não for válido, a conclusão é bloqueada e é exibida a mensagem `"CPF inválido — verifique se houve erro de digitação."` no campo CPF. A checagem foi inserida logo após a validação de quantidade de dígitos. **Exceção:** `00000000000` (11 zeros) é aceito deliberadamente como CPF anulado — permite concluir quando o candidato não enviou o documento e o campo não pode ficar vazio. Nesse caso, a coluna U (Chave Pix) do clipboard sai **vazia** em vez de repetir os 11 zeros.
- **Nova subseção "Dados da Conta Santander" no formulário:** substitui a antiga linha "Banco / Chave Pix / PIS". Contém os campos **Agência** e **Conta**, com título no mesmo padrão de "Endereço" (`label.cred-section-label` acima da linha de campos).
  - **Agência** (`cred-agencia`, estado `agenciaSantander`): exige **exatamente 4 dígitos**, gravada como **texto** para preservar zeros à esquerda. Não presume zeros — `56` continua `56` (inválido), nunca vira `0056` nem `5600`.
  - **Conta** (`cred-conta`, estado `contaSantander`): máscara `XXXXXXXX-X` (8 dígitos + verificador = 9), gravada como **texto**. Caso especial: ao exceder 9 dígitos com zeros à esquerda presentes, os zeros à esquerda são descartados para dar lugar aos novos dígitos.
- **Campo PIS/PASEP/NIT/NIS movido para junto do anexo da categoria VI:** nova função `moverDocPIS` extrai a linha "VI – Cópia da inscrição do PIS..." da tabela nativa e a injeta como seção destacada `#cred-doc-pis` (com os botões Sim/Não da revisão e o campo de digitação do número logo abaixo do anexo), análogo ao doc de identidade (II) com CPF/RG. A seção `#cred-doc-pis` é posicionada **logo abaixo da subseção II** (`#cred-doc-identidade`), dentro de "Dados Pessoais" — para isso `moverDocPIS` passou a receber `formContainer` e insere o container após `#cred-doc-identidade` (fallback: após a Ficha de Inscrição, ou no topo do `modalBody`). A categoria VI passa a ser pulada em `injetarBotoesCategorias`.
- **Dois cabeçalhos de grupo separando o modal em etapas (nova função `injetarHeadersSecao`):** o modal passa a ter dois cabeçalhos `.cred-section-group-header`:
  - **"Preenchimento de Dados Pessoais"** (`#cred-header-preenchimento`) — injetado no `modalBody` **acima da subseção I (Ficha de Inscrição)**. Substitui o antigo cabeçalho "Dados Pessoais" (que ficava dentro de `#cred-form-container`); o header foi removido do template de `criarFormulario` e agora é um elemento independente no `modalBody`.
  - **"Verificação de Documentos"** (`#cred-header-verificacao`) — injetado logo **acima da tabela nativa de anexos** (`.div_lista_aprovacao_anexos`), separando os campos de preenchimento da conferência dos demais documentos (III, IV, V, VII…).
  - Ambos são recriados na re-injeção (reload AJAX) e removidos na navegação SPA. `moverDocIdentidade` deixou de depender do header no `formContainer` (agora sempre faz `appendChild`).

### Alterado

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

### Corrigido

- **Hyperlink do protocolo perdido ao colar na planilha (`prepararDadosClipboard` / `escreverClipboardSync`):** a coluna E (protocolo) não chegava em rich text com link clicável no Google Sheets em dois cenários: (1) o fallback síncrono `escreverClipboardSync` copiava apenas `text/plain` via `<textarea>`, descartando o `text/html` com o `<a href>`; agora usa um listener `copy` que injeta ambos os formatos (`text/html` + `text/plain`) via `clipboardData`. (2) A URL do protocolo (`window.location.href`, que contém `&hash=...`) não era escapada no atributo `href`, gerando HTML inválido; agora passa por `escapeHtml(url)`.

### Alterado

- **Reordenação da seção "Dados Pessoais" no formulário:** o bloco CPF/RG/Nacionalidade foi movido para o final do formulário, imediatamente após "Regiões Escolares" e antes da seção de documentos. O restante dos campos (Estado civil, Endereço, E-mail/Celular, Banco/Pix/PIS, Função pretendida, Regiões Escolares) permanece na mesma ordem.
- **Corrigido: coluna AS (Ciclo) sempre vazia quando `autoMarcador` estava desativado:** `aplicarMarcadorCiclo` só era chamada dentro do bloco `if (autoMarcador)`, portanto `cicloAtual` nunca era calculado quando o checkbox de marcadores estava desmarcado. Solução: a chamada foi movida para antes do `if (autoMarcador)`, com segundo parâmetro `aplicarMarcador = true/false` que separa o cálculo (sempre feito) da aplicação no select2 (condicionada a `autoMarcador`).
- **Corrigido (3ª vez — causa raiz): clipboard no modo "Copiar" com progresso restaurado do localStorage:** `dadosExtraidos` nunca era salvo no localStorage nem restaurado por `restaurarProgresso()`, portanto ao clicar "Copiar" em um protocolo já concluído/restaurado a função `prepararDadosClipboard()` lançava `TypeError: Cannot destructure property of null` — silenciado pelo `catch`, deixando o clipboard intacto com o conteúdo anterior do sistema. Correção: `salvarProgresso()` agora persiste `protocolo`, `url`, `dataEnvio` e `cicloAtual`; `restaurarProgresso()` reconstrói `dadosExtraidos` e `cicloAtual` a partir desses campos. O bloco `catch` do modo concluído foi tornado visível (exibe `alert` com a mensagem de erro) e `window.open` só é chamado após cópia bem-sucedida.
- **Corrigido (2ª vez): clipboard colava conteúdo errado na Fase 2 (`copiarParaPlanilha`):** mesmo após o fallback `execCommand`, o problema regressou porque qualquer `await` (incluindo `aguardarElemento`) descarta o contexto de gesto do usuário necessário ao `execCommand`. Solução definitiva: extração dos dados e gravação no clipboard (via `escreverClipboardSync`) movidas para **antes do primeiro `await`** no handler de `#enviar_documento`, ainda dentro do stack síncrono do click original. A função `copiarParaPlanilha` foi decomposta em `prepararDadosClipboard()` (monta os dados, síncrona) e `escreverClipboardSync(dados)` (grava via textarea + execCommand, síncrona). O modo "concluído" (rebater) também foi atualizado para usar a mesma estratégia.
- **Corrigido (1ª vez): clipboard colava conteúdo errado no Google Sheets (`copiarParaPlanilha`):** na Fase 2 do fluxo de conclusão, `copiarParaPlanilha` era chamada após `setTimeout` e cliques automáticos, perdendo o foco do documento; a `Clipboard API` falhava silenciosamente e o Sheets usava o conteúdo anterior do clipboard do sistema. Correção: adicionado fallback síncrono via `document.execCommand('copy')` (textarea temporária) quando `navigator.clipboard.write` rejeita. O envelope HTML foi corrigido para `<!DOCTYPE html><html><body>…</body></html>` (Sheets requer o documento completo para reconhecer a tabela). Adicionado `escapeHtml()` nos valores das células HTML para evitar injeção de marcação.
- **Coluna F "Motivo da inabilitação" preenchida automaticamente:** quando o resultado é `inabilitado`, a coluna F recebe a lista das categorias com botão "Não" marcado, separadas por vírgula e na ordem canônica I–XI (ex: `VI, X`). Quando habilitado, a coluna fica vazia.
- **Remapeamento completo das colunas do clipboard (`copiarParaPlanilha`):** reordenadas para corresponder à nova estrutura da planilha de destino (46 colunas, A–AS). Nova ordem: Analisado por · Data e hora · Resultado · Nome · Protocolo · Motivo inabilitação · CPF · RG · Nacionalidade · Data de Nascimento · Estado Civil · Etnia · CEP · Logradouro · Número · Bairro · Cidade · E-mail · Celular · Banco · Chave Pix · Agência Santander · Conta Corrente · Nome no Banco · PIS · Ed. Básica · Ed. Física · Artes · Regiões 1–5 · Docs I–XI · Ciclo. Colunas reservadas (Motivo, Etnia, Agência, Conta, Nome no Banco) sempre vazias.
- **Campo "Data de Nascimento" adicionado ao formulário:** posicionado à direita de Nacionalidade na seção Dados Pessoais. Aceita apenas dígitos e aplica máscara progressiva `DD/MM/AAAA`; botão de calendário aciona o `input[type=date]` nativo oculto para seleção via date picker. Valor persiste em progresso (`dataNascimento`) e é restaurado/zerado junto com os demais campos.
- **Documento de identidade (II) incorporado à seção "Dados Pessoais":** nova função `moverDocIdentidade` extrai a linha "II – Cópia de documento de Identidade..." da tabela nativa e a injeta como `#cred-doc-identidade` dentro do `formContainer`, logo após os campos CPF/RG/Nacionalidade — com botões Sim/Não já vinculados à categoria `'II'`. A categoria II é ignorada em `injetarBotoesCategorias` para evitar duplicação.

## [0.5.0] — 2026-03-17

### Alterado

- O botão "Concluir e copiar" foi renomeado para **"Concluir"**.
- O fluxo de conclusão agora ocorre em duas etapas:
  - **Primeira etapa (ao clicar em "Concluir"):** o modal se fecha e o script clica automaticamente no botão "Responder" do 1Doc. Em seguida, insere o modelo padrão de resposta `[CRED-CHP014] Inscrição recebida` no editor de texto e exibe um aviso ao credenciador para que ele:
    - Selecione manualmente o destinatário (mostrando qual é o e-mail do candidato)
    - Verifique se há outras mensagens do candidato no protocolo

    Nesta etapa, os marcadores de credenciadora, ciclo, habilitado/inabilitado já são aplicados automaticamente.
  - **Segunda etapa (ao clicar no botão "Responder" para enviar):** o script automaticamente aplica o marcador "Conferido", copia os dados do candidato para a área de transferência, confirma o envio da resposta, arquiva o protocolo no 1Doc e abre/muda para a aba da planilha de controle.

## [0.4.0] — 2026-03-13

### Adicionado

- **Botão "Dúvida"** no rodapé do formulário: visível apenas enquanto o preenchimento está incompleto. Ao clicar, salva o progresso, aplica o marcador "Dúvida" ao protocolo e retorna ao inbox automaticamente.

### Alterado

- O campo RG agora aceita o CPF como documento substituto (conforme previsão legal): ao informar o CPF no campo RG, o sistema reconhece e exibe o número no formato correto.
- O botão "Dúvida" aparece ou desaparece automaticamente conforme os campos do formulário são preenchidos.
- Ao concluir o credenciamento, o protocolo é arquivado automaticamente no 1Doc, sem ação manual do credenciador. Se o arquivamento não for possível, o sistema retorna ao inbox normalmente.

## [0.3.0] — 2026-03-13

### Adicionado

- **Marcador de credenciadora existente é preservado:** ao abrir o painel em um protocolo que já tem marcador de credenciadora, o sistema mantém o marcador existente. Um novo marcador só é inserido quando nenhum da equipe está presente.
- **Diálogo de confirmação ao concluir sem marcadores automáticos:** ao clicar em "Concluir e copiar" com a opção "Aplicar marcador automaticamente" desmarcada, o sistema pergunta o que fazer: aplicar os marcadores mesmo assim, concluir sem aplicar ou voltar ao formulário.

### Alterado

- A janela de anexos agora abre na metade direita da tela, complementando a divisão de tela com o protocolo.
- Com a opção "Aplicar marcador automaticamente" desmarcada, nenhum marcador é aplicado — inclusive o de ciclo — ao abrir o painel.

### Corrigido

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

---

> **Nota de migração (2026-08-12):** até a versão 0.6.2 este histórico ficava em um `changelog.md` único da pasta, compartilhado por todos os scripts, com seções `### Categoria — nome-do-script`. As entradas acima são a parte referente ao `credenciamento.user.js`, com as datas e números originais preservados. O `@version` do script estava em `0.6.1` por lapso — as mudanças de 2026-07-08 foram publicadas sob o número de release da pasta (`0.6.2`) sem bump do cabeçalho; por isso a versão seguinte é `0.6.3`, e não `0.6.2`.
