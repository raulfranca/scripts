# Product Requirements Document (PRD)
# Script de Credenciamento de Professores

---

## Script — `credenciamento.user.js`

**Nome (`@name`):** 1Doc - Credenciamento de Professores
**Domínio (`@match`):** `https://*.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js`
**Versão atual:** `1.6.0`

---

**Público-Alvo:** Equipe de triagem/credenciamento (Renata, Catarina, Alessandra)

---

## 1. Objetivo e Visão Geral

Agilizar e padronizar o processo de credenciamento de professores substitutos analisados via 1Doc. O script elimina o trabalho manual de digitação e formatação ao extrair os dados relevantes diretamente da interface do 1Doc, aplicar o marcador de responsabilidade e copiar as informações para a área de transferência prontas para serem coladas com formatação rica (hiperlinks) pelo usuário diretamente na planilha de controle no Google Sheets.

## 2. Casos de Uso (User Flow)

1. O usuário abre a página de um protocolo específico no 1Doc (`pg=doc/ver`).
2. O script injeta um botão "Credenciamento" no cabeçalho, ao lado dos marcadores.
3. Se a opção "Abrir automaticamente" estiver ativada, um Dialog (pop-up) central surge imediatamente na tela. Caso contrário, o usuário clica no botão para abri-lo.
4. Ao abrir, o Dialog executa automaticamente a fase de extração:
* Lê a pessoa selecionada no menu de botões (lembrando a última escolha via `localStorage`).
* Extrai o número do protocolo, o link da página e o nome do candidato.
* Injeta um `<script>` com jQuery para aplicar o marcador correspondente ao credenciador e remover marcadores de outros membros da equipe.
* Exibe os dados extraídos (protocolo e candidato) como prévia no painel de resultado.
* Habilita o botão "Copiar" e coloca o foco nele.

5. O usuário verifica os dados e pode mudar o credenciador se necessário; ao mudar, o marcador é trocado e o foco retorna automaticamente ao botão de cópia.

6. O usuário clica no botão ou pressiona **Enter** para copiar e fechar:
* Os dados são copiados para a área de transferência (HTML rico + TSV como fallback).
* O dialog fecha automaticamente.
* O usuário cola manualmente na planilha do Google Sheets (Ctrl+V).

---

## 3. Requisitos Funcionais (O que o script deve fazer)

### 3.1. Interface de Usuário (UI)

* **Botão de Ativação:** Injetar um botão na barra de ferramentas superior do 1Doc (classe `.btn-group-tags`), estilizado idêntico aos botões nativos (`.btn-inverse`).
* **Dialog Central (Pop-up):** Criar uma janela modal sobreposta à tela escurecida (`overlay`). Deve conter:
* Seletor de Credenciador(a) com os nomes da equipe (botões com classe `.active`).
* Checkbox "Abrir automaticamente nos protocolos".
* Botão de ação "Copiar" — sempre em foco após a extração, retoma o foco automaticamente se o usuário clicar nos botões de credenciador.
* Painel de resultado mostrando os dados capturados: Data/Hora, Protocolo e Candidato (exibido após extração, antes da cópia).
* Alerta visual destacado: *"⚠️ Atenção: Verifique sempre se o nome de quem enviou o protocolo é o mesmo da pessoa que está se candidatando."*



### 3.2. Extração de Dados

O script deve ler o DOM da página do 1Doc para localizar:

* **Número do Protocolo:** Extraído do elemento `.nd_num`.
* **URL do Documento:** Capturada via `window.location.href`.
* **Nome do Candidato:** Capturado de forma resiliente do elemento `span.pp`, priorizando o atributo `data-content` ou filtrando o texto caso haja um selo de verificação (Gov.br).
* **Data e Hora de Envio:** Extraída via seletor direto `.well.well-header .row-fluid.horario > .span12 > span`. O container `.row-fluid.horario` é único na página (confirmado no DOM real). Se não encontrado, campo fica vazio e o dialog exibe "(não encontrada)".

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
* *Coluna B:* Data e Hora de envio do protocolo.
* *Coluna C:* Hiperlink contendo o número do protocolo visível apontando para a URL do 1Doc.
* *Coluna D:* Nome do candidato.


* **Plain Text (TSV):** Formato de fallback separado por tabulações (`\t`), mesma ordem de colunas.

### 3.5. Área de Transferência — Passo Final

Após a cópia bem-sucedida para o clipboard, o dialog fecha automaticamente. O usuário deve colar manualmente na planilha do Google Sheets via Ctrl+V. O formato HTML rico garante que o hiperlink na coluna B seja preservado ao colar.

---

## 4. Requisitos Não-Funcionais (Como deve ser feito)

* **Persistência de Estado:** As escolhas do dropdown (Nome) e do checkbox (Auto-abrir) devem ser salvas no `localStorage` do navegador para que a preferência seja mantida entre sessões e recarregamentos de página.
* **Resiliência a SPA (Single Page Application):** O 1Doc navega entre protocolos sem recarregar a página (via AJAX). O script deve implementar um `setInterval` ou `MutationObserver` para monitorar a mudança de URL e resetar o estado do Dialog sempre que um novo documento for aberto.
* **Isolamento de Escopo:** O código deve rodar em uma IIFE para não gerar conflito de variáveis globais com o sistema do 1Doc.
* **Performance:** A injeção e extração não devem travar a interface principal do usuário (UI Thread). O uso de `setTimeout` é necessário para dar tempo de o DOM do 1Doc ser completamente renderizado antes da extração.