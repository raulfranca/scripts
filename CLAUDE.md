# Instruções do Repositório

## Estrutura de pastas

```
scripts/
└── 1doc/
    ├── documentacao_1doc.md          # Boas práticas para scripts 1Doc
    ├── sme_ass.user.js
    ├── sme_ass_prd.md
    └── credenciamento/
        ├── credenciamento.user.js
        ├── credenciamento_prd.md
        └── credenciamento_index.md   # Índice de funções/variáveis — consultar antes de editar o script
```

O versionamento/backup é feito pelo Git (branch `dev` → merge para `main` para publicar).

## Regras obrigatórias

1. **documentacao** — antes de editar qualquer código, leia o arquivo `documentacao_*.md` do diretório em questão. Ele contém as melhores práticas vigentes para aquele script.

2. **Atualizar documentacao** — quando adquirir novo conhecimento técnico ou receber novas diretrizes do usuário, registre no `documentacao_*.md` correspondente antes de encerrar a tarefa.

3. **PRD (consulta)** — consulte o `*_prd.md` correspondente antes de:
   * Planejar ou implementar uma nova funcionalidade.
   * Fazer mudanças de escopo ou comportamento relevantes.
   * Responder dúvidas sobre o que o script faz ou deve fazer (o PRD é a fonte de verdade dos requisitos).

4. **PRD (atualização)** — atualize o `*_prd.md` correspondente antes de encerrar a tarefa sempre que:
   * Um requisito funcional for adicionado, removido ou alterado.
   * Os metadados do cabeçalho do script (versão, match, grant, etc.) forem modificados.
   * O usuário confirmar um novo comportamento que diverge do que está documentado.

5. **Changelog** — ao final de toda tarefa que modifique funções, UI, variáveis de estado ou comportamento de qualquer script, registre a mudança na seção `## [Não publicado]` do `changelog.md` correspondente. Use as categorias do Keep a Changelog: `Adicionado`, `Alterado`, `Corrigido`, `Removido`. Não crie entrada se a única alteração foi em documentação ou comentários.

6. **Índice de funções (credenciamento)** — para edições em `credenciamento.user.js`, **não carregue o script inteiro**. Siga este fluxo:
   1. Leia `credenciamento/credenciamento_index.md` para localizar a(s) função(ões) e variáveis relevantes.
   2. Use `#nomeDaFunção` no chat do Copilot para carregar apenas o contexto necessário (ex.: `#injetarControlesNoModal`, `#copiarParaPlanilha`).
   3. Se for necessário entender o fluxo completo, aí então leia o script inteiro.
   4. Ao alterar nomes de funções, adicionar novas ou mudar a responsabilidade de alguma, atualize `credenciamento_index.md`.

7. **Versionamento** — o número de versão (`@version` no script, `Versão atual` no PRD, cabeçalho no changelog) representa **o que está publicado** (branch `main`). Regras obrigatórias:
   * **Nunca** altere `@version`, `Versão atual` no PRD nem promova `## [Não publicado]` por conta própria.
   * Durante o trabalho, registre tudo em `## [Não publicado]` no `changelog.md` correspondente.
   * Somente quando o usuário solicitar explicitamente (ex.: "publique como 0.4.0"), execute:
     1. Atualize `@version` no cabeçalho do script.
     2. Atualize `Versão atual` no PRD correspondente.
     3. No changelog: renomeie `## [Não publicado]` para `## [X.Y.Z] — AAAA-MM-DD` e crie um novo `## [Não publicado]` vazio acima.

## Checklist de início de tarefa

Antes de qualquer implementação:

1. **Ler `documentacao_*.md`** do diretório relevante.
2. **Consultar o PRD** (`*_prd.md`) se a tarefa envolver:
   - Nova funcionalidade ou mudança de comportamento visível ao usuário.
   - Dúvida sobre o que o sistema deve ou não deve fazer.
   - *(Dispensável para: bug pontual e isolado, ajuste de texto/cor/layout especificado pelo usuário, refatoração sem impacto visível.)*
3. **Para edições em `credenciamento.user.js`:**
   - Ler `credenciamento_index.md` e identificar as funções/variáveis relevantes pelo nome.
   - Buscar as funções no script via regex — não carregar o arquivo inteiro.
   - Carregar o script inteiro apenas se precisar entender o fluxo completo.
4. **Para injeções em novos pontos do DOM do 1Doc:**
   - **Não abrir** `1Doc - processo.mhtml` diretamente — o arquivo tem ~20 MB e satura o contexto.
   - Usar `grep_search` com o termo próximo ao ponto de injeção (ex: `btn-group-tags`, `modal_aprovacao_anexos`) para extrair apenas o trecho relevante do HTML.

## Checklist de final de tarefa

Antes de encerrar:

1. **`changelog.md`** — registrar em `## [Não publicado]` toda mudança de função, UI, variável de estado ou comportamento. Pular se só houve mudança em documentação.
2. **`credenciamento_index.md`** — atualizar se: função criada, renomeada ou removida; variável de estado adicionada ou removida; descrição de responsabilidade ficou desatualizada.
3. **`credenciamento_prd.md`** — atualizar se: requisito funcional adicionado, alterado ou removido; campo do formulário ou coluna da planilha criado/removido; regra de validação mudou; novo seletor DOM relevante foi identificado.
4. **`documentacao_1doc.md`** — atualizar se: nova técnica aplicada, limitação descoberta ou diretriz recebida do usuário que deve valer para tarefas futuras.
