# Changelog — sme_ass.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script**. Cada script do monorepo tem changelog e numeração próprios. Toda tarefa que altera o comportamento do script encerra com o bump da versão: MINOR para funcionalidade/comportamento perceptível, PATCH para correção; MAJOR **somente** com instrução explícita do usuário (ver regra 7 do `CLAUDE.md`). `## [Não publicado]` guarda o trabalho em andamento e é promovido a `## [X.Y.Z] — AAAA-MM-DD` no fim da tarefa.

> **Início do histórico:** este arquivo foi criado em 2026-09-02, quando o script já estava na `2.10.0`. As versões anteriores não têm registro — o histórico começa na `2.11.0`.

## [Não publicado]

## [2.11.0] — 2026-09-02 — Solicitação de assinatura cancelada

### Adicionado

- **Status "Cancelada" para solicitações de assinatura canceladas (`classificarStatusAssinatura`, `VISUAL_STATUS`):** solicitações cujo selo do 1Doc indica cancelamento passam a ser exibidas no painel com tag cinza "Cancelada" (`.status-cancelado`, ícone `icon-ban-circle`) em vez de laranja "Pendente". A classificação lê o **texto** dos selos do despacho (`.btn-group.pull-right`, `.badge`, `.label`) e não a classe CSS, porque o selo de cancelamento não usa `.badge-success` e sua classe não é estável; `cancelad` é testado antes de `assinado`. Apenas selos são lidos — varrer a caixa inteira daria falso positivo com nome de anexo.
- **Contador "Canceladas: N" na barra de estatísticas (`atualizarStatCancelados`, `#stat-cancelados`):** só fica visível quando há pelo menos uma cancelada, para não poluir o painel no caso comum.

### Alterado

- **Cancelada conta como resolvida (equivale a concluída):** só assinaturas realmente pendentes entram em `Pendentes`. Um protocolo cujas solicitações estão todas assinadas e/ou canceladas cai no cenário de arquivamento — o botão "Marcar" não aparece (a tag "FALTA ASSINAR" não é aplicada), o botão verde "Arquivar" recebe o foco e `Enter` remove a tag de pendência (se existir), arquiva e para de acompanhar.
- **Scroll inteligente sem pendências rola até a solicitação resolvida mais recente** (assinada **ou** cancelada), no lugar de considerar apenas as assinadas — antes, um protocolo só com cancelamento não tinha alvo de scroll.
- **`listaResultados` guarda `status` (`'assinado' | 'cancelado' | 'pendente'`) no lugar do booleano `isAssinado`**, usado pela renderização dos cards e pela escolha do alvo de scroll.
