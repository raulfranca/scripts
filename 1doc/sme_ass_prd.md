# Product Requirements Document (PRD)

**Nome (`@name`):** 1Doc - Triagem de Assinaturas (Pindamonhangaba)
**Autor (`@author`):** Raul Cabral
**Domínio (`@match`):** `https://pindamonhangaba.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/sme_ass.user.js`
**Descrição:** Triagem inteligente dos documentos que requerem assinatura no 1Doc.

---

## 1. Visão Geral e Objetivos

O script foi criado para automatizar e otimizar o fluxo de trabalho dos servidores da Secretaria de Educação (SME) de Pindamonhangaba que realizam a triagem de processos no 1Doc. O foco principal é rastrear documentos que exigem a assinatura de autoridades (como a Secretária de Educação) e automatizar as ações de marcação (tags) ou arquivamento, eliminando cliques repetitivos e reduzindo o tempo de triagem a um único toque na tecla `Enter`.

## 2. Casos de Uso (User Flow)

1. **Página Carregada:** O usuário abre um documento no 1Doc.
2. **Varredura Invisível:** O script escaneia o histórico do documento em background buscando o padrão `"solicitou a assinatura de [Nomes Salvos]"`.
3. **Abertura Inteligente:** Se encontrar solicitações (e o *auto-abrir* estiver ativado), um painel superior desce automaticamente com o resumo de todas as assinaturas ordenadas cronologicamente, rolando a página até a assinatura mais relevante.
4. **Ação Rápida (1 Click / 1 Enter):**
* **Cenário A (Há pendências):** O botão amarelo "Marcar" ganha foco. O usuário tecla `Enter`, o script aplica a tag "FALTA ASSINAR" e volta para a caixa de entrada. Se já estiver marcado, apenas volta para a caixa de entrada.
* **Cenário B (Tudo assinado):** O botão verde "Arquivar" ganha foco. O usuário tecla `Enter`, o script remove a tag de pendência (se houver), arquiva o documento, para de acompanhar e fecha o modal automaticamente.



---

## 3. Funcionalidades e Requisitos de Negócio

### 3.1. Interface de Usuário (Painel Drawer)

* **Ponto de Entrada:** Um botão azul com ícone de certificado/caneta inserido ao lado do botão nativo de "Marcadores" (Tags) do 1Doc.
* **Layout:** Um painel deslizante superior (Drawer) que não bloqueia a visão do documento inteiro, contendo:
* **Header Superior:** Caixa de texto para inclusão de nomes, botão "Incluir", toggle "Auto-abrir" (Switch iOS style), botões de ação ("Marcar" e "Arquivar") e barra de estatísticas (Total, Assinados, Pendentes).
* **Header Inferior:** Área para exibição dos *Chips* (etiquetas) com os nomes salvos.
* **Corpo:** Lista dos despachos encontrados contendo a solicitação, replicando o design nativo (caixas brancas com bordas, tags verdes/vermelhas de status).



### 3.2. Gestão de Nomes (Chips e Memória)

* O sistema deve permitir a inclusão de múltiplos nomes simultâneos para busca.
* A adição é feita digitando o nome e clicando em "Incluir" ou pressionando `Enter`.
* Os nomes viram "Chips" azuis com um botão "X" para remoção.
* A lista de nomes deve ser persistida na memória local do navegador (`localStorage`) para estar disponível em todas as páginas e sessões.

### 3.3. Varredura, Ordenação e Scroll Inteligente

* O script deve ler o DOM procurando blocos da *Timeline* (`.desp_notificacao`) que contenham a frase alvo.
* **Ordenação Cronológica:** Todos os despachos encontrados devem ter sua data lida e convertida. Os cards exibidos no *Drawer* devem estar sempre ordenados do mais antigo para o mais recente.
* **Scroll Inteligente:** Ao abrir o painel, a janela (`window`) deve rolar suavemente para destacar o card no documento original, deixando uma margem visual exata do tamanho do Drawer:
* Se houver pendências: rola para a pendência *mais antiga*.
* Se não houver pendências: rola para a assinatura *mais recente*.


* O item focado recebe uma animação CSS de "piscar amarelo" (`highlight-target`) por 2 segundos.

### 3.4. Automação do Botão "Marcar" (Cenário Pendente)

* **Condição de Exibição:** Fica visível, ativo e em foco (pronto para `Enter`) caso haja *pelo menos uma* assinatura pendente.
* **Comportamento 1 (Sem a Tag):** Injeta um `<script>` com jQuery para localizar a opção "FALTA ASSINAR" no `#marcadores_ids` e aplicá-la via `.val(...).trigger('change')`. Aguarda a resposta do servidor e clica no botão Voltar (`.icon-chevron-left`). **Não deve usar** simulação de cliques (`MouseEvent`, `dispatchEvent`) no Select2, pois essa abordagem falha consistentemente no 1Doc.
* **Comportamento 2 (Com a Tag):** Se o script detectar na tela que a tag "FALTA ASSINAR" já existe, o botão muda para "✔ Marcado". Teclar `Enter` ignora a injeção da tag e apenas aciona o botão Voltar.

### 3.5. Automação do Botão "Arquivar" (Cenário Assinado/Resolvido)

* **Condição de Exibição:** Fica visível, ativo e em foco caso haja *zero* assinaturas pendentes (mesmo que o total solicitado seja zero, permitindo arquivamento rápido de documentos sem relação com assinaturas).
* **Comportamento:** 1. Verifica se a tag "FALTA ASSINAR" está na tela. Se sim, injeta jQuery para removê-la especificamente e aguarda 500ms.
2. Clica nativamente no botão flotuante "Arquivar + Parar de Acompanhar".
3. Abre um `setInterval` de altíssima velocidade (100ms) espiando a renderização do modal de confirmação. Assim que o botão `#sim` renderizar na tela, clica nele instantaneamente, efetivando o arquivamento sem interação humana.

---

## 4. Requisitos Técnicos e Arquiteturais

### 4.1. Compatibilidade com Single Page Application (SPA)

O 1Doc não recarrega a página ao mudar de documento. O script deve:

* Manter um `setInterval` de 400ms observando:
* Mudanças na URL (`location.href`).
* Mudanças na contagem de despachos na tela (`document.querySelectorAll('.timeline_conteudo.desp_notificacao').length`).


* Se a contagem aumentar (carregamento inicial ou *scroll/lazy load* de despachos antigos), o script deve varrer a página novamente, de forma silenciosa e performática, para atualizar os contadores no *Drawer*.

### 4.2. Injeção Segura e Resiliência (Framework 1Doc)

* **Hibridismo de UI vs Backend:** A interação com os marcadores **nunca** deve depender de simulação de cliques via JavaScript (`MouseEvent`, `dispatchEvent`), pois essa abordagem falha consistentemente no Select2 do 1Doc (o marcador não é persistido). A **única abordagem confiável** é injetar um `<script>` que usa o jQuery nativo da página (`$('#marcadores_ids').val(novosValores).trigger('change')`), conforme documentado na `documentacao_1doc.md` seção 5.3.
* **Isolamento Constante:** Utilizar `MutationObserver` apenas restrito para verificar se a barra do cabeçalho de Tags existe, mitigando consumo de CPU excessivo que atrasaria o navegador do usuário.

### 4.3. Gerenciamento de Estado

* Variáveis como `nomesSalvos` e `toggleAutoOpen` devem ser guardadas via `localStorage` e convertidas de/para Array utilizando `JSON.stringify` e `JSON.parse` atrelados a blocos `try/catch` para prevenir quebras caso a memória do navegador esteja corrompida.

---

**Critérios de Aceite (DoD - Definition of Done):**

* [x] Script executa sem erros de console ao carregar uma página de documento.
* [x] Permite cadastrar, salvar e excluir Nomes.
* [x] O painel se auto-abre e foca no botão correto dependo do status do documento.
* [x] Teclar Enter enquanto o botão está em foco realiza o fluxo inteiro de ponta a ponta.
* [x] O scroll posiciona a leitura no lugar exato, de forma não-agressiva visualmente.