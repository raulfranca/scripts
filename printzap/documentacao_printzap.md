# Documentação de Desenvolvimento: PrintZap — Captura de Conversas do WhatsApp Web

## 1. Visão Geral

PrintZap é um userscript TamperMonkey que captura a conversa aberta no WhatsApp Web (da posição atual de rolagem até a mensagem mais recente) e gera um PDF paginado em A4. Tudo ocorre localmente no navegador — sem servidores, sem upload de dados.

**Dependências externas (carregadas via `@require`):**
- html2canvas 1.4.1 — renderiza o DOM em `<canvas>`
- jsPDF 2.5.1 — compõe e exporta o PDF

## 2. Limitações do WhatsApp Web

### DOM virtualizado
O WhatsApp Web usa virtualização: mensagens fora do viewport são removidas do DOM para economizar memória. Por isso, a captura precisa ser por rolagem progressiva — não é possível capturar todo o histórico de uma vez sem rolar para cada trecho.

### Classes CSS ofuscadas
As classes do WhatsApp Web são geradas (ex.: `x78zum5`, `_amk4`) e mudam a cada deploy. **Nunca usar essas classes como seletores primários.** Hierarquia de confiabilidade:
1. `data-testid` (ex.: `[data-testid="msg-container"]`) — mais estável
2. `aria-label`, `role` (ex.: `[role="row"]`)
3. Atributos semânticos (`data-id`, `dir`, `title`)
4. Classes ofuscadas — usar apenas como último recurso e com fallback

### CORS e imagens blob:
- Imagens carregadas pelo WhatsApp chegam como `blob:` URLs no mesmo domínio — html2canvas consegue renderizá-las sem problemas de CORS.
- Imagens de avatar/foto de perfil podem ter CORS restritivo; usar `useCORS: true` + `allowTaint: false` no html2canvas.
- Arquivos criptografados (`.enc`) nunca serão renderizados — eles são substituídos por placeholders antes da captura.

### Seletores resilientes — atualização pós-deploy do WhatsApp

Quando o WhatsApp atualizar e o script parar de funcionar:
1. Abrir DevTools (`F12`) e inspecionar o elemento-alvo.
2. Procurar atributos `data-testid`, `aria-label` ou `role` no elemento ou em seus ancestrais diretos.
3. Atualizar o seletor no script, documentar o novo aqui.
4. Testar com uma conversa curta (1 tela) antes de testar com conversa longa.

## 3. Estratégia de Captura

### Fluxo geral
```
init() → aguarda #main aparecer → injeta botão no header
botão clicado → overlay aparece → captura o cabeçalho do contato
→ loop: [prepararMidia → html2canvas → coletar data-ids visíveis → rolarUmaTela → aguardar repaint]
→ até última mensagem da conversa entrar no viewport
→ comporImagemContinua (dedup por data-id)
→ gerarPDF (paginar em A4) → download
```

### Detecção de fim da conversa
O indicador primário é: o `data-id` da **última** `div[tabindex="-1"][data-id]` presente no DOM coincide com o `data-id` de alguma mensagem visível no viewport atual.

Fallback secundário: `scrollTop + clientHeight >= scrollHeight - 10` no painel de mensagens.

### Deduplicação de mensagens entre frames
Cada frame html2canvas registra os `data-id`s das mensagens visíveis e suas coordenadas Y no canvas. Ao compor a imagem final, o corte de cada frame começa na Y da primeira mensagem cujo `data-id` ainda não foi visto. Isso elimina a sobreposição sem perder conteúdo.

### Sobreposição entre frames (10%)
`scrollBy(clientHeight * 0.9)` — avança 90% da altura visível a cada passo. Os 10% de sobreposição garantem que nenhuma mensagem fique cortada entre um frame e o próximo.

## 4. html2canvas — Boas Práticas

```javascript
html2canvas(elemento, {
    useCORS: true,          // tenta buscar imagens cross-origin
    allowTaint: false,       // aborta silenciosamente se CORS falhar (não corrompe canvas)
    backgroundColor: null,  // preserva background do WhatsApp (não impõe branco)
    scale: window.devicePixelRatio || 1,  // resolução nativa da tela
    logging: false,         // desativa logs de debug em produção
    ignoreElements: (el) => el.matches('[data-printzap-ignore]')  // exclui UI injetada
})
```

**Importante:** adicionar `data-printzap-ignore` ao overlay de progresso para que ele não apareça nos screenshots.

## 5. jsPDF — Paginação A4

Dimensões A4 em mm: 210 × 297.
- Margens: 10mm cada lado → área útil: 190 × 277mm.
- Converter pixels para mm: `px * 25.4 / 96` (assuming 96dpi).
- Para cada fatia da imagem contínua com altura `h_mm`:
  ```javascript
  pdf.addImage(dataURL, 'JPEG', 10, 10, 190, h_mm, '', 'FAST');
  ```
- Qualidade JPEG 0.85 equilibra tamanho de arquivo e legibilidade do texto.

## 6. Placeholders para Mídia Não-Renderizável

Estratégia: antes de cada `html2canvas`, adicionar classe `printzap-capturing` ao `#main`. CSS injetado via `GM_addStyle` esconde os elementos originais e exibe pseudo-elementos estilizados:

```css
.printzap-capturing [data-testid="audio-play"] { visibility: hidden; position: relative; }
.printzap-capturing [data-testid="audio-play"]::before {
    visibility: visible;
    content: '🔊 Áudio';
    /* estilos de placeholder */
}
```

html2canvas **não renderiza `::before`/`::after`** — usar `div` real inserido via JS em vez de pseudo-elementos. Inserir com `data-printzap-placeholder` e remover após a captura.

## 7. MutationObserver para detecção de novo chat

Quando o usuário abre um chat diferente, o `#main` é re-renderizado. O observer observa `document.body` com `{ childList: true, subtree: true }` e re-injeta o botão se `#main header` aparecer sem o atributo `data-printzap-btn`.

## 8. Seletores mapeados (versão inicial)

| Elemento | Seletor preferido |
|---|---|
| Painel principal do chat | `#main` |
| Header do contato | `#main header` |
| Nome do contato | `#main header span[title]` |
| Painel rolável de mensagens | `#main div[role="application"]` — fallback: `#main .copyable-area` |
| Mensagem individual (linha) | `div[role="row"]` |
| ID único da mensagem | `div[tabindex="-1"][data-id]` (ancestral da `div[role="row"]`) |
| Mensagem enviada | `.message-out` dentro do `div[role="row"]` |
| Mensagem recebida | `.message-in` dentro do `div[role="row"]` |
| Áudio | `[data-testid="audio-play"]` |
| Documento | `[data-testid="document-thumb"]` |
| Vídeo | `video` ou `[data-testid="media-canvas"]` |
| Imagem | `img[src^="blob:"]` |
| Sticker | `img[src^="blob:"]` dentro de container sem texto visível |

## 10. Por que abandonamos html2canvas

As duas primeiras versões do PrintZap usavam `html2canvas` para gerar capturas em DOM, com saída em PDF via jsPDF. Mesmo após otimização agressiva (streaming, `scale: 1`, liberação explícita de canvases, recorte para o viewport), o navegador continuou travando em conversas de tamanho médio.

A causa raiz é **inerente ao funcionamento do html2canvas**: a biblioteca clona o DOM da árvore-alvo em um `<iframe>` interno para garantir um snapshot consistente. Esse clone inclui referências a imagens, fontes e estilos, e força o navegador a calcular layout do clone separadamente. No WhatsApp Web — que tem virtualização de DOM, classes ofuscadas, blobs de mídia e clones de tema — esse clone consome facilmente centenas de megabytes mesmo para uma única captura, independente das opções de configuração.

Lições aprendidas:
- Para apps com DOM complexo (React + virtualização + classes geradas), html2canvas é **inviável em produção** mesmo para uma única captura.
- Otimizações downstream (streaming, liberação de canvas, scale=1) não resolvem porque o gargalo está no upstream — no próprio clone do DOM.
- A solução correta é **terceirizar a captura para o sistema operacional/navegador** via `getDisplayMedia`, evitando qualquer clone.

## 11. getDisplayMedia + Clipboard (abordagem atual)

A versão atual usa `navigator.mediaDevices.getDisplayMedia()` — API nativa de compartilhamento de tela do navegador. O navegador captura o conteúdo renderizado pela GPU diretamente, sem clonar DOM.

### Fluxo

```js
const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    preferCurrentTab: true,    // Chrome/Edge: força "aba atual" como padrão
    audio: false,
});

const video = document.createElement('video');
video.srcObject = stream;
await video.play();
// aguardar loadedmetadata para garantir video.videoWidth disponível
```

A cada captura, desenhamos o `<video>` em um canvas, recortando a região desejada:

```js
const dpr = window.devicePixelRatio;
const rect = painelMsgs.getBoundingClientRect();
// O stream tem resolução em pixels reais (innerWidth * dpr).
// Multiplicamos as coordenadas CSS por dpr para alinhar.
ctx.drawImage(video,
    rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
    0, 0, canvas.width, canvas.height);
```

E enviamos ao clipboard:

```js
const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
```

### Pontos críticos

- **Memória**: o `MediaStream` é gerenciado pelo navegador (GPU/processo do compositor), não pelo heap JS da aba. Pico de RAM observado: ~30 MB acima do baseline, **independente do tamanho da conversa**.
- **Permissão**: o navegador exige consentimento do usuário. Solicitada uma única vez por sessão (do clique no botão até o encerramento).
- **`preferCurrentTab: true`**: flag do Chrome/Edge que já preseleciona "aba atual" no diálogo. Firefox ignora silenciosamente — usuário precisa escolher manualmente.
- **Coordenadas DPR**: o stream tem resolução real (`screen.width * dpr`). `getBoundingClientRect()` retorna coordenadas em CSS pixels. Sempre multiplicar por `window.devicePixelRatio` para converter.
- **Ocultar painel de controle durante a captura**: o painel do PrintZap fica visível na aba e seria capturado. Antes do `drawImage`, definir `painel.style.visibility = 'hidden'`, aguardar 1 RAF para o stream refletir, capturar, depois restaurar.
- **Foco do documento**: `navigator.clipboard.write` exige que o documento esteja focado. Se o usuário estiver com DevTools focado, falha. O script mostra toast orientando.
- **Track ended**: o usuário pode parar o compartilhamento pelo controle nativo do navegador. Registrar `stream.getVideoTracks()[0].addEventListener('ended', ...)` para encerrar a sessão automaticamente.

### Limitações
- O `ClipboardItem` aceita PNG; outras imagens (JPEG, WebP) têm suporte parcial e podem ser bloqueadas por segurança em algumas versões.
- Firefox sem `preferCurrentTab` exige escolha manual da aba a cada sessão (UX um pouco pior).
- Em ambientes corporativos com políticas de grupo que bloqueiam captura de tela, `getDisplayMedia` é negada.

## 12. Histórico de Mudanças Técnicas

*(Atualizar aqui sempre que um seletor for corrigido ou uma nova limitação for descoberta.)*

| Data | Mudança |
|---|---|
| 2026-05-27 | Script criado. Seletores mapeados a partir do snapshot WhatsApp.html da conversa-exemplo. |
| 2026-05-27 | Pipeline refatorado para streaming após travamento do navegador em conversa de tamanho médio. scale ajustado para 1. |
| 2026-05-27 | html2canvas e jsPDF abandonados após múltiplas tentativas de otimização falharem. Abordagem reescrita usando `getDisplayMedia` + clipboard, com captura passo-a-passo controlada pelo usuário (Enter para avançar, Esc para encerrar). |
