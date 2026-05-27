# PRD — PrintZap: Captura passo-a-passo de Conversas do WhatsApp Web

**Versão atual:** 0.1.0
**Última atualização:** 2026-05-27
**Autor:** Raul Cabral

---

## 1. Visão Geral

PrintZap é um userscript TamperMonkey que captura conversas do WhatsApp Web tela por tela, copiando cada PNG diretamente para a área de transferência. O usuário cola cada captura no destino desejado (Word, e-mail, processo do 1Doc) entre os passos. A captura usa a API nativa de compartilhamento de tela do navegador (`getDisplayMedia`), sem dependências de bibliotecas pesadas como html2canvas.

---

## 2. Problema

Documentar conversas do WhatsApp Web para processos exige hoje:
1. Tirar prints manuais de cada trecho visível da tela (Win+Shift+S).
2. Cortar a captura para retirar sidebar e elementos irrelevantes.
3. Rolar manualmente uma quantidade aproximada e repetir.

Esse fluxo é tedioso, propenso a erros (corte de mensagens entre prints, rolagem inconsistente) e cansa em conversas longas.

Tentativas anteriores deste mesmo script de gerar um PDF automático com html2canvas falharam por consumo excessivo de memória (mais de 5 GB de RAM em conversas médias). A abordagem atual sacrifica a saída unificada em PDF por **robustez e baixíssimo consumo de memória**.

---

## 3. Público-Alvo

Servidores da SME de Pindamonhangaba que precisam documentar comunicações de WhatsApp em processos administrativos no 1Doc.

---

## 4. Objetivos

- Eliminar o trabalho manual de rolar e tirar print uma a uma.
- Garantir que cada captura tenha exatamente a região útil (sem sidebar, sem barra do navegador).
- Manter o consumo de memória muito baixo (~30 MB extra) para funcionar mesmo em máquinas modestas.
- Manter tudo local — nenhum dado é enviado para servidores externos.

---

## 5. Fora de Escopo

- Geração automática de PDF unificado (abandonado por travamentos de RAM).
- Captura de conversas em segundo plano (a conversa precisa estar aberta).
- Substituição de mídia por placeholders (a captura agora usa a renderização nativa do WhatsApp; o que aparece na tela é o que é capturado).
- Upload automático para o 1Doc.
- Suporte a WhatsApp Business Web.

---

## 6. Requisitos Funcionais

### RF-01 — Botão de captura no header do chat
- Um botão com ícone de impressora aparece no header da conversa aberta, próximo aos botões nativos.
- O botão só é visível quando uma conversa está aberta (`#main header` presente no DOM).
- O botão é desabilitado durante uma sessão de captura ativa.

### RF-02 — Captura passo-a-passo guiada pelo usuário
- Ao clicar no botão, o navegador pede autorização para compartilhar a tela (`getDisplayMedia`). Essa autorização é concedida **uma única vez** por sessão.
- Após autorizar, a primeira captura é feita automaticamente e copiada para a área de transferência.
- A partir daí, cada nova captura ocorre **somente quando o usuário sinaliza** (pressionando Enter ou clicando "Próxima tela"). O usuário cola a captura entre os passos.
- A sessão **não avança automaticamente** — o ritmo é totalmente controlado pelo usuário.

### RF-03 — Detecção automática de fim da conversa
- O script detecta o fim da conversa quando o `data-id` da última mensagem do DOM coincide com uma das mensagens visíveis no viewport.
- Fallback: `scrollTop + clientHeight >= scrollHeight - 10`.
- Ao atingir o fim, o painel exibe "Fim da conversa atingido" e desabilita o botão "Próxima tela". A sessão **não encerra automaticamente** — o usuário decide quando clicar "Encerrar" (após colar a última captura).

### RF-04 — Captura via getDisplayMedia + recorte da região útil
- O script usa `navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })` para capturar a aba atual sem clonar o DOM.
- A imagem é recortada na região do painel de mensagens (`#main div[role="application"]`), removendo sidebar e barra do navegador.
- **Primeira captura:** recorta `#main` inteiro (header do contato + mensagens + barra de input).
- **Capturas seguintes:** recorta apenas o painel de mensagens (sem repetir o header).

### RF-05 — Saída: PNG por captura no clipboard
- Cada captura é convertida para PNG e escrita na área de transferência via `navigator.clipboard.write` + `ClipboardItem`.
- O usuário cola onde quiser (Ctrl+V) entre os passos.
- Não há arquivo salvo em disco; não há nome de arquivo.

### RF-06 — Painel de controle flutuante
- Durante a sessão, um painel fixo no canto inferior direito mostra:
  - Título "PrintZap — Captura ativa".
  - Status: "Tela N copiada (Ctrl+V para colar). Pressione Enter quando estiver pronto para a próxima."
  - Botão verde "Próxima (Enter)".
  - Botão "Encerrar (Esc)".
- O painel é **não-bloqueante**: o usuário continua interagindo com o WhatsApp e outras abas normalmente.
- O painel é ocultado durante o `drawImage` para não aparecer nas capturas.

### RF-07 — Atalhos de teclado
- **Enter** durante a sessão: dispara "Próxima tela".
- **Esc** durante a sessão: dispara "Encerrar".
- Atalhos ativos **apenas durante a sessão** (registrados ao iniciar, desregistrados ao encerrar) — não afetam o uso normal do WhatsApp.
- Os atalhos usam `event.preventDefault()` + `stopPropagation()` para evitar conflitos com handlers nativos do WhatsApp.

### RF-08 — Rolagem com sobreposição de 10%
- A cada "Próxima tela", o painel rola `clientHeight * 0.9`.
- A sobreposição garante que nenhuma mensagem fique exatamente na borda entre duas capturas.

### RF-09 — Encerramento seguro
- "Encerrar" libera o `MediaStream` (chama `.stop()` em cada track), remove o `<video>` oculto, remove o painel de controle e desregistra os atalhos.
- Se o usuário usar o controle nativo do navegador ("Parar de compartilhar"), a sessão é encerrada automaticamente.

---

## 7. Requisitos Não-Funcionais

- **Privacidade:** nenhum dado é enviado para servidores externos. Todo processamento é local. A permissão `getDisplayMedia` é solicitada apenas para a aba atual.
- **Memória:** pico esperado **~30 MB acima do baseline** da aba do WhatsApp. Stream gerenciado pelo navegador, fora do heap JS.
- **Velocidade:** cada captura leva ~100ms (`drawImage` + `toBlob` + `clipboard.write`).
- **Compatibilidade:** Chrome 94+, Edge 94+. Firefox pode funcionar mas sem `preferCurrentTab` (mostra todas as opções de tela).
- **Idempotência:** apenas uma sessão ativa por vez. Tentativa de iniciar outra mostra toast e ignora.

---

## 8. Metadados do Userscript

| Campo | Valor |
|---|---|
| `@name` | PrintZap — Captura passo-a-passo de Conversas do WhatsApp |
| `@namespace` | http://tampermonkey.net/ |
| `@version` | 0.1.0 |
| `@match` | https://web.whatsapp.com/* |
| `@grant` | GM_addStyle |

Não há mais `@require` — o script depende apenas de APIs nativas do navegador (`getDisplayMedia`, `ClipboardItem`).

---

## 9. Critérios de Aceite

| ID | Critério |
|---|---|
| CA-01 | Botão de impressora aparece no header quando uma conversa está aberta. |
| CA-02 | Clique no botão dispara o diálogo nativo de compartilhamento de tela. |
| CA-03 | Após autorizar, a primeira tela é copiada ao clipboard automaticamente. |
| CA-04 | Painel de controle aparece no canto inferior direito e não bloqueia interação. |
| CA-05 | Painel de controle **não** aparece nas capturas. |
| CA-06 | Cabeçalho do contato aparece apenas na primeira captura. |
| CA-07 | Cada Enter ou clique em "Próxima tela" rola ~90% e copia nova tela ao clipboard. |
| CA-08 | Ao atingir o fim da conversa, painel mostra "Fim da conversa atingido" e desabilita "Próxima". |
| CA-09 | Esc ou clique em "Encerrar" libera stream, remove painel e desregistra atalhos. |
| CA-10 | Cancelar o diálogo do navegador mostra toast "Captura cancelada" e limpa o estado. |
| CA-11 | Memória da aba não passa de ~150 MB acima do baseline durante a sessão. |
| CA-12 | Ao trocar de conversa, o botão migra para o novo header. |
