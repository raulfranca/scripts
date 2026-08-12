# Changelog — inbox.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script** e representa o que está publicado (branch `main`). Cada script do monorepo tem changelog e numeração próprios. O progresso fica em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

## [0.6.0] — 2026-03-18

### Adicionado

- **Auto-refresh por inatividade:** a página do inbox recarrega automaticamente após 60 segundos sem interação do usuário, evitando que credenciadoras vejam listas desatualizadas. Comportamento:
  - **Aba em segundo plano:** recarregamento via `location.reload()` ao atingir 60s de inatividade — pelo `setInterval` (verificação a cada 1s) ou imediatamente pelo `visibilitychange` ao trazer a aba à frente.
  - **Aba em primeiro plano (sem interação):** exibe um toast fixo no canto inferior direito com o contador de segundos em tempo real e um botão "Atualizar".
  - Qualquer interação (mouse, teclado, clique, scroll ou toque) zera o contador e oculta o toast.

## [0.4.0] — 2026-03-13

### Adicionado

- **Tag colorida por ciclo:** protocolos de um ciclo de inscrição diferente do que está em análise recebem automaticamente uma marcação colorida na lista do inbox, facilitando a identificação visual sem precisar abrir cada protocolo.
- **Aviso ao abrir protocolo fora do ciclo:** ao clicar em um protocolo de ciclo diferente do atual, um alerta bloqueante é exibido informando a divergência, com as opções de cancelar ou abrir mesmo assim.

### Alterado

- O Painel de Controle do inbox foi simplificado: os filtros de credenciadora atribuída e de ciclo foram removidos. A única opção disponível agora é "Dividir tela ao abrir protocolo".

### Removido

- Filtros manuais do inbox (por credenciadora atribuída e por ciclo) removidos. A organização dos protocolos passa a ser gerenciada pelo arquivamento nativo do 1Doc.

## [0.3.0] — 2026-03-13

### Adicionado

- **Novo script para o inbox:** ao clicar em um protocolo na lista, ele é aberto em janela separada, posicionada na metade esquerda da tela.
- **Botão "Credenciamento" no inbox:** abre o Painel de Controle em uma janela de opções.
- **Opção "Dividir tela ao abrir protocolo":** quando ativada (padrão), o protocolo abre na metade esquerda da tela; quando desativada, abre na aba atual. A preferência é salva entre sessões.
- **Filtro por credenciadora:** oculta da lista os protocolos já atribuídos a uma credenciadora da equipe. Desativado por padrão; preferência salva entre sessões.
- **Filtro por ciclo:** oculta protocolos de ciclos diferentes do selecionado; protocolos sem marcador de ciclo permanecem visíveis. Preferência salva entre sessões.

---

> **Nota de migração (2026-08-12):** até 2026-08-04 este histórico ficava em um `changelog.md` único da pasta, compartilhado por todos os scripts. As entradas acima são a parte referente ao `inbox.user.js`, com datas e números originais preservados — os números coincidem com o `@version` do script. Os saltos na numeração (0.5.0, 0.6.1, 0.6.2, 0.7.0) correspondem a releases da pasta que não tocaram neste script.
