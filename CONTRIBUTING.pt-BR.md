# Rodando o screendocs pelo código

Este guia é para quem baixa o código do GitHub para rodar, mudar ou mandar uma correção. Para só usar o screendocs, nada disto é necessário: basta `npx screendocs`, e o [README](README.pt-BR.md) explica tudo.

[English](CONTRIBUTING.md)

## Rodar

Precisa do Node.js 18 ou mais novo e do Chrome ou Edge instalado.

```bash
git clone https://github.com/RuBeNsMoTa13/screendocs.git
cd screendocs
npm install
node bin/screendocs.mjs https://seu-site.com
```

Para digitar `screendocs` em qualquer pasta, como se tivesse vindo do npm, rode `npm link` uma vez dentro da pasta do código. Depois disso, toda mudança no código já vale na hora. `npm unlink -g screendocs` desfaz.

Defina `SCREENDOCS_DEBUG=1` para ver o erro completo quando algo falhar.

## O que muda rodando pelo código

Nada no comportamento: ele lê e grava as mesmas coisas que o pacote do npm. A diferença é onde você está quando roda.

- **Na pasta onde você roda o comando**, ele cria `screendocs-output/` (as capturas) e, quando você faz login num site, `.screendocs/auth/` (a sessão) e uma linha para ela no `.gitignore`. Se você roda dentro da pasta do código, isso aparece no repositório. O `.gitignore` do repositório já deixa de fora `screendocs-output/`, `.screendocs/` e `dist/`, então nada disso vai para o commit.
- **Na sua pasta de usuário**, `~/.screendocs/` guarda os seus padrões (`config.json`) e, quando não existe cofre de senhas do sistema, as chaves de API salvas (`keys.json`). É a mesma pasta que o pacote do npm usa, então um teste pelo código muda os seus padrões de verdade. Para testar sem mexer neles, aponte para outro lugar:

```bash
SCREENDOCS_HOME=/tmp/sd-teste node bin/screendocs.mjs config
```

## De onde vem cada opção

Cada camada substitui a de baixo (`loadConfig` em `src/config.mjs`):

1. `DEFAULTS` em `src/config.mjs`: os valores de fábrica. Mude aqui para mudar o que todo mundo recebe.
2. Os padrões do usuário, `~/.screendocs/config.json`, gravados pelo `screendocs config` (`src/userconfig.mjs`, `src/configcmd.mjs`).
3. O `screendocs.config.json` da pasta onde roda, ou o arquivo passado com `--config`.
4. As opções digitadas no comando.

`describe` e `model` dizem os dois quem escreve as descrições, então uma camada que define um apaga o outro das camadas de baixo.

## Onde fica cada coisa no código

| Arquivo | O que faz |
|---|---|
| `bin/screendocs.mjs` | ponto de entrada; chama `run()` |
| `src/cli.mjs` | lê o comando, o `--help` nos três idiomas, roda a captura |
| `src/interactive.mjs` | o menu (`npx screendocs` sem link); cada pergunta é um passo, `Esc` volta |
| `src/hud.mjs`, `src/theme.mjs` | a aparência do menu: dicas de teclas embaixo de cada pergunta e as cores |
| `src/config.mjs` | valores de fábrica e a ordem das camadas |
| `src/userconfig.mjs`, `src/configcmd.mjs` | os padrões do usuário e o `screendocs config` |
| `src/i18n.mjs` | idioma do terminal (`SCREENDOCS_LANGUAGE`, escolha salva, idioma do computador) |
| `src/checkurl.mjs` | confere se o endereço abre e sugere correções |
| `src/discover.mjs` | encontra as páginas seguindo os links |
| `src/browser.mjs`, `src/capture.mjs`, `src/mask.mjs` | abre o Chrome ou Edge, tira as fotos e vídeos, borra dados pessoais |
| `src/login.mjs`, `src/session.mjs`, `src/paths.mjs` | login nos sites e a sessão salva |
| `src/report.mjs` | `screens.json`, `prompt.md`, o relatório HTML e o `for-ai/` |
| `src/agents.mjs`, `src/chat.mjs`, `src/providers.mjs` | descrições por uma ferramenta de IA instalada, um chat no navegador ou uma API |
| `src/answers.mjs` | acha uma captura antiga e coloca nela as respostas da IA (`screendocs describe`) |
| `src/secrets.mjs` | chaves salvas: Keychain, Windows (DPAPI), `secret-tool` ou `keys.json` |
| `src/docs.mjs` | lê o `--docs` (texto, PDF, Office) para a IA |
| `src/mcp.mjs` | o servidor MCP (`screendocs mcp`) |
| `scripts/build-mcpb.mjs`, `mcpb/` | o instalador do Claude Desktop (`npm run build:mcpb`) |

Todo texto que o usuário vê está escrito em inglês, português e espanhol, junto do código que o mostra. Ao criar ou mudar um, escreva os três.

## Mandar uma mudança

1. Crie uma branch, faça a mudança e teste com `node bin/screendocs.mjs` num site de verdade.
2. Se mudar uma opção, uma pergunta do menu ou o que aparece no terminal, atualize também o `README.md` e o `README.pt-BR.md`.
3. Abra um pull request dizendo o que estava errado antes e o que acontece agora.

A publicação no npm está em [PUBLICAR.md](PUBLICAR.md).
