# Contexto do screendocs (para colar num projeto novo do Claude)

## Quem sou e o que é
Sou o Rubens (escrevo em português). O screendocs é uma ferramenta open source minha: um pacote npm de linha de comando que abre qualquer site, encontra as páginas sozinho (inclusive as que exigem login), tira uma foto de cada seção de cada página no computador e no celular, grava um vídeo rolando cada página, borra dados pessoais e gera um relatório HTML com descrições de cada tela.

Nasceu porque eu precisava das fotos e descrições das telas dos meus projetos (LinkVagas.AI, Rádio Braba, Lucas Moretti Personal) para o carrossel do meu portfólio (repositório RuBeNsMoTa13/Rubensmota13, Next.js na Vercel). Não achei ferramenta pronta que fizesse isso (Pageres, Reversa do professor Sandeco e Cypress não atendem), então decidi publicar para outros devs.

## Onde está
- Código: `C:\Users\Rubens\Desktop\projetinhos\screendocs`
- Ainda não tem repositório no GitHub nem publicação no npm (o nome `screendocs` estava livre no npm em 14/10/2026).
- Existe uma versão antiga chamada `documentador` em `projetinhos\documentador`, substituída pelo screendocs.
- Regra: só mexer na pasta do screendocs; não tocar nas outras pastas de projetinhos.

## Stack e decisões
- Node.js 18+, playwright-core 1.56.1 (sem baixar Chromium: usa o Chrome ou Edge instalado; só baixa o ffmpeg do Playwright na primeira gravação de vídeo), ES modules, sem build. Sem SDK de IA: descrições por `--describe claude|codex|antigravity` (ferramenta instalada, plano da pessoa), `--describe api` (qualquer API compatível com OpenAI via fetch) ou `--describe chat` (chat no navegador, guiado no terminal).
- Só npm (decidido não fazer versão Python). Uso: `npx screendocs <url>`.
- Licença MIT, README em inglês (README.md) e português (README.pt-BR.md), PUBLICAR.md com o passo a passo do npm.
- Recusei rodar isso por GitHub Actions; a ferramenta roda no meu PC.

## Como funciona (arquivos)
- `bin/screendocs.mjs`: entrada da linha de comando.
- `src/interactive.mjs`: rodando `screendocs` sem argumentos abre um menu (banner ScreenDocs, @clack/prompts 0.11.0 por suportar Node 18, pt/en pelo idioma do sistema) que monta os mesmos argumentos da linha de comando.
- `src/cli.mjs`: opções (`--max-pages 20`, `--depth 3`, `--pages`, `--exclude`, `--viewports desktop,mobile`, `--no-video`, `--out`, `--mask`, `--no-auto-mask`, `--describe claude|codex|antigravity|api|chat`, `--api-url`, `--model`, `--api-key`, `--docs`, `--lang`, `--keep`, `--open`, `--config`, `--headed`) e os comandos `screendocs login <url>` e `screendocs describe <site>` (descreve uma captura antiga).
- `src/config.mjs`: padrões + `screendocs.config.json` + opções; telas 1440x900 e 390x844.
- `src/login.mjs` + `src/browser.mjs`: login abre o Chrome instalado sem os sinais de automação (senão o Google recusa: "navegador pode não ser seguro"), salva a sessão em `.screendocs/auth/<site>.json` com `indexedDB: true` (Firebase guarda login lá) e põe `.screendocs/` no .gitignore.
- `src/discover.mjs`: percorre os links do mesmo site (busca em largura; com e sem www conta como o mesmo site, subdomínios e outros domínios ficam de fora), pula sair/logout e arquivos, ignora query string e trata `/posts/12` e `/posts/13` como uma tela só.
- `src/capture.mjs`: por página e tela, rola a página (filma), corta em seções (header/section/footer/article/main > div; se não houver, fatias da altura da tela), salva `01.jpg...`, `full.jpg`, `video.webm`.
- `src/mask.mjs`: borra (CSS blur) e-mails, telefones, CPF, CNPJ, campos de e-mail/telefone/senha preenchidos e seletores do `--mask`; vale para fotos e vídeos.
- `src/agents.mjs`: `--describe claude|codex` (roda `claude -p` / `codex exec` na pasta da captura, em lotes de 10) e `--describe api` (`--api-url`, `--model`, chave em `SCREENDOCS_API_KEY`). `--describe antigravity` roda `agy -p` e pede para também gravar a resposta num arquivo (versões antigas perdiam a saída fora do terminal). Gemini CLI descartado (login pessoal desativado pelo Google).
- `src/chat.mjs`: `--describe chat` ("Um chat no navegador"): para cada parte de `for-ai/part-N` abre a pasta, copia o `prompt.txt` e lê a resposta colada no terminal. O comando `apply` foi removido; `src/answers.mjs` encaixa as respostas e grava quem descreveu cada tela (`describedBy`).
- `prompt.md`: plano B para fazer a parte do chat por conta própria; texto neutro.
- `src/report.mjs`: `screendocs-output/<site>/index.html`, `screens.json`, `prompt.md` e `for-ai/` (fotos com nomes únicos, até 10 por parte).

## Estado em 14/10/2026
- Testado no meu portfólio (6 páginas, 39 fotos) e num painel falso (dados pessoais saíram borrados).
- Falta: eu testar no LinkVagas no meu PC (`npm install`, `npm link`, `screendocs login linkvagas.web.app`, `screendocs linkvagas.web.app`), criar o repositório público `screendocs` no GitHub, publicar no npm, e depois usar o resultado para preencher o carrossel do portfólio (PR #7 do Rubensmota13: imagens em `public/projetos/<slug>/telas` e legendas em `content/telas.json`).
- Cuidado: os painéis logados da Rádio Braba e do Lucas Moretti são de clientes e mostram dados reais; usar conta de teste ou conferir o borrão antes de publicar.

## A fazer
- Opção "incluir subdomínios" (ex.: `--subdomains`): capturar `app.meusite.com`, `blog.meusite.com` junto com `meusite.com`. Outros domínios continuam sempre de fora. Pedido em 14/10/2026.
- Testar no Windows: opção "Um chat no navegador" (pasta abrindo sozinha e texto copiado), Codex e Antigravity reais.
- Deixar o CLI multilíngue (eu faço).
- Criar o repositório no GitHub, pôr `repository`/`homepage` no package.json e publicar no npm.
- Depois: ler o `sitemap.xml` para achar páginas; carrossel do portfólio (PR #7).
