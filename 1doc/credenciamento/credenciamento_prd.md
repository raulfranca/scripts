# Product Requirements Document (PRD)
# Script de Credenciamento de Professores

---

## Script — `credenciamento.user.js`

**Nome (`@name`):** 1Doc - Credenciamento de Professores
**Domínio (`@match`):** `https://*.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/credenciamento.user.js`
**Versão atual:** `0.6.1`

> **Versionamento:** este campo reflete o que está publicado (branch `main`). Alterado somente mediante instrução explícita do usuário — nunca por iniciativa do agente de IA.

---

**Público-Alvo:** Equipe de triagem/credenciamento (Renata, Catarina, Alessandra)

---

## 1. Objetivo e Visão Geral

Agilizar e padronizar o processo de credenciamento de professores substitutos analisados via 1Doc. O script é um painel completo de conferência que extrai dados automaticamente da página do protocolo, aplica o marcador de responsabilidade e permite ao usuário preencher um formulário de análise (CPF, função pretendida, regiões escolares) antes de copiar as informações para a planilha de controle no Google Sheets.

## 2. Casos de Uso (User Flow)

1. O usuário abre a página de um protocolo específico no 1Doc (`pg=doc/ver`).
2. O script injeta um botão "Credenciamento" no cabeçalho, ao lado dos marcadores.
3. Se a opção "Abrir automaticamente" estiver ativada, o script clica automaticamente no botão "Tabela" (`a.link_tabela_revisao_anexos`) da primeira mensagem para abrir o modal nativo `#modal_aprovacao_anexos`. Caso contrário, o usuário clica no botão "Credenciamento" para disparar a mesma ação.
4. O modal nativo abre (carrega a tabela de revisão de documentos via AJAX). O script aguarda o carregamento e injeta os controles de credenciamento dentro do modal:
   * **Header customizado** (verde institucional) com título, botões de credenciadora e checkboxes de preferência — substitui o header nativo do modal.
   * **Bloco de identificação** (fundo verde claro) com Protocolo e Data/Hora extraídos automaticamente.
   * **Formulário** inserido acima da tabela de documentos: Nome do candidato, CPF, Função pretendida, Regiões Escolares.
   * **Botões Sim/Não por categoria** em cada linha de categoria da tabela nativa. Um par de botões é exibido por categoria (identificada por algarismo romano I–XI), independentemente de quantos arquivos estejam nela. Os botões "Revisar" individuais por arquivo são ocultados. A seção "Outros documentos anexos" não recebe botões. No estado inicial ambos os botões estão com opacidade 100%; ao clicar num, o outro vai a 50%. O estado é armazenado em `avaliacoesDocs` (objeto `{ 'I': true, 'II': false, … }`).
   * **Botão "Copiar"** adicionado ao footer do modal.
5. Ao abrir, o script executa automaticamente a fase de extração:
   * Extrai número do protocolo, data/hora de envio e URL — exibidos no bloco de identificação.
   * Pré-preenche o campo editável "Nome do candidato" com o nome extraído da página.
   * Injeta `<script>` com jQuery para aplicar o marcador do credenciador selecionado e remover marcadores dos demais membros.
   * Habilita o botão "Copiar" e coloca o foco nele.
6. O usuário confere os dados e preenche/corrige:
   * **Nome do candidato** — campo editável pré-preenchido; deve ser corrigido se o protocolo foi enviado por outra pessoa.
   * **CPF** do candidato (campo com máscara automática `000.000.000-00`).
   * **Função pretendida** (múltipla seleção entre Educação Básica/Física/Artes).
   * **Regiões Escolares** de interesse (múltipla seleção entre as 5 regiões do município).
   * **Documentos** — pode clicar nos botões "Revisar" nativos e marcar como "OK" com os toggles injetados.
7. O usuário pode trocar o credenciador no cabeçalho a qualquer momento; o marcador é atualizado imediatamente.
8. O usuário clica em "Copiar" (ou pressiona **Enter**):
   * Os dados são copiados para a área de transferência (HTML rico + TSV).
   * O modal fecha automaticamente.
   * O usuário cola manualmente na planilha do Google Sheets (Ctrl+V).

---

## 3. Requisitos Funcionais (O que o script deve fazer)

### 3.1. Interface de Usuário (UI)

* **Botão de Ativação:** Injetar um botão na barra de ferramentas do 1Doc (`.btn-group-tags`), estilizado como `.btn-info` (verde tema 1Doc).
* **Modal Nativo Modificado:** O script utiliza o modal nativo `#modal_aprovacao_anexos` (Bootstrap 2) que já existe na página, acionado pelo botão "Tabela" (`a.link_tabela_revisao_anexos`). O script clica programaticamente nesse botão, aguarda o carregamento AJAX da tabela de documentos e injeta seus controles dentro do modal. Estrutura em 5 zonas:

  **Cabeçalho customizado (injetado, substitui o header nativo):** header verde escuro (`#005400`) com duas linhas:
  - *Linha 1:* título "Credenciamento" | botões de credenciadora | botão fechar nativo do modal.
  - *Linha 2 (separada por linha tênue):* dois checkboxes brancos lado a lado:
    - **Abrir automaticamente nos protocolos** (persiste em `localStorage`).
    - **Aplicar marcador automaticamente** (persiste em `localStorage`; quando desmarcado, todas as chamadas a `trocarMarcador` são bypassadas).

  **Bloco de Identificação (fundo verde claro institucional):** exibe os dados extraídos automaticamente — Protocolo, Data/Hora e Nome do candidato. O bloco é fixo (não está dentro do `.modal-body`), visível sempre no topo. Layout em duas linhas:
  - *Linha 1:* Protocolo | Data/Hora | **Nome do candidato** (input editável, ocupa o espaço restante com `flex: 1`). Protocolo e Data/Hora renderizados como `—` até a extração ser concluída.
  - *Linha 2 (separada por divider):* checkbox **"Este nome é igual ao que está na ficha de inscrição"** — começa **desmarcado** a cada protocolo. O credenciador precisa conferir o nome antes de marcar.

  **Formulário de credenciamento (dentro do `.modal-body`, acima da tabela):** campos preenchidos/corrigidos pelo usuário, agrupados por seção:

  * **Seção "Dados Pessoais"** (header visual verde institucional sobre os campos):
    * **Linha 1 (horizontal — `.cred-dados-row`):** CPF, RG, Nacionalidade e Data de Nascimento ficam lado a lado com `.cred-field-block` por campo.
      * **CPF** — input com máscara progressiva `000.000.000-00` (armazena só dígitos).
      * **RG** — input aceita apenas dígitos; máscara `00.000.000-0` (9 dígitos). Se o usuário digitar apenas 8 dígitos, o campo formata como `00.000.000` (sem o traço e dígito verificador). Armazena só dígitos em `rgDigitos`.
      * **Nacionalidade** — input de texto pré-preenchido com `brasileira` (não apenas placeholder — tem `value` real). Editável pelo usuário. Reseta para `brasileira` a cada novo protocolo.
      * **Data de Nascimento** — input com máscara progressiva `DD/MM/AAAA` (`cred-nascimento`); botão de calendário (`cred-nascimento-picker-btn`) aciona um `input[type=date]` nativo oculto para seleção via date picker. **Campo obrigatório.** A variável `dataNascimento` só é considerada preenchida quando a data está completa (8 dígitos), é uma data de calendário válida **e** o candidato tem ≥ 18 anos; caso contrário fica vazia. Armazena `DD/MM/AAAA`.
    * **Linha 2:** Estado civil — seleção única via botões (`.cred-estadocivil-btn`): Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), Separado(a), União estável. Clicar no botão ativo o deseleciona (toggle). Reseta a cada protocolo.
    * **Endereço** — campos dispostos em duas linhas:
      * **Linha 1:** CEP (máscara `00000-000`, 8 dígitos), Logradouro, Número.
      * **Linha 2:** Bairro, Cidade.
      * Ao sair do campo CEP (`blur`), se tiver 8 dígitos, o script faz um `fetch` para `https://viacep.com.br/ws/{CEP}/json/` e preenche automaticamente Logradouro, Bairro e Cidade. Número permanece vazio para preenchimento manual. Se a resposta contiver `erro: true` ou a requisição falhar, exibe `.cred-alert-erro` na seção. Todos os campos permanecem editáveis.
    * **Celular** — input com máscara progressiva; 10 dígitos → `(00) 0000-0000`; 11 dígitos → `(00) 00000-0000`. Armazena só dígitos em `celularDigitos`. **Extração automática:** se `.media-body .media-text .ind_tel` existir na primeira mensagem do protocolo, o campo é preenchido automaticamente. Campo sempre editável.
    * **E-mail** — input de texto. **Extração automática:** o texto direto de `.media-body .media-text` (excluindo `<span>` filhos como `.ind_tel` e `.ind_documento`) é usado se contiver um e-mail válido. Campo sempre editável. **Validação de formato** ao copiar: o regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` é aplicado; campo é **opcional**, mas se preenchido precisa ser válido.
    * **Dados da Conta Santander** — subseção com título no padrão de "Endereço" (`label.cred-section-label`). Contém dois campos obrigatórios, ambos gravados como **texto** para preservar zeros à esquerda:
      * **Agência** (`cred-agencia` → `agenciaSantander`): apenas dígitos, **exatamente 4**. O script **não presume zeros** — se o usuário digitar `56`, o valor permanece `56` (inválido na conclusão), nunca vira `0056` nem `5600`.
      * **Conta** (`cred-conta` → `contaSantander`): máscara `XXXXXXXX-X` (8 dígitos + 1 verificador = 9). Caso especial de digitação: se já houver 9 dígitos com zeros à esquerda e o usuário continuar digitando, os zeros à esquerda são descartados um a um para acomodar os novos dígitos.
    * **PIS/PASEP/NIT/NIS** — o campo de digitação do número (`cred-pis` → `pisDigitos`, máscara `000.00000.00-0`, 11 dígitos) **não fica na subseção bancária**: é movido por `moverDocPIS` para uma seção destacada junto ao anexo da categoria **VI** ("Cópia da inscrição do PIS ou PASEP ou NIT"), da mesma forma que CPF/RG aparecem sob o anexo de identidade (II). A seção `#cred-doc-pis` contém o anexo, os botões Sim/Não da revisão da categoria VI e, abaixo, o campo do número.
  * **Função pretendida** — 3 botões, **múltipla seleção** (toggle): Educação Básica (verde institucional), Educação Física (vermelho), Artes (laranja). Botões inativos com `opacity: 0.35`; ativo com `opacity: 1` e leve escala.
  * **Regiões Escolares** — 5 botões, múltipla seleção (toggle): 1-Centro (amarelo), 2-Zona Oeste (verde institucional), 3-Zona Leste (vermelho), 4-Moreira César (verde), 5-Zona Rural (roxo).

  **Tabela de documentos (conteúdo nativo do 1Doc):** carregada via AJAX dentro de `.div_lista_aprovacao_anexos`. Exibe cada documento categorizado com nome, data e botão "Revisar" nativo. A linha "I - Ficha de Inscrição" é removida da tabela e movida para uma seção de destaque (`.cred-ficha-section`) posicionada entre o formulário e a tabela, contendo: label da categoria, inner table com os documentos e botões Sim/Não, e um aviso em fundo amarelo (*"Conferir se a ficha de inscrição é a versão retificada: 3 – Zona Leste, 4 – Moreira César."*).

  **Outros documentos anexos (injetado):** O script varre a tabela de despachos filhos (`#table_anexos_filhos`) em busca de anexos enviados em despachos posteriores que não são categorizados e portanto não aparecem na tabela nativa. Esses anexos são identificados comparando os `data-id_anexo` dos elementos `td.index` dentro de `#table_anexos_filhos` com os IDs decodificados (base64 `iea`) dos links do modal. A diferença é exibida numa seção "Outros documentos anexos" ao final da tabela, no mesmo formato visual (inner table com colunas Arquivo original, Em, Origem), com links clicáveis. A coluna "Em" mostra o número do despacho de onde o anexo foi extraído (obtido do `<strong data-im>` dentro do `table.despacho` ancestral). Nomes de arquivo longos são truncados via CSS (`text-overflow: ellipsis`, `max-width: 280px`) e o nome completo fica acessível em tooltip (`title`) ao fazer hover. Se não houver despachos posteriores ou anexos extras, a seção não aparece. Ao reabrir o modal (o AJAX do 1Doc recarrega a tabela), a seção é re-injetada automaticamente.

  **Rodapé (footer nativo do modal, modificado):** layout flex. Da esquerda para a direita:
  - **Chip de habilitação** (`#cred-chip-habilitacao`, `margin-right: auto`): atualizado em tempo real ao clicar nos botões Sim/Não e ao resetar o estado. Estados:
    - Cinza ("Em avaliação"): ao menos um dos 11 grupos sem avaliação.
    - Verde ("Habilitado(a)"): todos os 11 grupos marcados SIM.
    - Vermelho ("Inabilitado(a)"): ao menos um grupo marcado NÃO.
  - **Botão "Concluir e copiar"** (`btn-success`) adicionado antes do botão "Fechar" existente. Desabilitado durante a extração.

* **Foco:** botão "Concluir e copiar" recebe `.focus()` ao fim da extração.
* **Guard de injeção:** O atributo `data-cred-injetado` no modal evita duplicação. Na navegação SPA, os elementos injetados são removidos e o modal restaurado ao estado original.



### 3.2. Extração de Dados

O script deve ler o DOM da página do 1Doc para localizar:

* **Número do Protocolo:** Extraído do elemento `.nd_num`.
* **URL do Documento:** Capturada via `window.location.href`.
* **Nome do Candidato:** Capturado de forma resiliente do elemento `span.pp`, priorizando o atributo `data-content` ou filtrando o texto caso haja um selo de verificação (Gov.br).
* **Data e Hora de Envio:** Extraída via seletor direto `.well.well-header .row-fluid.horario > .span12 > span`. O container `.row-fluid.horario` é único na página (confirmado no DOM real). Se não encontrado, campo fica vazio e o dialog exibe "(não encontrada)".
* **Celular:** Extraído de `.media-body .media-text .ind_tel` (primeira mensagem do protocolo). Armazena apenas dígitos; exibe com máscara no campo. CPF não é extraído desta fonte pois vem parcialmente oculto.
* **E-mail:** Extraído do texto direto de `.media-body .media-text`, excluindo os filhos `<span>` (`.ind_tel`, `.ind_documento`). Validado com regex básico antes de preencher o campo.

### 3.3. Estado por Candidato (Persistido via localStorage)

> **Princípio fundamental:** Todo campo de texto preenchido pelo credenciador e todo par de botões Sim/Não são **obrigatórios**. Não é possível concluir ("Concluir e copiar") sem que todos estejam preenchidos — o script valida e exibe mensagem de erro especificando o campo pendente. Adicionalmente, todos esses campos são **persistidos no `localStorage`** e restaurados automaticamente ao reabrir o modal para o mesmo protocolo. Este princípio se aplica a todos os campos já existentes e a qualquer campo adicionado no futuro.

Os campos preenchidos pelo usuário são **salvos automaticamente** no `localStorage` a cada alteração (debounce de 300ms), usando o número do protocolo como chave (`1doc_cred_progresso_{protocolo}`). Ao reabrir o modal para o mesmo protocolo, o script restaura automaticamente os dados salvos, exibindo um toast informativo "Progresso restaurado automaticamente" com botão "Descartar". O progresso é **mantido** no `localStorage` após cópia bem-sucedida (não é removido). Entradas com mais de 30 dias são limpas automaticamente na inicialização do script.

Campos salvos no progresso:

| Variável | Tipo | Comportamento |
|---|---|---|
| `cpfDigitos` | `string` (só dígitos) | Resetado ao reabrir o painel ou mudar de URL |
| `rgDigitos` | `string` (só dígitos) | Resetado ao reabrir o painel ou mudar de URL |
| `nacionalidade` | `string` | Resetado para `'brasileira'` a cada protocolo |
| `estadoCivil` | `string` | Resetado (vazio) a cada protocolo |
| `celularDigitos` | `string` (só dígitos) | Resetado a cada protocolo; preenchido por extração automática se disponível |
| `email` | `string` | Resetado a cada protocolo; preenchido por extração automática se disponível |
| `cep` | `string` (só dígitos) | Resetado a cada protocolo; autopreenchimento via ViaCEP |
| `logradouro` | `string` | Resetado a cada protocolo; autopreenchido pelo ViaCEP |
| `numero` | `string` | Resetado a cada protocolo; preenchimento manual |
| `bairro` | `string` | Resetado a cada protocolo; autopreenchido pelo ViaCEP |
| `cidade` | `string` | Resetado a cada protocolo; autopreenchido pelo ViaCEP |
| `agenciaSantander` | `string` (texto, 4 dígitos) | Resetado a cada protocolo; preserva zeros à esquerda; não presume zeros |
| `contaSantander` | `string` (texto, 9 dígitos) | Resetado a cada protocolo; máscara `XXXXXXXX-X`; preserva zeros à esquerda |
| `pisDigitos` | `string` (só dígitos) | Resetado a cada protocolo; máscara `000.00000.00-0` (11 dígitos); campo movido para junto do anexo VI |
| `funcoesSelecionadas` | `string[]` | Múltipla seleção; reset limpa o array |
| `regioesSelecionadas` | `number[]` | Múltipla seleção; reset limpa `.active` de todos |
| `avaliacoesDocs` | `object` `{ [romana]: boolean }` | Avaliação Sim/Não por categoria; reset limpa o objeto |
| `#cred-nome-confirmado` | `checkbox (DOM)` | Desmarcado no reset; o credenciador confirma que o nome confere com a ficha |

O reset ocorre em dois momentos: na abertura do painel (`abrirDialog()`) e na detecção de mudança de URL (`setInterval`). Após o reset e a extração automática (`executarFluxo`), o script verifica se há progresso salvo para o protocolo atual e, em caso positivo, restaura os campos com `restaurarProgresso()`. Campos vazios no progresso salvo não sobrescrevem valores auto-extraídos (celular, e-mail).

> **Hierarquia de validação ao clicar em "Concluir e copiar":**
> 1. Checkbox "Este nome é igual ao que está na ficha de inscrição" — deve estar marcado.
> 2. CPF — 11 dígitos completos **e** válido pelos dois dígitos verificadores (algoritmo de dicasdeprogramacao.com.br; rejeita sequências de dígitos iguais). CPF inválido bloqueia a conclusão com a mensagem `"CPF inválido — verifique se houve erro de digitação."`. **Exceção:** `00000000000` (11 zeros) é aceito como CPF anulado deliberadamente — para quando o candidato não enviou o documento e o campo não pode ficar vazio.
> 3. RG — mínimo 8 dígitos.
> 4. Data de Nascimento — obrigatória; `dataNascimento` deve estar preenchida (data completa, válida e candidato ≥ 18 anos). Mensagem distingue campo em branco/incompleto de data inválida ou idade < 18.
> 5. Estado civil — obrigatório selecionar uma opção.
> 6. CEP — 8 dígitos.
> 7. Logradouro — não pode estar vazio.
> 8. Número — não pode estar vazio.
> 9. Bairro — não pode estar vazio.
> 10. Cidade — não pode estar vazia.
> 11. Celular — mínimo 10 dígitos.
> 12. E-mail — obrigatório e deve passar no regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
> 13. Agência Santander — exatamente 4 dígitos (zeros à esquerda contam; `56` é inválido).
> 14. Conta Santander — 9 dígitos (8 + verificador).
> 15. PIS/PASEP/NIT/NIS — 11 dígitos completos.
> 16. Função pretendida — ao menos uma selecionada.
> 17. Regiões Escolares — ao menos uma selecionada.
> 18. Botões Sim/Não — todos os grupos de categoria devem ter avaliação.

### 3.4. Automação de Interface (Marcadores)

* O script deve aplicar a tag (marcador) correspondente ao nome selecionado no dropdown "Credenciador(a)" usando o componente **Select2** nativo do 1Doc.
* **Toda chamada a `trocarMarcador` é condicional:** só ocorre se o checkbox "Aplicar marcador automaticamente" (`autoMarcador`) estiver ativado. Se estiver desmarcado, nenhuma modificação nos marcadores é realizada, em nenhum momento.
* Ao **mudar o credenciador** (clique em outro botão no dialog), o script deve imediatamente (se `autoMarcador` ativo):
  1. Inserir o marcador do credenciador recém-selecionado.
  2. Remover quaisquer marcadores cujo nome corresponda a outros membros da equipe (`EQUIPE`) que estejam aplicados no documento.
* A mesma lógica de troca (inserir novo + remover outros) se aplica ao fluxo completo acionado pelo botão "Copiar" (se `autoMarcador` ativo).
* **Marcador de ciclo:** ao executar `executarFluxo`, `aplicarMarcadorCiclo(dataEnvio)` determina o ciclo pelo intervalo de datas (tabela fixa de 10 ciclos, 25/02/2026–30/11/2026) e aplica o marcador `— 01` a `— 10` no select2. Só age se o marcador correto ainda não estiver selecionado. Remove outros marcadores de ciclo antes de aplicar. Se a data cair fora de todos os intervalos, registra `console.warn` e não altera nada.
* A manipulação **não deve usar** simulação de cliques via JavaScript (`MouseEvent`, `.click()`, `dispatchEvent`), pois essa abordagem falha de forma consistente no Select2 do 1Doc (o marcador não é persistido).
* A **única abordagem confiável** é injetar um `<script>` que usa o jQuery nativo da página para localizar a opção pelo texto e forçar a seleção via `.val(...).trigger('change')`, conforme o snippet da `documentacao_1doc.md` seção 5.3.

### 3.5. Formatação e Área de Transferência (Clipboard)

Os dados extraídos devem ser enviados para a área de transferência em dois formatos simultâneos para garantir compatibilidade com o Google Sheets:

* **Rich Text (HTML):** Formato principal, envelopado em tags `<table><tr><td>` com 38 colunas.
* **Plain Text (TSV):** Formato de fallback separado por tabulações (`\t`), mesma ordem e quantidade de colunas.

A função `prepararDadosClipboard()` lê diretamente das variáveis de estado do módulo (sem parâmetros). Mapeamento completo das colunas (A–AS):

| Col | Cabeçalho | Valor | Fonte |
|-----|-----------|-------|-------|
| A | Analisado por | Credenciadora ativa | `credenciadoraSalva` |
| B | Data e hora | Texto livre | `dadosExtraidos.dataEnvio` |
| C | Resultado | `habilitado` ou `inabilitado` | Calculado: algum `false` → inabilitado; todos `true` → habilitado |
| D | Nome do professor | Texto livre | `candidato` (`#cred-nome-input`) |
| E | Protocolo 1Doc | Hyperlink no HTML; texto no plain | `dadosExtraidos.protocolo` + `.url` |
| F | Motivo da inabilitação | Categorias com "Não" (ex: `VI, X`) ou vazio | `avaliacoesDocs` |
| G | CPF | Só dígitos | `cpfDigitos` |
| H | RG | Só dígitos | `rgDigitos` |
| I | Nacionalidade | Texto livre | `nacionalidade` |
| J | Data de Nascimento | `DD/MM/AAAA` | `dataNascimento` |
| K | Estado civil | Texto livre | `estadoCivil` |
| L | *(reservado — Etnia)* | Sempre vazio | `''` |
| M | CEP | Só dígitos | `cep` |
| N | Logradouro | Texto livre | `logradouro` |
| O | Número | Texto livre | `numero` |
| P | Bairro | Texto livre | `bairro` |
| Q | Cidade | Texto livre | `cidade` |
| R | E-mail | Texto livre | `email` |
| S | Celular | Só dígitos | `celularDigitos` |
| T | Banco | **Literal fixo** `Santander` | — |
| U | Chave Pix | CPF (só dígitos); **vazia se o CPF for anulado** (`00000000000`) | `cpfDigitos` |
| V | Agência Santander | Texto (preserva zeros à esquerda; `mso-number-format` no HTML) | `agenciaSantander` |
| W | Conta Santander | Texto (preserva zeros à esquerda; `mso-number-format` no HTML) | `contaSantander` |
| X | Nome do titular da conta | = nome do candidato | `candidato` |
| Y | PIS/PASEP/NIT/NIS | Só dígitos | `pisDigitos` |
| Z | Educação Básica | `Educação Básica` ou vazio | `funcoesSelecionadas` (valor interno `Ed. Básica`) |
| AA | Educação Física | `Educação Física` ou vazio | `funcoesSelecionadas` (valor interno `Ed. Física`) |
| AB | Artes | `Artes` ou vazio | `funcoesSelecionadas` (valor interno `Artes`) |
| AC–AG | Regiões 1–5 | Número inteiro ou vazio | `regioesSelecionadas` |
| AH–AR | Documentos I–XI | `sim`, `não` ou vazio | `avaliacoesDocs[cat]` (true→sim, false→não, ausente→vazio) |
| AS | Ciclo | `'01'`–`'10'` ou vazio | `cicloAtual` (calculado por `aplicarMarcadorCiclo`) |

Regras de transformação:
* **Banco/Pix:** coluna T é sempre o literal `Santander`; coluna U é o CPF do candidato (o campo "Chave Pix" foi removido do formulário), **exceto** quando o CPF foi anulado deliberadamente com 11 zeros (`00000000000`), caso em que a coluna U fica vazia.
* **Agência/Conta:** gravadas como texto; as células V e W recebem `style="mso-number-format:'@'"` no `text/html` para o Google Sheets tratá-las como texto e não descartar zeros à esquerda.
* **Funções:** Mapeamento explícito de rótulos internos (`Ed. Básica`→`Educação Básica`, `Ed. Física`→`Educação Física`, `Artes`→`Artes`).
* **Regiões:** Número inteiro (1–5) se selecionado, vazio se não.
* **Documentos:** Valores minúsculos (`sim`/`não`) conforme validação de dados da planilha.
* **Resultado:** Minúsculo, sem acento.

### 3.6. Fluxo de Conclusão ("Concluir")

O fluxo de conclusão divide-se em duas fases separadas por uma ação do usuário.

#### Fase 1 — ao clicar em "Concluir"

Após validação bem-sucedida, o script:

1. **Aplica marcador de resultado:** se algum documento foi marcado Não em `avaliacoesDocs`, aplica o marcador **"Inabilitado"**; caso contrário, aplica **"Habilitado"**. O marcador oposto é removido.
2. **Aplica marcador de credenciadora e ciclo:** usando `trocarMarcador` e `aplicarMarcadorCiclo`.
3. **Marca como concluído e salva o progresso** (inclui flag `_deveAplicarMarcadoresResposta` para a Fase 2).
4. **Fecha o modal** de credenciamento.
5. **Clica automaticamente no botão nativo "Responder"** (`button.botao_flutuante_0.bf_v_1.btn-info[rel="1"]`).
6. **Aguarda o editor TinyMCE** carregar e clica no botão **"Inserir modelos"** (`#mceu_11-open`).
7. **Seleciona o modelo** `[CRED-CHP014] Insc. recebida` no dropdown do TinyMCE (busca por `.mce-text` contendo `[CRED-CHP014]`).
8. **Abre o Select2 de destinatários** (`#s2id_id_setor_responde .select2-choice`) e seleciona automaticamente a opção cujo texto contenha o e-mail do candidato (variável `email`).
9. **Exibe um dialog** de aviso: *"Antes de enviar a resposta padrão, verifique se o(a) candidato(a) fez mais alguma pergunta no protocolo."*

Em seguida, `aguardandoEnvioResposta` é definido como `true`. O usuário fica livre para navegar pelo protocolo e verificar as mensagens.

> **Nota:** neste ponto, os marcadores de credenciadora, ciclo, habilitado/inabilitado já foram aplicados. O marcador "Conferido" ainda não.

#### Fase 2 — ao clicar no botão nativo "Responder" (submit)

Um listener em `document.body` (capture phase) intercepta o clique em `#enviar_documento` enquanto `aguardandoEnvioResposta` for `true`:

1. **Aguarda o dialog de confirmação nativo** (`#sim`) aparecer (polling, timeout 8s).
2. **Aplica marcador "Conferido"** (se `_deveAplicarMarcadoresResposta`).
3. **Copia os dados do candidato** para o clipboard (HTML + TSV, 40 colunas).
4. **Clica em `#sim`** para confirmar o envio da resposta.
5. **Arquiva o protocolo automaticamente:** aguarda 1,5s (para o 1Doc processar o envio), clica no botão nativo "Arquivar" (`button.botao_flutuante_3.bf_v_3[title="Arquivar"]`) e confirma o dialog `#sim`. Se o botão não for encontrado, registra `console.warn` e continua.
6. **Abre/alterna para a aba da planilha** (`window.open(PLANILHA_URL, 'cred-planilha')`).

> O progresso no `localStorage` **não é apagado** após a cópia.\n>
>
> A aplicação dos marcadores usa `aplicarMarcadorResultado(nome)`, análoga a `trocarMarcador` mas sem remover marcadores de outros membros da equipe.

---

## 4. Requisitos Não-Funcionais (Como deve ser feito)

* **Persistência de Estado:** As seguintes preferências e dados são salvos no `localStorage` do navegador e mantidos entre sessões:
  | Chave | Valor padrão | Sobre |
  |---|---|---|
  | `1doc_cred_nome` | primeiro da equipe | Nome do credenciador selecionado |
  | `1doc_cred_auto` | `false` | Abrir dialog automaticamente nos protocolos |
  | `1doc_cred_marcador` | `true` | Aplicar/remover marcadores automaticamente |
  | `1doc_cred_progresso_{protocolo}` | (não existe) | JSON com estado completo do formulário por candidato. Auto-salvo via debounce (300ms). **Mantido** após cópia bem-sucedida (não é removido). TTL: 30 dias. |
* **Resiliência a SPA (Single Page Application):** O 1Doc navega entre protocolos sem recarregar a página (via AJAX). O script implementa `setInterval` para monitorar a mudança de URL. Ao detectar mudança, remove todos os elementos injetados do modal (header, info block, formulário, botão copiar), restaura o header original, limpa o atributo `data-cred-injetado` e reseta o estado do candidato.
* **Isolamento de Escopo:** O código roda em uma IIFE para não gerar conflito de variáveis globais com o sistema do 1Doc.
* **Performance:** A injeção e extração não travam a interface principal do usuário (UI Thread). O uso de `setTimeout` é necessário para dar tempo de o DOM do 1Doc ser completamente renderizado antes da extração. O AJAX do modal nativo é monitorado via `setInterval(100ms)` com timeout de segurança.
* **Sem modal custom:** O script não cria elementos de overlay ou modal próprios. Toda a UI é injetada dentro do modal nativo `#modal_aprovacao_anexos`.

## 5. Seletores DOM Específicos

| Seletor | Uso |
|---|---|
| `a.link_tabela_revisao_anexos` | Botão "Tabela" que abre o modal nativo de revisão. Script clica no primeiro encontrado. |
| `#modal_aprovacao_anexos` | Modal nativo Bootstrap 2 onde os controles são injetados. |
| `.div_lista_aprovacao_anexos` | Container dentro do modal-body onde o 1Doc carrega a tabela de documentos via AJAX. |
| `.modal-header` (dentro do modal) | Header original do modal, oculto pelo script via classe `cred-header-original-hidden`. |
| `.modal-footer .cancelar` | Botão nativo "Fechar" do modal, usado para fechar programaticamente. |
| `td.index[data-id_anexo]` | Célula de anexo na página. Contém `data-id_anexo` (ID único) e `data-id_emissao` (ID do despacho). O script compara esses IDs com os do modal para encontrar anexos extras. |

---

## Script Auxiliar — `inbox.user.js`

**Nome (`@name`):** 1Doc - Inbox (Credenciamento)
**Domínio (`@match`):** `https://pindamonhangaba.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento/inbox.user.js`
**Versão atual:** `0.6.1`

---

### Propósito

Permitir a **divisão de tela automática** no fluxo de credenciamento, com botão de acesso a um painel de controle diretamente no inbox.

O navegador só permite redimensionar e reposicionar programaticamente janelas criadas via `window.open()`. A janela principal do 1Doc, aberta pelo usuário clicando normalmente em um link, é opaca ao script — não é possível mover ou redimensionar. Por isso, este script auxiliar intercepta os cliques nas linhas do inbox e redireciona a abertura para uma janela que o script controla.

Com isso, tanto a janela do protocolo (`inbox.user.js`) quanto a janela de anexos (`credenciamento.user.js` via `window.open`) podem ser posicionadas lado a lado de forma automatizada.

### Relação com o script principal

| Script | Janela gerenciada | Posicionamento programático |
|---|---|---|
| `inbox.user.js` | Protocolo do 1Doc (metade esquerda da tela) | Sim — criada via `window.open` com `left=0` |
| `credenciamento.user.js` | Janela de anexos/PDFs (metade direita da tela) | Sim — criada via `window.open` com `left=metade` |

### Comportamento

1. **Guarda de página:** executa apenas na URL que contém `pg=painel/listar`. Retorna imediatamente em qualquer outra página.
2. **Botão no inbox:** injetado como primeiro filho de `div.span7` (barra de controles do inbox, que também contém paginação, "Mostrar" e dropdown "Com marcador"). Guard: atributo `data-cred-inbox-injetado` no próprio `div.span7`. Ao clicar, abre o modal de controle via jQuery Bootstrap 2 (`jQuery('#modal-cred-inbox').modal('show')`, executado via `<script>` injetado).
3. **Modal de controle** (`#modal-cred-inbox`): criado uma única vez no `document.body`. Header verde institucional (`#005400`). Contém dois controles persistidos em `localStorage`:
   - **Dividir tela ao abrir protocolo** (`1doc_cred_dividir`, padrão `true`): quando ativo, o protocolo abre em janela posicionada na metade esquerda; quando inativo, navega no próprio tab.
   - **Exibir chip de ciclo nas linhas** (`1doc_cred_chip_ciclo`, padrão `true`): quando desativado, oculta todos os chips `.cred-chip-ciclo` existentes no DOM via `atualizarVisibilidadeChips()`.
4. **Chip visual de ciclo (`injetarChipCiclo`):** ao processar cada linha, o script chama `verificarCicloProtocolo` imediatamente. Se houver divergência de ciclo, injeta um badge colorido imediatamente antes do `<br>` no título do protocolo (dentro de `td[data-href]`). A cor do badge é indexada pelo número do ciclo do protocolo (array `CICLO_CORES`, 10 cores: Menta → Aqua). Texto do chip: `"Ciclo XX"`. Este chip não possui interatividade — é puramente visual.
5. **Detecção de linhas:** um `MutationObserver` em `document.body` detecta novas linhas (`tr[id^="linha_"]`) inseridas via paginação. A chamada inicial `processarLinhas()` cobre linhas já presentes. Cada linha é marcada com `data-cred-inbox-ok` para evitar listeners duplicados.
6. **Interceptação de cliques e verificação de ciclo:** cada linha recebe um listener de clique. A URL de destino é extraída do atributo `data-href` da célula clicada via `e.target.closest('td[data-href]')`. Cliques em `td` sem `data-href` (checkbox, ZIP) são ignorados. Antes de abrir o protocolo, o script extrai a data de `<small class="data">` dentro da `<tr>` e chama `verificarCicloProtocolo`. Se retornar mismatch, exibe `mostrarDialogCicloErrado` e aguarda a escolha do usuário.
7. **Gerenciamento da janela (dividir tela ativo):** se a janela `cred-protocolo` já existe e não foi fechada, navega para o novo protocolo dentro dela e coloca foco; caso contrário, abre uma nova janela posicionada na metade esquerda (`width=metade, left=screen.availLeft`). A lógica de abertura é encapsulada em `abrirProtocolo(urlAbsoluta)`, reutilizada tanto no fluxo normal quanto no callback "Abrir mesmo assim" do dialog.
8. **Auto-refresh por inatividade:** após 60 segundos sem interação do usuário (mouse, teclado, clique, scroll ou toque), a página é recarregada automaticamente para evitar listas desatualizadas. O comportamento varia conforme o estado da aba:
   - **Aba em segundo plano (`document.hidden === true`):** `location.reload()` é chamado pelo `setInterval` (1s) ao atingir 60s, ou imediatamente pelo listener `visibilitychange` ao trazer a aba à frente caso o tempo já tenha sido ultrapassado.
   - **Aba em primeiro plano (visível, sem interação):** exibe um toast fixo (`#cred-inbox-toast-refresh`) no canto inferior direito com a mensagem "Página inativa há Xs — atualize para ver novos protocolos." e um botão "Atualizar" (`location.reload()`). O contador de segundos atualiza em tempo real.
   - Qualquer interação do usuário zera o contador e oculta o toast (se visível), através de `resetarAtividade()`.

### Chip Visual de Ciclo (`CICLO_CORES` + `injetarChipCiclo`)

Quando há divergência entre o ciclo do protocolo e o ciclo de análise em curso, um badge colorido é injetado imediatamente antes do `<br>` no título da linha do inbox (dentro de `td[data-href]`). A cor é determinada pelo número do ciclo do **protocolo** (não do ciclo de análise):

| Ciclo | Cor | Nome |
|---|---|---|
| 01 | `#B5EAD7` | Menta |
| 02 | `#C7CEEA` | Lavanda |
| 03 | `#FFDAC1` | Pêssego |
| 04 | `#FFB7B2` | Salmão |
| 05 | `#E2F0CB` | Sálvia |
| 06 | `#BFD7FF` | Céu |
| 07 | `#F0E6FF` | Lilá |
| 08 | `#FFF1BA` | Manteiga |
| 09 | `#FFD6E0` | Blush |
| 10 | `#C9F0FF` | Aqua |

Texto do chip: `"Ciclo XX"` com texto preto (`#000000`). Fallback de cor: `#eeeeee`. O chip é puramente informativo — sem interatividade.

### Verificação de Ciclo no Inbox (`verificarCicloProtocolo`)

A lógica de cruzamento de ciclos reside inteiramente em `inbox.user.js`, disparada **antes de abrir** qualquer protocolo.

**Tabela A — Recebimento de Inscrições (`CICLOS`)**

| Ciclo | Início | Fim |
|---|---|---|
| 01 | 25/02/2026 | 11/03/2026 |
| 02 | 12/03/2026 | 31/03/2026 |
| 03 | 01/04/2026 | 30/04/2026 |
| 04 | 01/05/2026 | 31/05/2026 |
| 05 | 01/06/2026 | 30/06/2026 |
| 06 | 01/07/2026 | 31/07/2026 |
| 07 | 01/08/2026 | 31/08/2026 |
| 08 | 01/09/2026 | 30/09/2026 |
| 09 | 01/10/2026 | 31/10/2026 |
| 10 | 01/11/2026 | 30/11/2026 |

**Tabela B — Análise dos Documentos de Habilitação (`CICLOS_ANALISE`)**

| Ciclo | Início análise | Fim análise |
|---|---|---|
| 01 | 12/03/2026 | 18/03/2026 |
| 02 | 01/04/2026 | 10/04/2026 |
| 03 | 04/05/2026 | 08/05/2026 |
| 04 | 01/06/2026 | 10/06/2026 |
| 05 | 01/07/2026 | 07/07/2026 |
| 06 | 03/08/2026 | 10/08/2026 |
| 07 | 01/09/2026 | 09/09/2026 |
| 08 | 01/10/2026 | 09/10/2026 |
| 09 | 02/11/2026 | 10/11/2026 |
| 10 | 01/12/2026 | 08/12/2026 |

**Algoritmo de `verificarCicloProtocolo(dataStr)`:**

1. Obtém data atual (zerando horas), verifica em qual ciclo de **análise** (`CICLOS_ANALISE`) ela se enquadra. Se não → `null` (fora de período de análise, sem aviso).
2. Parseia `dataStr` (ex: `"12/03/2026 14:49"`) e verifica em qual ciclo de **inscrição** (`CICLOS`) a data se enquadra. Se não → `null`.
3. Se os ciclos forem **iguais** → `null` (fluxo normal).
4. Se **diferentes** → `{ cicloProtocolo, cicloAnalise }`.

**Dialog de Aviso (`mostrarDialogCicloErrado`):**

Modal `#modal-cred-ciclo-errado` criado no `document.body` com `data-backdrop="static"` e `data-keyboard="false"`. Header vermelho (`#a94442`). Body exibe data, ciclo do protocolo e ciclo de análise atual. Footer:
- **"Cancelar"** (`btn`): fecha o dialog e permanece no inbox.
- **"Abrir mesmo assim"** (`btn-warning`): fecha o dialog e chama `abrirProtocolo(urlAbsoluta)`.

| Chip visual de ciclo (`injetarChipCiclo`) agora recebe a classe `cred-chip-ciclo` e é criado com `display:none` se `mostrarChipCiclo === false`. `atualizarVisibilidadeChips()` percorre todos os `.cred-chip-ciclo` e alterna visibilidade em tempo real.

### Chaves de localStorage

| Chave | Tipo | Padrão | Descrição |
|---|---|---|---|
| `1doc_cred_dividir` | `'true'`/`'false'` | `true` | Ativa/desativa a abertura em janela posicionada |
| `1doc_cred_chip_ciclo` | `'true'`/`'false'` | `true` | Ativa/desativa a visibilidade dos chips de ciclo |

### Seletores DOM específicos

| Seletor | Uso |
|---|---|
| `div.span7` | Container da barra de controles do inbox. Alvo da injeção do botão (primeiro filho). |
| `tr[id^="linha_"]` | Linha do inbox com ID no padrão `linha_XXXXXXX`. |
| `td[data-href]` | Célula clicável da linha (protocolo). Contém a URL relativa do protocolo no atributo `data-href`. |
| `small.data` (dentro da `tr`) | Data de envio do protocolo no inbox. Texto extraído para `verificarCicloProtocolo` e `injetarChipCiclo`. |