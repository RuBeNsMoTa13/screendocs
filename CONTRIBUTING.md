# Running screendocs from the code

This guide is for whoever downloads the code from GitHub to run it, change it or send a fix. To just use screendocs, you do not need any of this: `npx screendocs` is enough, and the [README](README.md) explains everything.

[Português](CONTRIBUTING.pt-BR.md) · [Español](CONTRIBUTING.es.md)

## Run it

You need Node.js 18 or newer and Chrome or Edge installed.

```bash
git clone https://github.com/RuBeNsMoTa13/screendocs.git
cd screendocs
npm install
node bin/screendocs.mjs https://your-site.com
```

To type `screendocs` in any folder, as if it had come from npm, run `npm link` once inside the code folder. After that, every change in the code is used right away. `npm unlink -g screendocs` undoes it.

Set `SCREENDOCS_DEBUG=1` to see the full error when something fails.

## What changes when it runs from the code

Nothing in the behavior: it reads and writes the same things as the npm package. The difference is where you are when you run it.

- **In the folder where you run the command**, it creates only `screendocs-output/` (the captures). If you run it inside the code folder, it shows up in the repository; the repository's `.gitignore` already leaves it out, along with `dist/`.
- **In your user folder**, `~/.screendocs/` keeps your defaults (`config.json`), the site logins (`auth/`) and, when there is no system password store, the saved API keys (`keys.json`). Temporary files, like the video encoder check, go to the system's temp folder. It is the same folder the npm package uses, so a test from the code changes your real defaults. To test without touching them, point it somewhere else:

```bash
SCREENDOCS_HOME=/tmp/sd-test node bin/screendocs.mjs config
```

## Where each option comes from

Each layer replaces the one below it (`loadConfig` in `src/config.mjs`):

1. `DEFAULTS` in `src/config.mjs`: the factory values. Change them here to change what everybody gets.
2. The user's defaults, `~/.screendocs/config.json`, written by `screendocs config` (`src/userconfig.mjs`, `src/configcmd.mjs`).
3. `screendocs.config.json` in the folder where it runs, or the file given with `--config`.
4. The options typed on the command.

`describe` and `model` both say who writes the descriptions, so a layer that names one clears the other from the layers below.

## Where things are in the code

| File | What it does |
|---|---|
| `bin/screendocs.mjs` | entry point; calls `run()` |
| `src/cli.mjs` | parses the command, `--help` in the three languages, runs the capture |
| `src/interactive.mjs` | the menu (`npx screendocs` with no link); each question is a step, `Esc` goes back |
| `src/hud.mjs`, `src/theme.mjs` | the look of the menu: key hints under each question and the colors |
| `src/config.mjs` | factory values and the order of the layers |
| `src/userconfig.mjs`, `src/configcmd.mjs` | the user's defaults and `screendocs config` |
| `src/i18n.mjs` | language of the terminal (`SCREENDOCS_LANGUAGE`, saved choice, computer's language) |
| `src/checkurl.mjs` | checks that the address opens and suggests fixes |
| `src/discover.mjs` | finds the pages by following links |
| `src/browser.mjs`, `src/capture.mjs`, `src/mask.mjs` | opens Chrome or Edge, takes the screenshots and videos, blurs personal data |
| `src/login.mjs`, `src/session.mjs`, `src/paths.mjs` | site login and its saved session |
| `src/report.mjs` | `screens.json`, `prompt.md`, the HTML report and `for-ai/` |
| `src/agents.mjs`, `src/chat.mjs`, `src/providers.mjs` | descriptions by an installed AI tool, a browser chat or an API |
| `src/answers.mjs` | finds an old capture and puts the AI's answers into it (`screendocs describe`) |
| `src/secrets.mjs` | saved keys: Keychain, Windows (DPAPI), `secret-tool`, or `keys.json` |
| `src/docs.mjs` | reads `--docs` (text, PDF, Office) for the AI |
| `src/mcp.mjs` | the MCP server (`screendocs mcp`) |
| `scripts/build-mcpb.mjs`, `mcpb/` | the Claude Desktop installer (`npm run build:mcpb`) |

Every text the user sees is written in English, Portuguese and Spanish next to the code that shows it. When you add or change one, write the three.

## The visual manual

`docs/manual.html` is the visual manual, one page in English, Portuguese and Spanish. The images in the READMEs are pieces of it, in `docs/images/<language>/`. After changing the manual, run `npm run manual:images` to take them again (it uses your Chrome or Edge). Neither goes into the npm package.

## Sending a change

1. Create a branch, make the change and try it with `node bin/screendocs.mjs` on a real site.
2. If it changes an option, a question of the menu or what the terminal shows, update `README.md`, `README.pt-BR.md`, `README.es.md` and `docs/manual.html` too.
3. Open a pull request saying what was wrong before and what happens now.

Publishing to npm is in [PUBLICAR.md](PUBLICAR.md).
