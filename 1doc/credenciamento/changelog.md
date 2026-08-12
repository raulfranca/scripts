# Changelogs — 1doc/credenciamento

Esta pasta é um **monorepo de scripts independentes**: cada `*.user.js` é distribuído
separadamente pelo TamperMonkey (via seu próprio `@updateURL`) e tem, portanto,
**versão e changelog próprios**. Uma mudança em um script não bumpa os demais.

| Script | Changelog | PRD |
|---|---|---|
| `credenciamento.user.js` | [credenciamento_changelog.md](credenciamento_changelog.md) | [credenciamento_prd.md](credenciamento_prd.md) |
| `inbox.user.js` | [inbox_changelog.md](inbox_changelog.md) | [credenciamento_prd.md](credenciamento_prd.md) (seção do inbox) |
| `folha.user.js` | [folha_changelog.md](folha_changelog.md) | — |
| `desconcluir.user.js` | [desconcluir_changelog.md](desconcluir_changelog.md) | — |
| `educafacil.user.js` | [educafacil_changelog.md](educafacil_changelog.md) | — |

## Convenção

* **Arquivo:** `<nome-do-script>_changelog.md`, ao lado do script (mesmo padrão de `<script>_prd.md`).
* **Numeração:** o número de cada seção é o `@version` **daquele script**, e representa o que está publicado na branch `main`.
* **Trabalho em andamento:** vai para `## [Não publicado]` do changelog do script afetado. Só o usuário promove essa seção a um número de versão.
* **Uma tarefa que toca dois scripts** gera duas entradas — uma em cada changelog — e bumpa apenas os `@version` dos scripts que mudaram.

> **Histórico:** até 2026-08-04 este arquivo era um changelog único da pasta, com seções
> `### Categoria — nome-do-script` e um número de versão compartilhado que não correspondia
> ao `@version` de nenhum script em particular. Em 2026-08-12 o histórico foi dividido nos
> arquivos acima; cada um traz, no rodapé, a nota de como suas entradas foram remapeadas.
> O conteúdo original continua no histórico do Git.
