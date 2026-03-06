# Product Requirements Document (PRD)
# Pipeline de Credenciamento de Professores

> Este PRD cobre **dois scripts TamperMonkey** que formam um pipeline unificado. Ambos devem estar instalados e ativos para automação completa.

---

## Script 1 — `credenciamento.user.js`

**Nome (`@name`):** 1Doc - Credenciamento de Professores
**Domínio (`@match`):** `https://*.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`, `GM_setValue`, `GM_getValue`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js`
**Versão atual:** `1.4.0`

## Script 2 — `sheets_paste.user.js`

**Nome (`@name`):** 1Doc - Colar na Planilha de Credenciamento
**Domínio (`@match`):** `https://docs.google.com/spreadsheets/d/1OcFrOoA4DQqz1r9cOTKG7kDWyV5jX2xcMFJcf870qzY/*`
**Permissões (`@grant`):** `GM_getValue`, `GM_setValue`, `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/sheets_paste.user.js`
**Versão atual:** `1.0.0`

**Flag `@noframes`:** presente — o script só deve executar no frame principal da planilha.

---

**Público-Alvo:** Equipe de triagem/credenciamento (Renata, Catarina, Alessandra)

---

## 1. Objetivo e Visão Geral

Agilizar e padronizar o processo de credenciamento de professores substitutos analisados via 1Doc. O script elimina o trabalho manual de digitação e formatação ao preencher a planilha de controle no Google Sheets, extraindo os dados relevantes diretamente da interface do 1Doc, aplicando o marcador de responsabilidade e copiando as informações prontas para serem coladas com formatação rica (hiperlinks).

## 2. Casos de Uso (User Flow)

1. O usuário abre a página de um protocolo específico no 1Doc (`pg=doc/ver`).
2. O script injeta um botão "Credenciamento" no cabeçalho, ao lado dos marcadores.
3. Se a opção "Abrir automaticamente" estiver ativada, um Dialog (pop-up) central surge imediatamente na tela. Caso contrário, o usuário clica no botão para abri-lo.
4. Ao abrir, o Dialog executa automaticamente a fase de extração:
* Lê a pessoa selecionada no menu de botões (lembrando a última escolha via `localStorage`).
* Extrai o número do protocolo, o link da página e o nome do candidato.
* Injeta um `<script>` com jQuery para aplicar o marcador correspondente ao credenciador e remover marcadores de outros membros da equipe.
* Exibe os dados extraídos (protocolo e candidato) como prévia no painel de resultado.
* Habilita o botão "Copiar para Planilha" e coloca o foco nele.

5. O usuário verifica os dados e pode mudar o credenciador se necessário; ao mudar, o marcador é trocado e o foco retorna automaticamente ao botão de cópia.

6. O usuário clica no botão ou pressiona **Enter** para copiar e fechar:
* Os dados são copiados para a área de transferência (fallback para Ctrl+V manual).
* Os dados estruturados são armazenados via `GM_setValue` para o script `sheets_paste.user.js`.
* A aba do Google Sheets é aberta ou focada automaticamente (`window.open(SHEETS_URL, 'sheetsWindow')`).
* O dialog fecha automaticamente.

7. O script `sheets_paste.user.js`, rodando na aba do Google Sheets, detecta o evento `visibilitychange` e:
* Lê os dados pendentes de `GM_getValue`.
* Navega automaticamente até a primeira célula vazia na **Coluna A** (via Name Box + Ctrl+End).
* Cola os dados sintentizando um `ClipboardEvent` com `DataTransfer` (preenche as Colunas A, B e C).
* Exibe um toast de confirmação com o número da linha em que os dados foram inseridos.
* Em caso de falha, exibe toast instruindo o usuário a pressionar Ctrl+V manualmente.

---

## 3. Requisitos Funcionais (O que o script deve fazer)

### Requisitos do Script 1 — `credenciamento.user.js`

### 3.1. Interface de Usuário (UI)

* **Botão de Ativação:** Injetar um botão na barra de ferramentas superior do 1Doc (classe `.btn-group-tags`), estilizado idêntico aos botões nativos (`.btn-inverse`).
* **Dialog Central (Pop-up):** Criar uma janela modal sobreposta à tela escurecida (`overlay`). Deve conter:
* Seletor de Credenciador(a) com os nomes da equipe (botões com classe `.active`).
* Checkbox "Abrir automaticamente nos protocolos".
* Botão de ação "Copiar para Planilha" — sempre em foco após a extração, retoma o foco automaticamente se o usuário clicar nos botões de credenciador.
* Painel de resultado mostrando os dados capturados (exibido após extração, antes da cópia).
* Alerta visual destacado: *"⚠️ Atenção: Verifique sempre se o nome de quem enviou o protocolo é o mesmo da pessoa que está se candidatando."*



### 3.2. Extração de Dados

O script deve ler o DOM da página do 1Doc para localizar:

* **Número do Protocolo:** Extraído do elemento `.nd_num`.
* **URL do Documento:** Capturada via `window.location.href`.
* **Nome do Candidato:** Capturado de forma resiliente do elemento `span.pp`, priorizando o atributo `data-content` ou filtrando o texto caso haja um selo de verificação (Gov.br).

### 3.3. Automação de Interface (Marcadores)

* O script deve aplicar a tag (marcador) correspondente ao nome selecionado no dropdown "Credenciador(a)" usando o componente **Select2** nativo do 1Doc.
* Ao **mudar o credenciador** (clique em outro botão no dialog), o script deve imediatamente:
  1. Inserir o marcador do credenciador recém-selecionado.
  2. Remover quaisquer marcadores cujo nome corresponda a outros membros da equipe (`EQUIPE`) que estejam aplicados no documento.
* A mesma lógica de troca (inserir novo + remover outros) se aplica ao fluxo completo acionado pelo botão "Extrair e Copiar Dados".
* A manipulação **não deve usar** simulação de cliques via JavaScript (`MouseEvent`, `.click()`, `dispatchEvent`), pois essa abordagem falha de forma consistente no Select2 do 1Doc (o marcador não é persistido).
* A **única abordagem confiável** é injetar um `<script>` que usa o jQuery nativo da página para localizar a opção pelo texto e forçar a seleção via `.val(...).trigger('change')`, conforme o snippet da `documentacao_1doc.md` seção 5.3.

### 3.4. Formatação e Área de Transferência (Clipboard)

Os dados extraídos devem ser enviados para a área de transferência em dois formatos simultâneos para garantir compatibilidade com o Google Sheets:

* **Rich Text (HTML):** Formato principal, envelopado em tags `<table><tr><td>`.
* *Coluna A:* Nome do credenciador.
* *Coluna B:* Hiperlink contendo o número do protocolo visível apontando para a URL do 1Doc.
* *Coluna C:* Nome do candidato.


* **Plain Text (TSV):** Formato de fallback separado por tabulações (`\t`).

### 3.5. Handoff para o Script 2 (GM_setValue + Abertura da Planilha)

Ao concluir a cópia para o clipboard, o Script 1 deve preparar o Script 2 para executar a colagem:

**Armazenamento dos dados (`GM_setValue`):**

Para comunicar dados entre scripts em origens diferentes (`1doc.com.br` e `docs.google.com`), o `localStorage` não pode ser usado — ele é isolado por origem. A solução é `GM_setValue`/`GM_getValue`, cujo escopo é global à instância do TamperMonkey.

* **Chave:** `1doc_cred_pending_paste` (prefixo `1doc_cred_` para consistência com as chaves do `localStorage`).
* **Valor:** JSON com a estrutura `{ credenciadora, protocolo, url, candidato, timestamp }`.

**Abertura da planilha (`window.open`):**

* A URL alvo é definida como constante `SHEETS_URL` no script.
* A abertura usa `window.open(SHEETS_URL, 'sheetsWindow')`:
  * Se já houver uma janela/aba com o nome `'sheetsWindow'`, ela é focada sem abrir nova aba.
  * Se não houver, uma nova aba é criada com esse nome; chamadas subsequentes no mesmo browser session irão focá-la.
* Como a chamada ocorre dentro de um handler de clique do usuário, popup blockers não interferem.

---

### Requisitos do Script 2 — `sheets_paste.user.js`

### 3.6. Detecção de Dados Pendentes

* O script monitora o evento `visibilitychange` do `document`. Quando a aba recebe foco (`visibilityState === 'visible'`), verifica se há dados pendentes em `GM_getValue('1doc_cred_pending_paste')`.
* Ao ser carregado em uma aba recém-aberta, aguarda o Sheets estar pronto (Name Box presente no DOM) e então verifica os dados pendentes.
* Dados com `timestamp` mais antigo que **5 minutos** são descartados silenciosamente (evita colagem acidental em sessões futuras).
* Dados malformados ou ausentes são ignorados sem exibir erro ao usuário.
* Um guard booleano (`_executando`) impede execuções concorrentes caso o `visibilitychange` dispare rapidamente.

### 3.7. Navegação até a Primeira Linha Vazia (Coluna A)

A navegação usa o **Name Box** do Sheets (campo de referência de célula no canto superior esquerdo), que é um `<input>` HTML real e pode ser manipulado diretamente via DOM — mais confiável que keyboard events para este propósito.

**Algoritmo:**
1. Despachar `Ctrl+End` no `document` para ir até a última célula usada na planilha.
2. Aguardar estabilização do DOM (~700ms).
3. Ler o valor atual do Name Box (ex: `"C150"`) e parsear o número da linha (150).
4. Calcular a linha alvo: `linha + 1` (ex: 151). Se a linha lida for 1 (planilha vazia ou só cabeçalho), usar linha 2.
5. Escrever o endereço alvo (ex: `"A151"`) no Name Box e despachar Enter **no próprio input** (não no `document`).
6. Aguardar estabilização da navegação (~600ms).

**Seletores do Name Box (tentados em ordem):**
1. `.docs-name-box-input`
2. `div.docs-name-box input[type="text"]`
3. `input[aria-label*="Cell reference"]`
4. `input[aria-label*="Referência de célula"]`

Se nenhum seletor funcionar, o fluxo lança erro e exibe toast de fallback.

### 3.8. Colagem via ClipboardEvent

A colagem **não usa** simulação de Ctrl+V (`KeyboardEvent`) — esse evento tem `isTrusted: false` quando sintetizado via JavaScript, e o Sheets o rejeita para operações de paste.

A abordagem correta é sintetizar diretamente um `ClipboardEvent` com um objeto `DataTransfer` populado e despachá-lo em `document` (onde o Sheets registra seu handler de paste interno). O Sheets lê `event.clipboardData` sem checar `isTrusted`.

**Formato dos dados** (idêntico ao copiado pelo Script 1):
* `text/html`: `<table><tr><td>Credenciadora</td><td><a href="url">PROTOCOLO</a></td><td>Candidato</td></tr></table>`
* `text/plain`: `Credenciadora\tPROTOCOLO\tCandidato` (TSV, fallback)

**Resultado na planilha:** preenche as Colunas A (credenciadora), B (protocolo como hiperlink), C (candidato) na linha alvo.

**Limpeza do flag:** o `GM_setValue` é limpado imediatamente após o dispatch bem-sucedido. Em caso de erro, o flag é mantido — o clipboard do sistema ainda contém os dados e o usuário pode colar manualmente via Ctrl+V.

### 3.9. Feedback Visual (Toast)

O script deve exibir notificações não-bloqueantes (toasts) no canto inferior direito da tela do Sheets:

* **Azul (info):** "Dados detectados. Navegando na planilha..." — exibido ao iniciar o fluxo.
* **Verde (sucesso):** "✔ Colado na linha {N}." — exibido ao concluir com êxito.
* **Vermelho (erro):** "Erro ao colar automaticamente. Pressione Ctrl+V para colar manualmente." — exibido em falha; permanece visível por 8 segundos (vs. 4s dos demais).

---

## 4. Requisitos Não-Funcionais (Como deve ser feito)

* **Persistência de Estado:** As escolhas do dropdown (Nome) e do checkbox (Auto-abrir) devem ser salvas no `localStorage` do navegador para que a preferência seja mantida entre sessões e recarregamentos de página.
* **Resiliência a SPA (Single Page Application):** O 1Doc navega entre protocolos sem recarregar a página (via AJAX). O script deve implementar um `setInterval` ou `MutationObserver` para monitorar a mudança de URL e resetar o estado do Dialog sempre que um novo documento for aberto.
* **Isolamento de Escopo:** O código deve rodar em uma IIFE para não gerar conflito de variáveis globais com o sistema do 1Doc.
* **Performance:** A injeção e extração não devem travar a interface principal do usuário (UI Thread). O uso de `setTimeout` é necessário para dar tempo de o DOM do 1Doc ser completamente renderizado antes da extração.