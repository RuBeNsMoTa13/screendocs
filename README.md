# screendocs

Point it at a website and get every screen documented: a screenshot of each section of each page, on desktop and mobile, a video scrolling through it, a short description of what each screen does, and an HTML report you can open or share. Pages behind a login are included: you log in once, screendocs reuses the session.

Works with any site, in any stack. Nothing is installed in the project being documented.

[Português](README.pt-BR.md)

## Quick start

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
| Personal data | blurs emails, phones, CPF/CNPJ and filled form fields | `--mask`, `--no-auto-mask` |
| Descriptions | no AI: each screen keeps the page's own text (title and first paragraph) | `--describe`, or later `npx screendocs describe <site>` |
| Description language | English | `--lang pt` |
| Folder | `screendocs-output/<site>/`, replacing the previous capture of the same site | `--out`, `--keep` |
| Browser | hidden | `--headed` |
| Report | not opened; the terminal shows the path to `index.html` | `--open` |

There are three ways to change the defaults:

1. **On the command**, for that run only: `npx screendocs mysite.com --no-video --describe chat --lang pt --open`. Every option is in [Options](#options) and in `npx screendocs --help`.
2. **In a `screendocs.config.json` file**, in the folder where you run the command, to apply every time there. See [Config file](#config-file).
3. **With the menu** (`npx screendocs` with no link): it asks about each thing and shows the equivalent command at the end, to repeat later without the questions.

When more than one sets the same option, the command wins, then the file, then the default.

## Pages behind a login

```bash
npx screendocs login https://your-site.com
```

A browser window opens. Log in as usual (Google login works), go back to the terminal and press Enter. The session is saved in `.screendocs/auth/` and every later run on that site uses it, so the pages it finds after login are captured too.

Before each run it opens the page you were on when you logged in; if the site sends it elsewhere or asks for a password, it warns that the login has expired (the menu offers to log in again).

`.screendocs/` gives access to your account. It is added to `.gitignore` automatically; never commit or share it.

## What it does

- **Checks the address** before starting: if the site does not open, it tries close addresses (with or without `www.`, other endings like `.com`, `.com.br`, `.net`, `.org`, `.io`, `.app`, `.dev`, typos like `.con`) and suggests the ones that open, with examples like `mysite.com`, `mysite.io` or `app.mysite.dev/login`.
- **Finds the pages by itself**: follows the site's own links from the start page, skips logout links and files, and treats `/posts/12` and `/posts/13` as one screen.
- **One image per section**: `<header>`, `<section>`, `<footer>` and similar blocks; pages without them are cut into screen-sized slices. Also a full-page image.
- **Desktop and mobile** (1440×900 and 390×844).
- **Video** of each page being scrolled.
- **Hides personal data**: emails, phone numbers, CPF/CNPJ and filled email/phone/password fields are blurred in screenshots and videos. Add your own selectors with `--mask`.
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
| `--describe <how>` | | who writes the descriptions: `claude`, `codex`, `antigravity` or `chat` (see below) |
| `--model <provider/model>` | | describe with an API (e.g. `gemini/gemini-2.5-flash`, `ollama/llama3.2-vision`; see below) |
| `--docs <dir>` | | Markdown docs the AI reads when describing |
| `--lang <code>` | `en` | description language (`pt`, `es`...) |
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

## Config file

Put `screendocs.config.json` where you run the command and keep the options there. They replace the defaults every time you run screendocs in that folder, and an option typed on the command still wins over the file:

```json
{
  "maxPages": 30,
  "exclude": ["/admin", "/blog/"],
  "viewports": ["desktop", "mobile"],
  "mask": [".customer-name", "#balance"],
  "describe": "claude",
  "docs": "./docs",
  "lang": "pt"
}
```

## Output

```
screendocs-output/your-site.com/
  index.html          report
  index-original.html the report as captured, before any AI description (never rewritten)
  screens.json        every page and screen with title and description
  screens-original.json  the same, as captured
  prompt.md           how to describe the screens with an AI chat on your own
  for-ai/part-1/...   the screens to describe, with unique names, plus the text for the AI
  desktop/<page>/01.jpg, 02.jpg ... full.jpg, video.webm
  mobile/<page>/...
```

## Descriptions with any AI

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

**The key** is looked for in this order: the provider's variable above (if you already use another AI tool, it is probably set), `SCREENDOCS_API_KEY`, and the key saved with `npx screendocs keys set <provider>`. If there is none, screendocs asks for it without showing what you type and offers to save it in `~/.screendocs/keys.json`, in your user folder, outside any project, so it never goes to Git. `npx screendocs keys list` shows which providers have a saved key and `keys remove <provider>` deletes one.

**Local models** (Ollama, LM Studio) need no key. Before capturing, screendocs checks that the server answers and, on Ollama, that the model is downloaded (if not, it shows the `ollama pull` command). If Ollama runs on another address, set `OLLAMA_HOST`. The model must read images (e.g. `llama3.2-vision`, `qwen2.5vl`, `llava`, `gemma3`) and needs a computer with enough memory.

For another OpenAI-compatible server, do as the OpenAI tools do: set `OPENAI_BASE_URL` to its address and use `--model openai/<model>`.

Pick a model that reads images; with one that doesn't, screendocs tells you. The menu asks for the provider and the model, uses the saved key when there is one, and never shows the key.

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
| `capture_site` | Captures a site (same options as the command line: `pages`, `exclude`, `viewports`, `maxPages`, `depth`, `video`, `keep`, `mask`, `lang`...) |
| `list_captures` | The sites already captured |
| `get_capture` | The screens of a capture, with the path of each image and its current description |
| `view_screens` | Shows up to 10 screenshots to the AI |
| `save_descriptions` | Saves titles and descriptions into `screens.json` and the report, marked with the AI's name |
| `login`, `save_login` | Opens a browser window for you to log in, then saves the session for later captures |

A capture takes one to several minutes; with `video: false` it is faster.

> **Which AI apps work.** Any app that runs MCP servers on your computer: Claude Desktop, Claude Code, Cursor, VS Code (Copilot), Windsurf, Codex, Gemini CLI, Cline, LM Studio and others. AI chats that only run in the browser (ChatGPT, Claude.ai, Gemini on the web) cannot start a program on your computer, so they don't work. The model must also **read images**: it looks at each screenshot to describe it. A text-only model can capture the site but not describe the screens.

## Real data

Logged-in areas often show real people's data. The automatic blur covers the common cases, not all of them: use a test account when you can and check the images before publishing.

## Requirements

Node.js 18 or newer. Google Chrome or Microsoft Edge installed (Edge comes with Windows). To use another Chromium-based browser, set `CHROMIUM_PATH` to its executable.

## License

MIT
