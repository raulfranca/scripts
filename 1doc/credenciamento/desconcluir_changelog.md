# Changelog — desconcluir.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script** e representa o que está publicado (branch `main`). Cada script do monorepo tem changelog e numeração próprios. O progresso fica em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

## [0.7.0] — 2026-06-10

### Adicionado

- **Paginação automática:** Adicionada `navegarProximaPagina()` que clica em `li.pagination_arrow a.navega_caixa i.icon-chevron-right` quando não há mais protocolos pendentes na página atual e o modo automático está ativo. O `tick()` de 1 s detecta a mudança de URL/conteúdo e retoma o ciclo na nova página automaticamente. Se não houver próxima página, o modo automático é encerrado.

## [0.6.0] — 2026-06-10

### Alterado

- **Espera manual infinita ao reabrir:** Quando `bf_v_19` é encontrado, o script clica, contabiliza o sucesso imediatamente e aguarda **indefinidamente** o botão sumir (sem timeout). Removidos `window.confirm` override e `aguardarSucessoReabertura`. O automatismo retoma sozinho quando o usuário conclui os dialogs manualmente e o botão desaparece do DOM.

## [0.5.0] — 2026-06-10

### Adicionado

- **Interceptação de confirm nativo:** `processarReabertura` agora sobrescreve `window.confirm = () => true` antes de clicar no botão `bf_v_19`, aceitando automaticamente o dialog nativo do navegador (síncrono). Após o clique, o intervalo de verificação trata dois caminhos: A) modal Bootstrap `.modal.in #sim` aparece → clica; B) `bf_v_19` desaparece diretamente via AJAX sem modal → marca reaberto. Eliminada dependência do modal Bootstrap como único critério de sucesso.

## [0.4.0] — 2026-06-10

### Alterado

- **Detecção contínua de página:** Substituído polling único por `setInterval` de 1 s que detecta mudanças de URL (`num_pagina=N`) e de quantidade de links. Ao navegar para uma nova página, o painel atualiza automaticamente e o modo automático retoma se estiver ativo. Opacidade das linhas verificadas é reaplicada a cada tick (idempotente), garantindo que linhas recém-renderizadas fiquem cinzas.

## [0.3.0] — 2026-06-10

### Adicionado

- **Modo automático + log:** Adicionado `LS_AUTO` para avanço automático entre protocolos. Botão principal substituído por toggle "▶ Iniciar / ⏸ Pausar" (vermelho quando ativo). Ao retornar ao inbox com modo automático ativo, o próximo protocolo abre automaticamente após 800 ms. Adicionado botão "📋 Ver log" que abre modal overlay com todos os protocolos analisados, indicando quais foram reabertos e quais não precisaram de ação.

## [0.2.0] — 2026-06-10

### Adicionado

- **Etapa 2 — ação na página do protocolo:** Script agora age na página do protocolo (branch `pg=doc/ver`). Quando encontra o botão `button.bf_v_19` ("Reabrir conclusão"), clica nele, aguarda o modal Bootstrap (`.modal.in #sim`) e confirma. Depois navega de volta ao inbox via `history.back()`. Novos keys de localStorage: `LS_REABERTOS`, `LS_ATIVO`, `LS_EM_PROCESSO`, `LS_ULTIMO`. Painel do inbox exibe resultado do último protocolo processado e contador de reabertos. Abertura migrou de `window.open` para navegação na mesma aba (`location.href`).

## [0.1.0] — 2026-06-10

### Adicionado

- **Novo script `desconcluir.user.js`:** Etapa 1 — painel de controle no inbox de arquivados (`caixa=arquivo`) que lista protocolos via `a.link_emissao_a`, mantém log de verificados em `localStorage` (`1doc_desconcluir_log`) e abre um por um em janela controlada (`window.open` com nome fixo `desconcluir-protocolo`). Protocolos já verificados são exibidos com opacidade reduzida.

---

> **Nota de migração (2026-08-12):** até 2026-08-04 este histórico ficava em um `changelog.md` único da pasta, compartilhado por todos os scripts. Todas as versões deste script (0.1.0 a 0.7.0) foram publicadas em 2026-06-10 e estavam agrupadas sob uma única seção `[0.6.1]` da pasta, com os números próprios do script escritos no corpo de cada item (`v0.2.0 — …`). Aqui elas foram promovidas a seções, preservando a numeração original — que já coincide com o `@version` do script.
