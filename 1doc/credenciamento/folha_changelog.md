# Changelog — folha.user.js

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número aqui é o `@version` **deste script** e representa o que está publicado (branch `main`). Cada script do monorepo tem changelog e numeração próprios. O progresso fica em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

## [0.2.0] — 2026-08-04 — Importa planilha XLS e localiza protocolos via hyperlinks

### Adicionado

- **Import de planilha `.xlsx` substitui o textarea de CSV colado (`renderizarModoEntrada` + nova seção "2B. LEITURA DE PLANILHA"):** o modo Entrada passa a ter um botão "📂 Importar planilha" com drop zone (clique ou arrastar-e-soltar), sem dependências externas — o `.xlsx` é lido como ZIP (`lerZip`: caminha o diretório central, resolve os cabeçalhos locais, infla via `DecompressionStream('deflate-raw')` nativo do navegador) e o XML interno via `DOMParser`. Nova função orquestradora `parsearPlanilha(file)`: localiza a linha de cabeçalho dinamicamente (primeira linha com "protocolo" e "professor" em alguma célula — não assume posição fixa), mapeia colunas por nome normalizado (`normalizarCabecalho`, remove acentos via NFD), extrai `{ nome, numero, url, registro, cpf, email, celular, pis, nascimento, assinatura, cep, logradouro, enderecoNumero, bairro, cidade, horas }` por linha, converte datas seriais do Excel (`serialParaData`) e resolve os hyperlinks da coluna Protocolo (`parseHyperlinks`, via `.rels` do sheet). **Decisão do usuário: só são importados professores com horas trabalhadas > 0** — os demais são contados e exibidos como descartados no resumo (`LS_ARQUIVO`), sem entrar na lista. Mês de referência é deduzido do nome do arquivo (`mesDoNomeArquivo`, padrão `..._AAAA-MM-DD_a_AAAA-MM-DD.xlsx` → `MES-AA`) e pré-selecionado na grade de meses, permanecendo editável. Reimport: se a competência mudar e houver progresso salvo, `confirm()` pergunta se zera ou mescla; caso contrário a lista é substituída preservando coletados/pulados.
- **Fila de trabalho baseada nos hyperlinks importados — navegação deixa de depender de encontrar o protocolo no inbox:** nova função `proximoPendente()` (primeiro item da lista com `url`, fora de `LS_COLETADOS` e da nova `LS_PULADOS`) e `abrirProtocolo()` (navega na mesma aba). Painel do inbox em modo Coleta ganha o botão "▶ Abrir próximo pendente" (mostra nome + posição `N/total`). No modal "👁 Ver lista" (`mostrarModalLista`), cada item passa a ser clicável (navega direto ao protocolo pelo `url` importado ou pela URL gravada na coleta, mesma aba) e exibe as horas trabalhadas ao lado do número do protocolo. O destaque visual das linhas no inbox (`aplicarDestaques`/`destacarLinha`) foi mantido sem alterações — continua funcionando como apoio visual em paralelo à fila.
- **Botão "⤼ Pular" e nova chave `LS_PULADOS` (`1doc_folha_pulados`):** protocolos pulados saem da fila de "próximo pendente" mas continuam contando como pendentes nas estatísticas. Badge "⤼ Pulado" no modal de lista e contagem "Pulados" nos stats do painel (só aparece quando > 0).
- **Mini-painel na página do protocolo (`criarPainelProtocolo`):** exibe nome do professor, posição na lista (`N/total`) e indicação "✓ já coletado" quando aplicável; botões "👁 Ver lista", "↩ Inbox", "⤼ Pular" e "▶ Próximo". Só é injetado quando o protocolo aberto está na lista importada. Quando o protocolo já foi coletado, o interceptador de clique no anexo continua abrindo a janela na metade direita da tela, mas não copia texto para o clipboard nem reabre o dialog "a folha foi salva?".
- **Dialog "Próximo" após o envio da resposta (`verificarAvancoPendente` + `mostrarDialogProximo`):** como o clique em "Enviar" continua manual, um listener one-shot em `#enviar_documento` (`armarListenerEnvio`) grava `LS_AVANCO` (`{ numero, ts }`) no momento do clique. `verificarAvancoPendente()` roda no dispatch de qualquer página (cobre tanto reabrir o mesmo protocolo quanto cair no inbox após o envio) e, se o registro tiver menos de 5 minutos, exibe "Próximo: Fulano (N/total)" com os botões "▶ Abrir" e "↩ Voltar ao inbox" — decisão do usuário de perguntar antes de avançar em vez de navegar automaticamente.
- **Resumo do último import (`LS_ARQUIVO`):** nome do arquivo, total de linhas com protocolo válido, quantos foram importados e quantos descartados por horas = 0; exibido no topo do modo Entrada e usado para decidir o merge no reimport.

### Alterado

- **Removido o textarea de colar CSV e a função `parsearEntrada`** (decisão do usuário: import de arquivo substitui, sem manter os dois caminhos).
- **Botão "✏️ Editar lista" renomeado para "📂 Reimportar planilha"** — mesmo handler (volta ao modo Entrada preservando coletados/pulados), rótulo alinhado ao novo fluxo de import.
- **`LS_LISTA` ganhou novos campos por registro** (`url, registro, nascimento, assinatura, cep, logradouro, enderecoNumero, bairro, horas`), todos vindos da planilha; o campo `folhaEnviada` do formato CSV antigo foi descontinuado (não existe na planilha de origem).
- **Exportar/Importar JSON (`renderizarBotoesTransferencia`) e "Limpar tudo"** passam a incluir `LS_PULADOS` e `LS_ARQUIVO`.

## [0.1.0] — 2026-06-10

### Adicionado

- **Novo script `folha.user.js`:** Painel com dois modos: **Entrada** (seletor de 12 meses em grade + textarea de protocolos + botão "Iniciar coleta") e **Coleta** (stats: Mês, Na lista, Visíveis, Já coletados, Faltam; botões "Editar lista" e "Limpar tudo"). Mês salvo em `LS_MES` (`1doc_folha_mes`). Lista em `LS_LISTA`, progresso em `LS_COLETADOS`, modo em `LS_MODO`. Destaque visual das linhas encontradas via `setProperty('background-color', ..., 'important')` nos `<td>` (sobrepõe estilos inline do 1Doc). Ao clicar em protocolo destacado na página `pg=doc/ver`: rola para o fim, copia `MÊS-AA NomeDaPessoa` para o clipboard, intercepta cliques em `a[href*="pg=doc/anexo"]` para abrir em janela metade da tela (direita), exibe dialog centralizado (backdrop `pointer-events:none`) perguntando se a folha foi salva; "Sim" registra coleta em `LS_COLETADOS` e volta ao inbox; "Não" apenas fecha o dialog. Preserva coletados ao editar lista; "Limpar tudo" zera tudo inclusive o mês.

### Alterado

- **Resposta automática ao coletar:** Após "Sim" no dialog, em vez de voltar ao inbox diretamente, o script clica no botão flutuante "Responder" (`button.bf_v_1`), aguarda o TinyMCE inicializar, insere mensagem confirmando recebimento da folha de frequência (com nome da pessoa e mês de referência) e clica em `#enviar_documento`. Só volta ao inbox após o envio (~2,5 s).
- **Formato de entrada `Nome\tProtocolo`:** Textarea agora aceita linhas separadas por tabulação (`Nome\tNúmero`). `parsearEntrada` extrai o par; `LS_LISTA` passa a armazenar `Array<{nome, numero}>` em vez de `string[]`. O nome da lista é usado no clipboard ao coletar (mais confiável que extração do DOM).
- **Botão "👁 Ver lista" no modo coleta:** Abre modal overlay com todos os protocolos da lista, exibindo nome + número e badge "✓ Coletado" / "⏳ Pendente" para cada um. Clicar fora do modal fecha-o.
- **Label textarea atualizado:** Placeholder e label refletem o novo formato `Nome\tNúmero`.

---

> **Nota de migração (2026-08-12):** até 2026-08-04 este histórico ficava em um `changelog.md` único da pasta, compartilhado por todos os scripts, sob os números de release **da pasta** (`0.6.1` e `0.7.0`). As entradas acima foram renumeradas para a linha SemVer **do próprio script**: a estreia (2026-06-10) é `0.1.0` — como o próprio texto original já indicava — e o import de planilha (2026-08-04) é `0.2.0`. O `@version` do script ficou em `0.1.0` por lapso durante o release `0.7.0` da pasta e foi corrigido para `0.2.0` nesta migração, sem alteração de comportamento.
