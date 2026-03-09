# Product Requirements Document (PRD)
# Script de Credenciamento de Professores

---

## Script — `credenciamento.user.js`

**Nome (`@name`):** 1Doc - Credenciamento de Professores
**Domínio (`@match`):** `https://*.1doc.com.br/*`
**Permissões (`@grant`):** `GM_addStyle`
**Update/Download URL:** `https://raw.githubusercontent.com/raulfranca/scripts/main/1doc/credenciamento.user.js`
**Versão atual:** `2.0.0`

---

**Público-Alvo:** Equipe de triagem/credenciamento (Renata, Catarina, Alessandra)

---

## 1. Objetivo e Visão Geral

Agilizar e padronizar o processo de credenciamento de professores substitutos analisados via 1Doc. O script é um painel completo de conferência que extrai dados automaticamente da página do protocolo, aplica o marcador de responsabilidade e permite ao usuário preencher um formulário de análise (CPF, função pretendida, regiões escolares) antes de copiar as informações para a planilha de controle no Google Sheets.

## 2. Casos de Uso (User Flow)

1. O usuário abre a página de um protocolo específico no 1Doc (`pg=doc/ver`).
2. O script injeta um botão "Credenciamento" no cabeçalho, ao lado dos marcadores.
3. Se a opção "Abrir automaticamente" estiver ativada, o painel surge imediatamente. Caso contrário, o usuário clica no botão para abri-lo.
4. Ao abrir, o painel executa automaticamente a fase de extração:
   * Extrai número do protocolo, data/hora de envio e URL — exibidos no bloco de identificação (parte superior fixa).
   * Pré-preenche o campo editável "Nome do candidato" com o nome extraído da página (quem enviou o protocolo).
   * Injeta `<script>` com jQuery para aplicar o marcador do credenciador selecionado e remover marcadores dos demais membros.
   * Habilita o botão "Copiar" e coloca o foco nele.
5. O usuário confere os dados e preenche/corrige:
   * **Nome do candidato** — campo editável pré-preenchido; deve ser corrigido se o protocolo foi enviado por outra pessoa. Um aviso logo abaixo do campo alerta para essa necessidade.
   * **CPF** do candidato (campo com máscara automática `000.000.000-00`).
   * **Função pretendida** (seleção única entre Educação Básica/Física/Artes).
   * **Regiões Escolares** de interesse (múltipla seleção entre as 5 regiões do município).
6. O usuário pode trocar o credenciador no cabeçalho a qualquer momento; o marcador é atualizado imediatamente.
7. O usuário clica em "Copiar" (ou pressiona **Enter**):
   * Os dados são copiados para a área de transferência (HTML rico + TSV).
   * O painel fecha automaticamente.
   * O usuário cola manualmente na planilha do Google Sheets (Ctrl+V).

---

## 3. Requisitos Funcionais (O que o script deve fazer)

### 3.1. Interface de Usuário (UI)

* **Botão de Ativação:** Injetar um botão na barra de ferramentas do 1Doc (`.btn-group-tags`), estilizado como `.btn-info` (verde tema 1Doc).
* **Painel de Conferência:** Modal largo (`min(900px, 95vw)`, `max-height: 90vh`) com scroll interno, seguindo o design system nativo do 1Doc (Bootstrap 2, fonte Open Sans, paleta verde institucional). Estrutura em 4 zonas:

  **Cabeçalho (fixo):** header verde escuro (`#005400`, mesmo tom do `.modal-header` do 1Doc) com duas linhas:
  - *Linha 1:* título "📋 Credenciamento" | botões de credenciadora | botão fechar. Os botões de credenciadora usam estilo translúcido no fundo verde; o ativo fica em branco com texto verde escuro.
  - *Linha 2 (separada por linha tênue):* dois checkboxes brancos lado a lado:
    - **Abrir automaticamente nos protocolos** (persiste em `localStorage`; comportamento idêntico ao anterior).
    - **Aplicar marcador automaticamente** (persiste em `localStorage`; quando desmarcado, todas as chamadas a `trocarMarcador` são bypassadas).

  **Bloco de Identificação (fixo, fundo verde claro institucional):** exibe os dados extraídos automaticamente — Protocolo e Data/Hora. Valores renderizados como `—` até a extração ser concluída. Não editável.

  **Corpo do formulário:** campos preenchidos/corrigidos pelo usuário:
  * **Nome do candidato** — input texto de largura total, pré-preenchido com o nome extraído da página. Editável, pois o protocolo pode ter sido enviado por outra pessoa. Aviso de atenção exibido diretamente abaixo do campo.
  * **CPF** — input com máscara progressiva `000.000.000-00` (armazena só dígitos).
  * **Função pretendida** — 3 botões, seleção única: Educação Básica (verde institucional), Educação Física (vermelho), Artes (laranja). Botões inativos com `opacity: 0.35`; ativo com `opacity: 1` e leve escala.
  * **Regiões Escolares** — 5 botões, múltipla seleção (toggle): 1-Centro (amarelo), 2-Zona Oeste (verde institucional), 3-Zona Leste (vermelho), 4-Moreira César (verde), 5-Zona Rural (roxo).
  * Aviso destacado (fundo amarelo).
  * Checkbox "Abrir automaticamente nos protocolos".

  **Rodapé (fixo):** botão "Copiar" (largura total, verde institucional `#006600`), desabilitado durante a extração.

* **Foco:** botão "Copiar" recebe `.focus()` ao fim da extração; retorna ao botão ao sair dos controles de credenciadora.



### 3.2. Extração de Dados

O script deve ler o DOM da página do 1Doc para localizar:

* **Número do Protocolo:** Extraído do elemento `.nd_num`.
* **URL do Documento:** Capturada via `window.location.href`.
* **Nome do Candidato:** Capturado de forma resiliente do elemento `span.pp`, priorizando o atributo `data-content` ou filtrando o texto caso haja um selo de verificação (Gov.br).
* **Data e Hora de Envio:** Extraída via seletor direto `.well.well-header .row-fluid.horario > .span12 > span`. O container `.row-fluid.horario` é único na página (confirmado no DOM real). Se não encontrado, campo fica vazio e o dialog exibe "(não encontrada)".

### 3.3. Estado por Candidato (Não Persistido)

Os campos preenchidos manualmente são **descartados a cada novo protocolo** (não persistem em `localStorage`):

| Variável | Tipo | Comportamento |
|---|---|---|
| `cpfDigitos` | `string` (só dígitos) | Resetado ao reabrir o painel ou mudar de URL |
| `funcaoSelecionada` | `string \| null` | Seleção única; reset limpa `.active` de todos os botões |
| `regioesSelecionadas` | `number[]` | Múltipla seleção; reset limpa `.active` de todos |

O reset ocorre em dois momentos: na abertura do painel (`abrirDialog()`) e na detecção de mudança de URL (`setInterval`).

### 3.4. Automação de Interface (Marcadores)

* O script deve aplicar a tag (marcador) correspondente ao nome selecionado no dropdown "Credenciador(a)" usando o componente **Select2** nativo do 1Doc.
* **Toda chamada a `trocarMarcador` é condicional:** só ocorre se o checkbox "Aplicar marcador automaticamente" (`autoMarcador`) estiver ativado. Se estiver desmarcado, nenhuma modificação nos marcadores é realizada, em nenhum momento.
* Ao **mudar o credenciador** (clique em outro botão no dialog), o script deve imediatamente (se `autoMarcador` ativo):
  1. Inserir o marcador do credenciador recém-selecionado.
  2. Remover quaisquer marcadores cujo nome corresponda a outros membros da equipe (`EQUIPE`) que estejam aplicados no documento.
* A mesma lógica de troca (inserir novo + remover outros) se aplica ao fluxo completo acionado pelo botão "Copiar" (se `autoMarcador` ativo).
* A manipulação **não deve usar** simulação de cliques via JavaScript (`MouseEvent`, `.click()`, `dispatchEvent`), pois essa abordagem falha de forma consistente no Select2 do 1Doc (o marcador não é persistido).
* A **única abordagem confiável** é injetar um `<script>` que usa o jQuery nativo da página para localizar a opção pelo texto e forçar a seleção via `.val(...).trigger('change')`, conforme o snippet da `documentacao_1doc.md` seção 5.3.

### 3.5. Formatação e Área de Transferência (Clipboard)

Os dados extraídos devem ser enviados para a área de transferência em dois formatos simultâneos para garantir compatibilidade com o Google Sheets:

* **Rich Text (HTML):** Formato principal, envelopado em tags `<table><tr><td>`.
* *Coluna A:* Nome do credenciador.
* *Coluna B:* Data e Hora de envio do protocolo.
* *Coluna C:* Hiperlink contendo o número do protocolo visível apontando para a URL do 1Doc.
* *Coluna D:* Nome do candidato.


* **Plain Text (TSV):** Formato de fallback separado por tabulações (`\t`), mesma ordem de colunas.

> **Nota:** CPF, Função e Regiões ainda não são incluídos no clipboard nesta versão. Serão adicionados quando a checklist de documentos for implementada.

### 3.6. Área de Transferência — Passo Final

Após a cópia bem-sucedida para o clipboard, o painel fecha automaticamente. O usuário deve colar manualmente na planilha do Google Sheets via Ctrl+V. O formato HTML rico garante que o hiperlink na coluna C seja preservado ao colar.

---

## 4. Requisitos Não-Funcionais (Como deve ser feito)

* **Persistência de Estado:** As seguintes preferências são salvas no `localStorage` do navegador e mantidas entre sessões:
  | Chave | Valor padrão | Sobre |
  |---|---|---|
  | `1doc_cred_nome` | primeiro da equipe | Nome do credenciador selecionado |
  | `1doc_cred_auto` | `false` | Abrir dialog automaticamente nos protocolos |
  | `1doc_cred_marcador` | `true` | Aplicar/remover marcadores automaticamente |
* **Resiliência a SPA (Single Page Application):** O 1Doc navega entre protocolos sem recarregar a página (via AJAX). O script deve implementar um `setInterval` ou `MutationObserver` para monitorar a mudança de URL e resetar o estado do Dialog sempre que um novo documento for aberto.
* **Isolamento de Escopo:** O código deve rodar em uma IIFE para não gerar conflito de variáveis globais com o sistema do 1Doc.
* **Performance:** A injeção e extração não devem travar a interface principal do usuário (UI Thread). O uso de `setTimeout` é necessário para dar tempo de o DOM do 1Doc ser completamente renderizado antes da extração.