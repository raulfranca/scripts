# Instruções do Repositório

## Estrutura de pastas

```
scripts/
└── 1doc/
    ├── documentacao_1doc.md          # Boas práticas para scripts 1Doc
    ├── sme_ass.user.js
    ├── sme_ass_prd.md
    └── credenciamento/
        ├── changelog.md              # Índice dos changelogs da pasta (não é changelog de nenhum script)
        ├── credenciamento.user.js
        ├── credenciamento_prd.md
        ├── credenciamento_index.md   # Índice de funções/variáveis — consultar antes de editar o script
        ├── credenciamento_changelog.md
        ├── inbox.user.js + inbox_changelog.md
        ├── folha.user.js + folha_changelog.md
        ├── desconcluir.user.js + desconcluir_changelog.md
        └── educafacil.user.js + educafacil_changelog.md
```

O versionamento/backup é feito pelo Git (branch `dev` → merge para `main` para publicar).

**Este repositório é um monorepo de scripts independentes.** Cada `*.user.js` é distribuído
por conta própria pelo TamperMonkey (via seu `@updateURL`), então cada script tem sua **própria
linha de versão e seu próprio changelog** — `<nome-do-script>_changelog.md`, ao lado do script,
mesmo padrão de `<nome-do-script>_prd.md`. Não existe versão "do repositório" nem changelog
compartilhado: uma mudança em `folha.user.js` **não** bumpa `credenciamento.user.js`.

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

5. **Changelog (um por script)** — ao final de toda tarefa que modifique funções, UI, variáveis de estado ou comportamento de um script, registre a mudança na seção `## [Não publicado]` do **`<nome-do-script>_changelog.md`** daquele script — nunca em um changelog compartilhado. Use as categorias do Keep a Changelog: `Adicionado`, `Alterado`, `Corrigido`, `Removido`. Se a tarefa tocou dois scripts, escreva duas entradas, uma em cada arquivo. Não crie entrada se a única alteração foi em documentação ou comentários.

6. **Índice de funções (credenciamento)** — para edições em `credenciamento.user.js`, **não carregue o script inteiro**. Siga este fluxo:
   1. Leia `credenciamento/credenciamento_index.md` para localizar a(s) função(ões) e variáveis relevantes.
   2. Use `#nomeDaFunção` no chat do Copilot para carregar apenas o contexto necessário (ex.: `#injetarControlesNoModal`, `#copiarParaPlanilha`).
   3. Se for necessário entender o fluxo completo, aí então leia o script inteiro.
   4. Ao alterar nomes de funções, adicionar novas ou mudar a responsabilidade de alguma, atualize `credenciamento_index.md`.

7. **Versionamento (por script)** — cada script tem sua própria linha SemVer. O número de versão (`@version` no script, `Versão atual` no PRD, cabeçalho no `<script>_changelog.md`) é **a versão daquele script**. **Toda tarefa que altera o comportamento de um script encerra com o bump da versão dele** — não espere o usuário pedir.

   **Como classificar (projeto em `0.x`, pré-lançamento):**

   | Incremento | Quando |
   |---|---|
   | **MAJOR** (`1.0.0`) | **Somente com instrução explícita do usuário.** Enquanto a versão começar com `0.`, nem breaking change promove MAJOR — ela vira MINOR (regra do SemVer para `0.x`). |
   | **MINOR** (`0.7.0`) | Nova funcionalidade, mudança de comportamento perceptível ao usuário, remoção de funcionalidade ou breaking change. |
   | **PATCH** (`0.6.4`) | Correção de bug sem nova funcionalidade, e ajustes internos com efeito visível mínimo (texto, cor, layout já especificado). |

   **Não bumpa:** refatoração sem efeito visível, mudança só em `.md` (documentação, PRD, índice, comentários). Nesses casos não há entrada de changelog e a versão fica intacta.

   **Procedimento no fim da tarefa** (executar para **cada** script alterado; os `@version` dos demais ficam intactos):
   1. Registre a mudança em `## [Não publicado]` no changelog do script durante o trabalho.
   2. Classifique o incremento pela tabela acima e calcule o novo número a partir do `@version` atual daquele script.
   3. Renomeie `## [Não publicado]` para `## [X.Y.Z] — AAAA-MM-DD` (data de hoje) e crie um novo `## [Não publicado]` vazio acima.
   4. Atualize `@version` no cabeçalho do script.
   5. Atualize `Versão atual` no PRD correspondente.
   6. **Informe no fim da resposta** qual versão saiu e por que aquele incremento — o usuário pode discordar da classificação.

   * Os três lugares (`@version`, PRD, changelog) devem sempre concordar. Se divergirem, o `@version` do script publicado em `main` é a referência — ajuste os outros dois e siga a partir dele.
   * Uma tarefa = um bump por script alterado. Iterações e correções dentro da **mesma** tarefa entram na mesma versão, não geram uma nova.
   * O bump **não** publica nada: a distribuição pelo TamperMonkey só acontece no merge de `dev` para `main`, que continua sendo ato deliberado do usuário.

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

## Ambiente de Desenvolvimento (Windows)

Runtimes disponíveis no shell (Bash/Git Bash) para scripts de verificação fora do navegador:

* **`python`** — Python 3.12.10. **`python3` não existe** neste ambiente: o alias do Windows intercepta o comando e tenta abrir a Microsoft Store, retornando erro em vez de rodar o interpretador. Sempre invocar `python`, nunca `python3`.
* **`node`** — v24.14.1. Já inclui `DecompressionStream` nativo (útil para inflar `deflate-raw` de arquivos `.xlsx`/`.zip` sem dependências externas).

Útil para validar lógica de parsing (ex.: ler `.xlsx` via `zipfile`/`xml.etree` em Python) antes de portar para o userscript, sem precisar abrir o navegador.

## Checklist de final de tarefa

Antes de encerrar:

1. **`<script>_changelog.md`** — registrar **do changelog do script alterado** toda mudança de função, UI, variável de estado ou comportamento. Um arquivo por script; se dois scripts mudaram, duas entradas. Pular se só houve mudança em documentação.
2. **Bump de versão (regra 7)** — para cada script alterado: classificar o incremento (MINOR = comportamento/funcionalidade; PATCH = correção), promover `## [Não publicado]` para `## [X.Y.Z] — AAAA-MM-DD`, criar `## [Não publicado]` vazio acima, e atualizar `@version` no script **e** `Versão atual` no PRD. MAJOR só com instrução explícita do usuário. Informar na resposta a versão gerada e o motivo.
3. **`credenciamento_index.md`** — atualizar se: função criada, renomeada ou removida; variável de estado adicionada ou removida; descrição de responsabilidade ficou desatualizada.
4. **`credenciamento_prd.md`** — atualizar se: requisito funcional adicionado, alterado ou removido; campo do formulário ou coluna da planilha criado/removido; regra de validação mudou; novo seletor DOM relevante foi identificado.
5. **`documentacao_1doc.md`** — atualizar se: nova técnica aplicada, limitação descoberta ou diretriz recebida do usuário que deve valer para tarefas futuras.
