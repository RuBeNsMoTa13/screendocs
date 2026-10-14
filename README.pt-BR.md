# screendocs

Aponte para um site e receba todas as telas documentadas: uma foto de cada seção de cada página, no computador e no celular, um vídeo rolando a página, uma descrição curta do que cada tela faz e um relatório HTML para abrir ou compartilhar. Páginas que exigem login entram também: você faz login uma vez e o screendocs reaproveita a sessão.

Funciona com qualquer site, em qualquer stack. Nada é instalado no projeto documentado.

[English](README.md)

## Começo rápido

```bash
npx screendocs
```

Sem argumentos, ele abre um menu interativo que pergunta o site e as opções (login, computador/celular, vídeo, quais páginas) e mostra no fim o comando equivalente. Ou passe tudo de uma vez:

```bash
npx screendocs https://seu-site.com
```

Ele usa o Chrome ou o Edge já instalado no seu computador; nenhum navegador é baixado. O resultado fica em `screendocs-output/<site>/`; abra o `index.html`.

## Páginas com login

```bash
npx screendocs login https://seu-site.com
```

Abre uma janela do navegador. Faça login normalmente (login com Google funciona), volte ao terminal e aperte Enter. A sessão fica salva em `.screendocs/auth/` e as próximas execuções nesse site usam ela, então as páginas que ele encontra depois do login também são fotografadas.

Antes de cada captura ele abre a página em que você estava quando fez login; se o site mandar para outro lugar ou pedir senha, ele avisa que o login expirou (o menu oferece fazer login de novo).

A pasta `.screendocs/` dá acesso à sua conta. Ela entra no `.gitignore` automaticamente; nunca faça commit nem compartilhe.

## O que ele faz

- **Confere o endereço** antes de começar: se o site não abrir, sugere o que pode estar faltando (`www.`, `.br`, um erro de digitação) e mostra exemplos, como `meusite.com.br`, `www.meusite.com` ou `app.meusite.com/login`.
- **Acha as páginas sozinho**: segue os links do próprio site a partir da página inicial, pula links de sair/logout e arquivos, e trata `/posts/12` e `/posts/13` como uma tela só.
- **Uma imagem por seção**: `<header>`, `<section>`, `<footer>` e blocos parecidos; páginas sem isso são cortadas em fatias do tamanho da tela. Também tira a página inteira.
- **Computador e celular** (1440×900 e 390×844).
- **Vídeo** de cada página rolando.
- **Esconde dados pessoais**: e-mails, telefones, CPF/CNPJ e campos de e-mail/telefone/senha preenchidos ficam borrados nas fotos e nos vídeos. Adicione seus próprios seletores com `--mask`.
- **Descrições**: por padrão, o título e o primeiro parágrafo de cada seção. Uma IA pode olhar cada foto e escrever um título e uma descrição: veja [Descrições com qualquer IA](#descrições-com-qualquer-ia).
- **Relatório**: `index.html` com todas as páginas, as duas telas e os vídeos, mais o `screens.json` para usar em scripts.

## Opções

| Opção | Padrão | |
|---|---|---|
| `--max-pages <n>` | 20 | quantas páginas procurar |
| `--depth <n>` | 3 | profundidade de links a partir da inicial |
| `--pages /a,/b` | | fotografa exatamente esses caminhos em vez de procurar |
| `--exclude a,b` | | pula URLs que contêm esses textos |
| `--viewports <lista>` | `desktop,mobile` | `desktop` (computador), `mobile` (celular) ou os dois |
| `--no-video` | | sem vídeos |
| `--out <pasta>` | `screendocs-output` | pasta de saída |
| `--keep` | | guarda a captura anterior do site (renomeada com a data) em vez de substituir |
| `--mask <seletores>` | | seletores CSS extras para borrar |
| `--no-auto-mask` | | não borra e-mails, telefones, documentos |
| `--describe <como>` | | quem escreve as descrições: `claude`, `codex`, `antigravity`, `api` ou `chat` (veja abaixo) |
| `--api-url <url>` | | endereço da API compatível com OpenAI, para `--describe api` |
| `--model <id>` | | modelo para `--describe api` (um que leia imagens) |
| `--api-key <chave>` | | chave para `--describe api` (prefira `SCREENDOCS_API_KEY`) |
| `--docs <pasta>` | | documentação em Markdown que a IA lê para descrever |
| `--lang <código>` | `en` | idioma das descrições (`pt`, `es`...) |
| `--config <arquivo>` | `screendocs.config.json` | arquivo de configuração (veja abaixo) |
| `--headed` | | mostra o navegador |
| `--no-url-check` | | não confere se o endereço abre (sites que só abrem na sua rede ou VPN) |
| `--open` | | abre o relatório no fim (o menu sempre abre) |
| `-v`, `--version` | | mostra a versão |
| `-h`, `--help` | | mostra a ajuda |

Variáveis de ambiente:

| Variável | |
|---|---|
| `SCREENDOCS_API_KEY` | chave da API para `--describe api` |
| `CHROMIUM_PATH` | usa outro navegador baseado em Chromium no lugar do Chrome ou Edge |
| `SCREENDOCS_DEBUG` | defina como `1` para ver o erro completo |

## Arquivo de configuração

Crie um `screendocs.config.json` na pasta onde roda o comando e deixe as opções nele:

```json
{
  "maxPages": 30,
  "exclude": ["/admin", "/blog/"],
  "viewports": ["desktop", "mobile"],
  "mask": [".nome-cliente", "#saldo"],
  "describe": "claude",
  "docs": "./docs",
  "lang": "pt"
}
```

## Resultado

```
screendocs-output/seu-site.com/
  index.html          relatório
  screens.json        todas as páginas e telas com título e descrição
  prompt.md           como descrever as telas com um chat de IA por conta própria
  for-ai/part-1/...   as telas a descrever, com nomes únicos, e o texto para a IA
  desktop/<pagina>/01.jpg, 02.jpg ... full.jpg, video.webm
  mobile/<pagina>/...
```

## Descrições com qualquer IA

Escolha quem escreve as descrições no menu ("Quem escreve as descrições das telas?") ou com `--describe`. Para descrever uma captura que você já fez, sem capturar de novo:

```bash
npx screendocs describe seu-site.com.br
```

Os títulos e descrições vão para o `screens.json` e o `index.html`, e as telas do celular reaproveitam a descrição da mesma seção no computador. O relatório marca em cada tela quem a descreveu (por exemplo "Claude Code" ou "AI chat"), ou "page text" quando nenhuma IA descreveu, e o terminal lista as telas que ficaram de fora. Use `--lang pt` (ou o menu) para descrições em português.

> A IA precisa **ler imagens**: ela olha cada captura para escrever a descrição. Um modelo que só lê texto não consegue.

**1. Um chat no navegador (sem chave, sem instalar nada).** Escolha "Um chat no navegador (ChatGPT, Gemini, Claude.ai...)" ou use `--describe chat`. O screendocs guia você: abre uma pasta com as imagens (até 10 por parte, com nomes únicos) e copia o texto para a IA; você arrasta as imagens para o chat, cola o texto e cola a resposta da IA de volta no terminal. Ele confere a resposta e pede de novo se não vier certa. O `prompt.md` explica como fazer a parte do chat por conta própria.

**2. Uma ferramenta de IA no seu computador (usa o seu plano, sem chave de API).** Se o [Claude Code](https://code.claude.com), o [Codex](https://developers.openai.com/codex) ou o [Antigravity CLI](https://antigravity.google) (`agy`, use uma versão recente) estiver instalado e com login feito, o screendocs roda ele para você:

```bash
npx screendocs https://seu-site.com.br --describe claude   # ou codex, antigravity
```

**3. Qualquer API (para devs).** Funciona com qualquer provedor que tenha API compatível com OpenAI, chamada direto, sem instalar SDK:

```bash
export SCREENDOCS_API_KEY=...        # PowerShell: $env:SCREENDOCS_API_KEY="..."
npx screendocs https://seu-site.com.br --describe api --api-url https://api.openai.com/v1 --model <modelo>
```

| Provedor | `--api-url` |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Ollama (local, grátis, sem chave) | `http://localhost:11434/v1` |

Escolha um modelo que leia imagens (ex.: `gpt-4o-mini`, `gemini-2.5-flash`, `llama3.2-vision`); se escolher um que não lê, o screendocs avisa. O menu pergunta tudo isso e nunca mostra a chave.

## Usar por uma IA (MCP)

`screendocs mcp` transforma o screendocs em ferramentas para clientes de IA que falam [MCP](https://modelcontextprotocol.io) (Claude Code, Cursor, VS Code, Claude Desktop, Codex...). Você pede com suas palavras, por exemplo *"documente as telas de meusite.com.br em português"*, e a IA captura o site, olha cada foto e escreve as descrições ela mesma, pelo seu plano, sem chave de API.

**Claude Desktop (um clique).** Baixe o [screendocs.mcpb](https://github.com/RuBeNsMoTa13/screendocs/releases/latest/download/screendocs.mcpb) e abra: o Claude Desktop mostra um botão Instalar e pergunta em qual pasta ficam as capturas. Não precisa instalar mais nada; o Claude Desktop traz o próprio Node.js.

**Claude Code**

```bash
claude mcp add screendocs -- npx -y screendocs mcp
# Windows:
claude mcp add screendocs -- cmd /c npx -y screendocs mcp
```

Com `--scope user` ele fica disponível em todos os projetos. Confira com `/mcp` dentro do Claude Code.

**Cursor** (`.cursor/mcp.json`), Claude Desktop sem o instalador (`claude_desktop_config.json`) e a maioria dos outros clientes:

```json
{
  "mcpServers": {
    "screendocs": { "command": "npx", "args": ["-y", "screendocs", "mcp", "--dir", "C:/Users/voce/screendocs"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`): o mesmo, dentro de `"servers"` e com `"type": "stdio"`. **Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.screendocs]
command = "npx"
args = ["-y", "screendocs", "mcp"]
```

As capturas e os logins salvos ficam na pasta em que o cliente inicia o servidor (no Claude Code e no Cursor, o seu projeto). `--dir <pasta>` escolhe essa pasta, o que vale a pena no Claude Desktop, onde ela não é sua (o instalador pergunta). Para usar uma cópia do screendocs que não está no npm, troque `npx -y screendocs` por `node <caminho>/bin/screendocs.mjs`.

| Ferramenta | O que faz |
|---|---|
| `capture_site` | Captura um site (mesmas opções da linha de comando: `pages`, `exclude`, `viewports`, `maxPages`, `depth`, `video`, `keep`, `mask`, `lang`...) |
| `list_captures` | Os sites já capturados |
| `get_capture` | As telas de uma captura, com o caminho de cada imagem e a descrição atual |
| `view_screens` | Mostra até 10 fotos para a IA |
| `save_descriptions` | Salva títulos e descrições no `screens.json` e no relatório, marcados com o nome da IA |
| `login`, `save_login` | Abre uma janela do navegador para você fazer login e depois salva a sessão para as próximas capturas |

Uma captura leva de um a vários minutos; com `video: false` é mais rápida.

> **Quais IAs funcionam.** Qualquer app que roda servidores MCP no seu computador: Claude Desktop, Claude Code, Cursor, VS Code (Copilot), Windsurf, Codex, Gemini CLI, Cline, LM Studio e outros. Chats de IA que rodam só no navegador (ChatGPT, Claude.ai, Gemini na web) não conseguem abrir um programa no seu computador, então não funcionam. O modelo também precisa **ler imagens**: ele olha cada foto para descrevê-la. Um modelo só de texto consegue capturar o site, mas não descrever as telas.

## Dados reais

Áreas logadas costumam mostrar dados de pessoas reais. O borrão automático cobre os casos comuns, não todos: use uma conta de teste quando puder e confira as imagens antes de publicar.

## Requisitos

Node.js 18 ou mais novo. Google Chrome ou Microsoft Edge instalado (o Edge já vem no Windows). Para usar outro navegador baseado em Chromium, aponte `CHROMIUM_PATH` para o executável dele.

## Licença

MIT
