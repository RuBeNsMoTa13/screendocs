# screendocs

Point it at a website and get every screen documented: a screenshot of each section of each page, on desktop and mobile, a video scrolling through it, a short description of what each screen does, and an HTML report you can open or share. Pages behind a login are included: you log in once, screendocs reuses the session.

Works with any site, in any stack. Nothing is installed in the project being documented.

[Português](https://github.com/RuBeNsMoTa13/screendocs/blob/main/README.pt-BR.md) · [Español](https://github.com/RuBeNsMoTa13/screendocs/blob/main/README.es.md)

> **This README is for people who use screendocs from npm** (`npx screendocs`): how to use it, with nothing to download or build. To run it from the GitHub code, change it or send a fix, see the [developer guide](https://github.com/RuBeNsMoTa13/screendocs/blob/main/CONTRIBUTING.md).

## Quick start

**User manual (npm):** the images below come from [docs/user-manual.html](https://github.com/RuBeNsMoTa13/screendocs/blob/main/docs/user-manual.html), a one-page manual in English, Portuguese and Spanish. Download it and open it in your browser to see everything, including every flag.

![Two ways to use it](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/ways.png)

<details>
<summary>The menu, step by step</summary>

![The menu: language, site and address check](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/menu-start.png)

![The menu: review, start and the capture](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/menu-run.png)

</details>

```bash
npx screendocs
```

With no arguments it opens an interactive menu that asks for the site and the options (login, desktop/mobile, video, which pages) and shows the equivalent command at the end. Under each question, a line shows what each key does: arrows to choose, `Enter` confirms, `Esc` goes back to the previous question and `Ctrl+C` quits. Or pass everything at once:

```bash
npx screendocs https://your-site.com
```

It uses the Chrome or Edge already installed on your computer; no browser is downloaded. Output goes to `screendocs-output/<site>/`; open `index.html`.

## What runs by default

With just the link (`npx screendocs mysite.com`), it asks nothing and uses the defaults:

| What | Default | To change |
|---|---|---|
| Address | checks that it opens before starting and suggests fixes | `--no-url-check` |
| Login | uses the site's saved login, if there is one (`screendocs login`), and warns when it has expired | `npx screendocs login <site>` |
| Pages | follows links from the start page, up to 20 pages and 3 clicks away | `--max-pages`, `--depth`, `--exclude`, `--pages` |
| Screens | desktop and mobile | `--viewports desktop` or `--viewports mobile` |
| Images | one per section, plus the full page | |
| Video | one scrolling each page | `--no-video` |
| Personal data | blurs emails, phones, documents, card numbers and filled form fields, and leaves them out of the saved text | `--mask`, `--no-auto-mask` |
| Descriptions | no AI: each screen keeps the page's own text (title and first paragraph) | `--describe`, or later `npx screendocs describe <site>` |
| Description language | the language of screendocs (asked on the first run) | `--lang pt` |
| Folder | `screendocs-output/<site>/` inside the folder where you run the command (the terminal shows the full path at the start), replacing the previous capture of the same site | `--out`, `--keep` |
| Browser | hidden | `--headed` |
| Report | not opened; the terminal shows the path to `index.html` | `--open` |

There are four ways to change the defaults:

1. **On the command**, for that run only: `npx screendocs mysite.com --no-video --describe chat --lang pt --open`. Every option is in [Options](#options) and in `npx screendocs --help`.
2. **With `npx screendocs config`**, your own defaults, in every folder. See [Your defaults and language](#your-defaults-and-language).
3. **In a `screendocs.config.json` file** (optional), in the folder where you run the command, to apply only there. See [Config file](#config-file).
4. **With the menu** (`npx screendocs` with no link): it asks about each thing, starting from your defaults, and shows the equivalent command at the end, to repeat later without the questions.

When more than one sets the same option, think of layers, each one on top of the one below. The higher one wins:

1. **screendocs' own defaults** (bottom): what comes in the package, like up to 20 pages.
2. **Your defaults**, saved with `npx screendocs config`: they apply in every folder.
3. **A `screendocs.config.json` in the folder** (optional): applies only in that folder.
4. **The command** (top): what you type now, for this run only.

For example, with the number of pages: screendocs says 20. You saved 40 with `npx screendocs config`, so it uses 40 everywhere. The folder `client-x` has a `screendocs.config.json` that says 10, so there it uses 10. Typing `--max-pages 5` in that folder uses 5, this time only.

Most people only need layers 2 and 4: save what you always want with `npx screendocs config`, and change one run with an option on the command.

![What wins: the four layers](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/layers.png)

## Pages behind a login

```bash
npx screendocs login https://your-site.com
```

A browser window opens. Log in as usual (Google login works), go back to the terminal and press Enter. The session is saved in your user folder, next to your defaults, and every later run on that site uses it, so the pages it finds after login are captured too.

Before each run it opens the page you were on when you logged in; if the site sends it elsewhere or asks for a password, it warns that the login has expired (the menu offers to log in again).

Because it is saved in your user folder, the login works from any folder where you run screendocs. The saved session gives access to your account, so only your user can read it. To log out of a site, run `npx screendocs login` again or log out on the site itself.

## What it does

![How the site is mapped](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/mapping-steps.png)

<details>
<summary>How the pages and sections are found</summary>

![Finding the pages](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/mapping-pages.png)

![Cutting each page into sections](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/mapping-sections.png)

</details>

- **Checks the address** before starting: if the site does not open, it tries close addresses (with or without `www.`, other endings like `.com`, `.com.br`, `.net`, `.org`, `.io`, `.app`, `.dev`, typos like `.con`) and suggests the ones that open, with examples like `mysite.com`, `mysite.io` or `app.mysite.dev/login`.
- **Finds the pages by itself**: follows the site's own links from the start page, skips logout links and files, and treats `/posts/12` and `/posts/13` as one screen.
- **One image per section**: `<header>`, `<section>`, `<footer>` and similar blocks; pages without them are cut into screen-sized slices. Also a full-page image.
- **Desktop and mobile** (1440×900 and 390×844).
- **Video** of each page being scrolled.
- **Hides personal data**: blurred in screenshots and videos, and replaced by `•••` in the text saved with the capture (`screens.json`, the report and the text sent to an AI):
  - emails, card numbers (checked with their check digit) and phone numbers in Brazilian, US, Spanish and international (`+code`) formats;
  - documents: CPF and CNPJ (Brazil, with or without punctuation), SSN (US), DNI and NIE (Spain), DNI (Argentina), CURP and RFC (Mexico), IBAN;
  - filled email, phone and password fields, and any field holding one of the above.

  Add your own CSS selectors with `--mask` (also left out of the saved text). Names and free text are not detected: use a test account when you can.
- **Descriptions**: by default, the heading and first paragraph of each section. An AI can look at each screenshot and write a title and a description: see [Descriptions with any AI](#descriptions-with-any-ai).
- **Report**: `index.html` with every page, both viewports and the videos, plus `screens.json` for scripts.

## Options

| Option | Default | |
|---|---|---|
| `--max-pages <n>` | 20 | pages to discover |
| `--depth <n>` | 3 | link depth from the start page |
| `--pages /a,/b` | | capture exactly these paths instead of discovering |
| `--exclude a,b` | | skip URLs containing these texts |
| `--viewports <list>` | `desktop,mobile` | `desktop`, `mobile` or both |
| `--no-video` | | skip videos |
| `--out <dir>` | `screendocs-output` | output folder |
| `--keep` | | keep the previous capture of the site (renamed with its date) instead of replacing it |
| `--mask <selectors>` | | extra CSS selectors to blur |
| `--no-auto-mask` | | don't blur emails, phones, documents |
| `--describe <how>` | | who writes the descriptions: `claude`, `codex`, `antigravity` or `chat` (see below). `none`: no AI this time only, for when your defaults name an AI and you run straight from the command (in the menu, pick "Just the page scan for now") |
| `--model <provider/model>` | | describe with an API (e.g. `gemini/gemini-2.5-flash`, `ollama/llama3.2-vision`; see below) |
| `--instructions <text>` | | what else the descriptions should take into account, e.g. `"focus on what the customer gains"` |
| `--docs <path>` | | the project's documentation for the AI to read: a folder or one file (see [Extra request and documentation](#extra-request-and-documentation)) |
| `--lang <code>` | the language of screendocs | description language (`pt`, `en`, `es`...) |
| `--config <file>` | `screendocs.config.json` | config file (see below) |
| `--headed` | | show the browser |
| `--no-url-check` | | skip checking that the address opens (sites only reachable on your network or VPN) |
| `--open` | | open the report when done (the menu always does) |
| `-v`, `--version` | | show the version |
| `-h`, `--help` | | show the help |

Environment variables:

| Variable | |
|---|---|
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | the provider's key for `--model` |
| `SCREENDOCS_API_KEY` | a key for `--model`, whatever the provider |
| `OPENAI_BASE_URL` | another OpenAI-compatible server, with `--model openai/<model>` |
| `OLLAMA_HOST` | where Ollama runs, when it is not `localhost:11434` |
| `CHROMIUM_PATH` | use another Chromium-based browser instead of Chrome or Edge |
| `SCREENDOCS_DEBUG` | set to `1` to print the full error |
| `SCREENDOCS_LANGUAGE` | the language of screendocs for this run: `en`, `pt` or `es` |
| `SCREENDOCS_HOME` | another folder for your defaults and saved keys (default `~/.screendocs`) |

## Your defaults and language

screendocs talks in English, Portuguese or Spanish. The first time it runs in a terminal it asks which one (the computer's language comes selected) and saves the answer.

Your defaults are saved on your computer, in your user folder (`npx screendocs config path` shows where), not in the folder where you run the command. They apply in every folder and stay when screendocs is updated. An option typed on the command, or a `screendocs.config.json` in the folder, still wins over them.

```bash
npx screendocs config                         # menu: pick a setting, change it, Done
npx screendocs config list                    # what is saved
npx screendocs config set language es         # en, pt or es
npx screendocs config set max-pages 30
npx screendocs config set viewports desktop
npx screendocs config set video false
npx screendocs config set describe claude     # or: config set model gemini/gemini-2.5-flash
npx screendocs config unset video             # back to the default
npx screendocs config reset                   # erase everything (the language is asked again)
npx screendocs config path                    # where the file is
```

The settings are the same names as in `screendocs.config.json` (`maxPages` or `max-pages` both work), plus `language`.

## Config file

Optional, for when one project needs options different from your defaults. Create a file named `screendocs.config.json` in the folder where you run the command for that project, with the options it needs. They apply every time you run screendocs in that folder, and an option typed on the command still wins over the file. Nobody needs to create it: without it, your defaults apply.

```json
{
  "maxPages": 30,
  "exclude": ["/admin", "/blog/"],
  "viewports": ["desktop", "mobile"],
  "mask": [".customer-name", "#balance"],
  "describe": "claude",
  "docs": "./docs",
  "instructions": "focus on what the customer gains on each screen",
  "lang": "pt"
}
```

## Output

![What you get](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/output.png)

```
screendocs-output/your-site.com/
  index.html          report
  index-original.html the report as captured, before any AI description (never rewritten)
  screens.json        every page and screen with title and description
  screens-original.json  the same, as captured
  prompt.md           how to describe the screens with an AI chat on your own
  docs-for-ai.md      the text taken from the documentation (only with --docs)
  for-ai/part-1/...   the screens to describe, with unique names, plus the text for the AI
  desktop/<page>/01.jpg, 02.jpg ... full.jpg, video.webm
  mobile/<page>/...
```

## Descriptions with any AI

![Who writes the descriptions](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/describe.png)

Choose who writes the descriptions in the menu ("Who writes the descriptions of the screens?") or with `--describe`. To describe a capture you already made, without capturing again:

```bash
npx screendocs describe your-site.com
```

Without the site (or with a site that has no capture), it lists the captures there are so you can pick one.

The titles and descriptions go into `screens.json` and `index.html`, and the mobile screens reuse the description of the same section on desktop. The report marks each screen with who described it (for example "Claude Code" or "AI chat"), or "page text" when no AI did, and the terminal lists the screens left out. What the AI changed stays visible: each described screen has a "Before AI" line with the text it had before, and `index-original.html` keeps the whole report as captured, never rewritten. Use `--lang pt` (or the menu) for another language.

> The AI has to **read images**: it looks at each screenshot to write its description. A model that only reads text cannot do this.

**1. A chat in your browser (no key, nothing installed).** Choose "A chat in your browser (ChatGPT, Gemini, Claude.ai...)" or use `--describe chat`. screendocs guides you: it opens a folder with the images (up to 10 per part, with unique names) and copies the text for the AI; you drag the images into the chat, paste the text, and paste the AI's answer back in the terminal. When a part is done, it closes that folder's window (Windows and macOS). It checks the answer and asks again if it is not right. `prompt.md` explains how to do the chat part on your own.

**2. An AI tool on your computer (uses your plan, no API key).** If [Claude Code](https://code.claude.com), [Codex](https://developers.openai.com/codex) or the [Antigravity CLI](https://antigravity.google) (`agy`, use a recent version) is installed and logged in, screendocs runs it for you. The menu always lists the three; if the one you pick is missing, it offers to install it with its official installer and tells you how to log in:

```bash
npx screendocs https://your-site.com --describe claude   # or codex, antigravity
```

**3. Any API (for developers).** Name the model with its provider in front, the usual format of AI tools (LiteLLM, aider); it is called directly, with no SDK installed:

```bash
npx screendocs your-site.com --model gemini/gemini-2.5-flash
```

| Model | Provider | Key |
|---|---|---|
| `openai/gpt-4o-mini` | OpenAI | `OPENAI_API_KEY` |
| `gemini/gemini-2.5-flash` | Google Gemini | `GEMINI_API_KEY` |
| `anthropic/claude-sonnet-4-5` | Anthropic | `ANTHROPIC_API_KEY` |
| `openrouter/<model>` | OpenRouter | `OPENROUTER_API_KEY` |
| `ollama/<model>` | Ollama on your computer (free) | none |
| `lmstudio/<model>` | LM Studio on your computer (free) | none |

For OpenAI, Gemini and Anthropic the prefix can be left out (`--model gemini-2.5-flash` works too), since the name already says the provider.

**The key** is looked for in this order: the provider's variable above (if you already use another AI tool, it is probably set), `SCREENDOCS_API_KEY`, and the key saved with `npx screendocs keys set <provider>`. If there is none, screendocs asks for it without showing what you type and asks whether to save it (No comes selected, so by default it is used for that run only).

The key is tried with the provider before the capture starts. A typo is asked again right away. If a saved key or the one in a variable was refused (it expired or was changed), screendocs says which one it was and, in a terminal, asks for the new one and offers to replace the saved one.

A saved key goes to the system's own safe place: the Keychain on macOS, encrypted with your Windows account on Windows (only you, on this computer, can read it back), or the desktop keyring on Linux (`secret-tool`). When none is available it stays in `~/.screendocs/keys.json`, readable only by your user. Either way it is in your user folder, outside any project, so it never goes to Git. `npx screendocs keys list` shows which providers have a saved key and where, and `keys remove <provider>` deletes one. A key saved by an older version stays in the file until you save it again with `keys set`.

![Where a saved key lives and what it protects against](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/keys.png)

**Local models** (Ollama, LM Studio) need no key. Before capturing, screendocs checks that the server answers and, on Ollama, that the model is downloaded (if not, it shows the `ollama pull` command). If Ollama runs on another address, set `OLLAMA_HOST`. The model must read images (e.g. `llama3.2-vision`, `qwen2.5vl`, `llava`, `gemma3`) and needs a computer with enough memory.

For another OpenAI-compatible server, do as the OpenAI tools do: set `OPENAI_BASE_URL` to its address and use `--model openai/<model>`.

Pick a model that reads images; with one that doesn't, screendocs tells you. The menu asks for the provider and the model, uses the saved key when there is one, and never shows the key.

screendocs sends up to 10 screens per request, so the documentation goes out a few times only and the bill stays small. Screens a request leaves out (or all of them, when the model takes one image at a time) are asked again one by one.

### Extra request and documentation

Every way of describing (chat, Claude Code, Codex, Antigravity, API and MCP) gets the same text with the rules. After you choose who describes, the menu asks two optional questions, and Enter skips each one:

- **"Should the descriptions focus on something specific?"**: what you type goes to the AI too, e.g. *"focus on what the customer gains on each screen"*. On the command line: `--instructions "..."`.
- **"A folder or file with the site's documentation for the AI to read?"**: a manual, a README, the project notes. On the command line: `--docs <path>`.

The documentation can be a folder (with subfolders) or a single file, in `.md`, `.mdx`, `.txt`, `.html`, `.rst`, `.adoc`, `.json`, `.yaml`, `.csv`, PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`) and OpenDocument (`.odt`, `.ods`, `.odp`). screendocs does not summarize anything: it takes the text out, keeps it in `docs-for-ai.md` in the capture folder and sends all of it to the AI, up to about 150 KB (around 40 pages); anything past that is cut. A scanned PDF (images only) has no text and is skipped.

Both are saved with the capture, so a later `npx screendocs describe <site>` uses them again. To change them, pass another value; to remove them, pass an empty one (`--instructions ""`, `--docs ""`).

## Use it from an AI (MCP)

`screendocs mcp` turns screendocs into tools for AI clients that speak [MCP](https://modelcontextprotocol.io) (Claude Code, Cursor, VS Code, Claude Desktop, Codex...). You ask in plain words, for example *"document the screens of mysite.com in Portuguese"*, and the AI captures the site, looks at each screenshot and writes the descriptions itself, on your plan, with no API key.

**Claude Desktop (one click).** Download [screendocs.mcpb](https://github.com/RuBeNsMoTa13/screendocs/releases/latest/download/screendocs.mcpb) and open it: Claude Desktop shows an Install button and asks which folder the captures go to. Nothing else to install; Claude Desktop brings its own Node.js.

**Claude Code**

```bash
claude mcp add screendocs -- npx -y screendocs mcp
# Windows:
claude mcp add screendocs -- cmd /c npx -y screendocs mcp
```

Add `--scope user` to have it in every project. Check it with `/mcp` inside Claude Code.

**Cursor** (`.cursor/mcp.json`), Claude Desktop without the installer (`claude_desktop_config.json`) and most other clients:

```json
{
  "mcpServers": {
    "screendocs": { "command": "npx", "args": ["-y", "screendocs", "mcp", "--dir", "C:/Users/you/screendocs"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`): the same, under `"servers"` with `"type": "stdio"`. **Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.screendocs]
command = "npx"
args = ["-y", "screendocs", "mcp"]
```

Captures and saved logins go to the folder the client starts the server in (in Claude Code and Cursor, your project). `--dir <folder>` sets it, which is worth doing in Claude Desktop, where that folder is not yours (the installer asks for it). To use a copy of screendocs that is not on npm, replace `npx -y screendocs` with `node <path>/bin/screendocs.mjs`.

| Tool | What it does |
|---|---|
| `capture_site` | Captures a site (same options as the command line: `pages`, `exclude`, `viewports`, `maxPages`, `depth`, `video`, `keep`, `mask`, `lang`, `instructions`, `docs`...) |
| `list_captures` | The sites already captured |
| `get_capture` | The screens of a capture, with the path of each image, its current description and the same text with the rules the other ways get (takes `instructions` and `docs`) |
| `view_screens` | Shows up to 10 screenshots to the AI |
| `save_descriptions` | Saves titles and descriptions into `screens.json` and the report, marked with the AI's name |
| `login`, `save_login` | Opens a browser window for you to log in, then saves the session for later captures |

A capture takes one to several minutes; with `video: false` it is faster.

> **Which AI apps work.** Any app that runs MCP servers on your computer: Claude Desktop, Claude Code, Cursor, VS Code (Copilot), Windsurf, Codex, Gemini CLI, Cline, LM Studio and others. AI chats that only run in the browser (ChatGPT, Claude.ai, Gemini on the web) cannot start a program on your computer, so they don't work. The model must also **read images**: it looks at each screenshot to describe it. A text-only model can capture the site but not describe the screens.

## What it leaves on your computer

![What it leaves on your computer](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/en/files.png)

In the folder where you run the command, only `screendocs-output/`: the captures and the reports, one folder per site. Everything else is in your user folder (`npx screendocs config path` shows where):

| What | |
|---|---|
| Your defaults | what you saved with `npx screendocs config`, the language included |
| Site logins | one file per site, saved by `npx screendocs login`. Never share them |
| API keys | only if you chose to save one, and only when the system has no password store |

Deleting that folder erases all three: you log in to the sites again, and the language is asked again on the next run.

A `screendocs.config.json` is only read, if you created one; screendocs never creates it.

## Real data

Logged-in areas often show real people's data. The automatic blur covers the common cases, not all of them: use a test account when you can and check the images before publishing.

## Requirements

Node.js 18 or newer. Google Chrome or Microsoft Edge installed (Edge comes with Windows). To use another Chromium-based browser, set `CHROMIUM_PATH` to its executable.

## Running from the code

To download the code from GitHub and run it, change it or send a fix, see [CONTRIBUTING.md](https://github.com/RuBeNsMoTa13/screendocs/blob/main/CONTRIBUTING.md).

## License

MIT
