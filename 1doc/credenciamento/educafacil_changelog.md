# Changelog — educafacil.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script**. Cada script do monorepo tem changelog e numeração próprios. Toda tarefa que altera o comportamento do script encerra com o bump da versão: MINOR para funcionalidade/comportamento perceptível, PATCH para correção; MAJOR **somente** com instrução explícita do usuário (ver regra 7 do `CLAUDE.md`). `## [Não publicado]` guarda o trabalho em andamento e é promovido a `## [X.Y.Z] — AAAA-MM-DD` no fim da tarefa.

## [Não publicado]

## [0.1.0] — 2026-06-10

### Adicionado

- **Novo script `educafacil.user.js`:** Painel fixo no topo direito da tela no portal EducaFácil (`professor.educapindamonhangaba.com.br`) para preenchimento automático de solicitações de substituição de professores. Permite colar CSV separado por Tab (colunas: Status, Data Início, Data Fim, Dias, Período, Região, Escola, Turma, Professor). Dados persistidos em `localStorage` (`efSubs_rows`, `efSubs_status`). Lista de controle com status por linha (`pendente`, `preenchendo`, `preenchido`, `ignorado`, `erro`). Botões "Preencher" e "Ignorar/Restaurar" por linha. Resumo de contagem no topo.
- **Preenchimento automático:** Tipo (fixo "Educação Básica") → Escola (`ng-select#escola`) → Período (`ng-select#periodo`) → Data Início (`input#dataInicio`) → Data Fim (`input#dataFim`) → Professor (`ng-select#professor`, digita o nome + Enter) → Observação/Turma (`textarea#observacao`). Campo "Turmas" (`ng-select#turmas`, desabilitado) não é preenchido.
- **Helpers:** `selecionarNgSelect()` (abre dropdown, filtra, clica melhor opção); `digitarNgSelectEnter()` (abre, digita, tecla Enter — usado no campo professor); `setTextareaValue()` (setter nativo para Angular).
- **Painel collapse:** Header clicável recolhe/expande o corpo do painel; estado salvo em `localStorage` (`efSubs_collapsed`). Painel sempre visível no topo — sem botão flutuante separado.

---

> **Nota de migração (2026-08-12):** até 2026-08-04 este histórico ficava em um `changelog.md` único da pasta, compartilhado por todos os scripts. A entrada acima estava sob a seção `[0.6.1]` da pasta (release de 2026-06-10) e foi renumerada para a linha SemVer do próprio script — `0.1.0`, como o texto original já indicava e como consta no `@version`.
