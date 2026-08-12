# Changelog — PrintZap

Todas as mudanças notáveis neste script serão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não publicado]

### Adicionado
- Script inicial PrintZap com botão de impressora injetado no header do chat aberto do WhatsApp Web.
- Captura **passo-a-passo** controlada pelo usuário: ao clicar no botão, o navegador pede autorização de captura de tela via `navigator.mediaDevices.getDisplayMedia` (uma vez por sessão).
- Cada captura é convertida para PNG e copiada automaticamente para a área de transferência via `navigator.clipboard.write` + `ClipboardItem`. O usuário cola onde quiser (Word, e-mail, processo do 1Doc) entre os passos.
- Painel de controle flutuante (canto inferior direito) com status da sessão e botões "Próxima" e "Encerrar".
- Atalhos de teclado ativos somente durante a sessão: **Enter** avança para a próxima tela, **Esc** encerra.
- Rolagem de 90% do `clientHeight` por passo (10% de sobreposição entre capturas consecutivas para evitar corte de mensagens).
- Recorte inteligente da captura: primeira tela inclui `#main` inteiro (header do contato + mensagens); telas seguintes incluem apenas o painel de mensagens, sem repetir o header.
- Detecção automática de fim da conversa: quando a última mensagem do DOM aparece no viewport, o painel desabilita "Próxima" e mostra "Fim da conversa atingido". A sessão não encerra sozinha — o usuário decide quando.
- Encerramento seguro via clique em "Encerrar", tecla Esc ou controle nativo do navegador ("Parar de compartilhar"): libera `MediaStream`, remove o `<video>` oculto, desregistra atalhos, remove o painel.
- Toasts informativos para cancelamento e erros (clipboard sem foco, browser não suportado, etc.).
- MutationObserver com debounce de 200ms para re-injetar o botão quando o usuário troca de conversa.
- Logs com prefixo `[PrintZap]` para diagnóstico (sessão iniciada, frames capturados, fim atingido, erros).

### Decisões técnicas relevantes
- **html2canvas e jsPDF abandonados** após múltiplas tentativas de otimização (buffer único → streaming → recorte de viewport → `scale: 1`) — todas falharam por consumo de memória ao clonar o DOM do WhatsApp (ver `documentacao_printzap.md` §10).
- **Sem dependências externas**: o script depende apenas de APIs nativas do navegador, sem `@require`.
- Stream `getDisplayMedia` reaproveitado entre frames (1 autorização → N capturas).
- Painel de controle ocultado durante `drawImage` para não aparecer nas capturas.
