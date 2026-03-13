# Changelog

Todas as mudanças relevantes deste script serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

> **Regra de versionamento:** o número de versão representa o que está **publicado** (branch `main`). O progresso está em `## [Não publicado]` até o usuário disparar um lançamento. O agente de IA **nunca** altera `@version` nem promove `[Não publicado]` sem instrução explícita do usuário.

## [Não publicado]

## [0.4.0] — 2026-03-13

### Adicionado — inbox

- **Tag colorida por ciclo:** protocolos de um ciclo de inscrição diferente do que está em análise recebem automaticamente uma marcação colorida na lista do inbox, facilitando a identificação visual sem precisar abrir cada protocolo.
- **Aviso ao abrir protocolo fora do ciclo:** ao clicar em um protocolo de ciclo diferente do atual, um alerta bloqueante é exibido informando a divergência, com as opções de cancelar ou abrir mesmo assim.

### Alterado — inbox

- O Painel de Controle do inbox foi simplificado: os filtros de credenciadora atribuída e de ciclo foram removidos. A única opção disponível agora é "Dividir tela ao abrir protocolo".

### Removido — inbox

- Filtros manuais do inbox (por credenciadora atribuída e por ciclo) removidos. A organização dos protocolos passa a ser gerenciada pelo arquivamento nativo do 1Doc.

### Adicionado — credenciamento

- **Botão "Dúvida"** no rodapé do formulário: visível apenas enquanto o preenchimento está incompleto. Ao clicar, salva o progresso, aplica o marcador "Dúvida" ao protocolo e retorna ao inbox automaticamente.

### Alterado — credenciamento

- O campo RG agora aceita o CPF como documento substituto (conforme previsão legal): ao informar o CPF no campo RG, o sistema reconhece e exibe o número no formato correto.
- O botão "Dúvida" aparece ou desaparece automaticamente conforme os campos do formulário são preenchidos.
- Ao concluir o credenciamento, o protocolo é arquivado automaticamente no 1Doc, sem ação manual do credenciador. Se o arquivamento não for possível, o sistema retorna ao inbox normalmente.

## [0.3.0] — 2026-03-13

### Adicionado — inbox

- **Novo script para o inbox:** ao clicar em um protocolo na lista, ele é aberto em janela separada, posicionada na metade esquerda da tela.
- **Botão "Credenciamento" no inbox:** abre o Painel de Controle em uma janela de opções.
- **Opção "Dividir tela ao abrir protocolo":** quando ativada (padrão), o protocolo abre na metade esquerda da tela; quando desativada, abre na aba atual. A preferência é salva entre sessões.
- **Filtro por credenciadora:** oculta da lista os protocolos já atribuídos a uma credenciadora da equipe. Desativado por padrão; preferência salva entre sessões.
- **Filtro por ciclo:** oculta protocolos de ciclos diferentes do selecionado; protocolos sem marcador de ciclo permanecem visíveis. Preferência salva entre sessões.

### Adicionado — credenciamento

- **Marcador de credenciadora existente é preservado:** ao abrir o painel em um protocolo que já tem marcador de credenciadora, o sistema mantém o marcador existente. Um novo marcador só é inserido quando nenhum da equipe está presente.
- **Diálogo de confirmação ao concluir sem marcadores automáticos:** ao clicar em "Concluir e copiar" com a opção "Aplicar marcador automaticamente" desmarcada, o sistema pergunta o que fazer: aplicar os marcadores mesmo assim, concluir sem aplicar ou voltar ao formulário.

### Alterado — credenciamento

- A janela de anexos agora abre na metade direita da tela, complementando a divisão de tela com o protocolo.
- Com a opção "Aplicar marcador automaticamente" desmarcada, nenhum marcador é aplicado — inclusive o de ciclo — ao abrir o painel.

### Corrigido — credenciamento

- O campo PIS/PASEP tornou-se obrigatório: o botão de concluir só é ativado com o número completo (11 dígitos) preenchido, e o valor é salvo e restaurado corretamente entre sessões.
- O botão "Revisar" nativo do 1Doc foi ocultado em todas as categorias de anexo.

## [0.2.1] — 2026-03-12

### Adicionado

- **Campo PIS/PASEP/NIT/NIS** no formulário de dados de pagamento, à direita da Chave Pix, com máscara de formatação automática.

### Alterado

- A planilha copiada para o Google Sheets foi expandida para 40 colunas (A–AN): incluídas a coluna de Etnia (reservada para uso futuro) e a de PIS/PASEP, com reajuste de todas as colunas seguintes.

## [0.2.0] — 2026-03-12

### Adicionado

- **Marcador de ciclo automático:** ao processar um protocolo, o sistema identifica o ciclo de inscrição pela data de envio e aplica o marcador correspondente (— 01 a — 10) no 1Doc. Se o marcador correto já estiver aplicado, nada é alterado; se a data não se enquadrar em nenhum ciclo, uma advertência é registrada internamente e nenhum marcador é modificado.
- **Ciclo incluído na planilha:** o ciclo identificado é copiado como coluna adicional no Google Sheets.
- **Anexos em janela dedicada:** ao clicar em um link de anexo dentro do formulário, ele abre em uma janela separada. Cliques seguintes abrem novas abas dentro da mesma janela, permitindo alternar entre o 1Doc e os PDFs com Alt+Tab sem perder o contexto.

## [0.1.0] — 2026-03-11

Versão inicial funcional do painel de conferência de credenciamento.

### Adicionado

- **Botão de ativação** na barra de ferramentas do 1Doc, que abre o painel de revisão de documentos.
- **Abertura automática do painel** (opcional, salva entre sessões): ao entrar em um protocolo, o painel é aberto automaticamente, sem intervenção manual.
- **Cabeçalho do painel** com seleção de credenciadora (Renata, Catarina ou Alessandra) e opções de "Abrir automaticamente nos protocolos" e "Aplicar marcador automaticamente" — quando esta última está desmarcada, nenhuma ação sobre os marcadores do 1Doc é realizada.
- **Bloco de identificação** fixo no topo do painel, exibindo:
  - Número do protocolo e data/hora de envio.
  - Campo editável com o nome do candidato, pré-preenchido a partir da página.
  - Confirmação de que o nome confere com a ficha de inscrição — obrigatória antes de copiar os dados.
- **Formulário de credenciamento** com:
  - Campo CPF com máscara de formatação automática.
  - Seleção de função pretendida (múltipla): Educação Básica, Educação Física, Artes.
  - Seleção de regiões escolares (múltipla): Centro, Zona Oeste, Zona Leste, Moreira César, Zona Rural.
- **Avaliação por grupo de documentos** (grupos I–XI): botões Sim/Não para cada categoria, com destaque visual para o estado atual.
- **Destaque especial para a Ficha de Inscrição** (grupo I): exibida em seção separada, com aviso sobre a versão retificada para as regiões Leste e Moreira César.
- **Seção "Outros documentos anexos":** detecta e exibe arquivos enviados em despachos posteriores que não aparecem nas categorias do painel nativo do 1Doc.
- **Indicador de habilitação** no rodapé, atualizado em tempo real:
  - Cinza — "Em avaliação" (ao menos um grupo ainda não avaliado).
  - Verde — "Habilitado(a)" (todos os 11 grupos marcados como Sim).
  - Vermelho — "Inabilitado(a)" (ao menos um grupo marcado como Não).
- **Botão "Copiar"** com validação obrigatória antes de copiar os dados:
  1. Nome confirmado pelo credenciador.
  2. CPF com 11 dígitos.
  3. Ao menos uma função selecionada.
  4. Ao menos uma região selecionada.
  5. Todos os 11 grupos de documentos avaliados.
- **Cópia para o Google Sheets** em dois formatos simultâneos: tabela formatada com o protocolo como hiperlink, e texto simples como alternativa.
- **Marcadores automáticos no 1Doc:** ao selecionar a credenciadora, o marcador correspondente é aplicado e os das demais são removidos.
- **Preferências salvas entre sessões:** credenciadora ativa, abertura automática e aplicação de marcador.
- **Funcionamento contínuo entre protocolos:** ao navegar sem recarregar a página, o painel é reiniciado automaticamente para o novo candidato.

[Não publicado]: https://github.com/raulfranca/scripts/compare/v0.4.0...dev
[0.4.0]: https://github.com/raulfranca/scripts/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/raulfranca/scripts/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/raulfranca/scripts/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/raulfranca/scripts/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/raulfranca/scripts/releases/tag/v0.1.0
