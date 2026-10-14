# screendocs

Point it at a website and get every screen documented: a screenshot of each section of each page, on desktop and mobile, a video scrolling through it, a short description of what each screen does, and an HTML report you can open or share. Pages behind a login are included: you log in once, screendocs reuses the session.

Works with any site, in any stack. Nothing is installed in the project being documented.

[Português](README.pt-BR.md)

## Quick start

```bash
npx screendocs
```

With no arguments it opens an interactive menu that asks for the site and the options (login, desktop/mobile, video, which pages) and shows the equivalent command at the end. Or pass everything at once:

```bash
npx screendocs https://your-site.com
```

It uses the Chrome or Edge already installed on your computer; no browser is downloaded. Output goes to `screendocs-output/<site>/`; open `index.html`.

## Pages behind a login

```bash
npx screendocs login https://your-site.com
```

A browser window opens. Log in as usual (Google login works), go back to the terminal and press Enter. The session is saved in `.screendocs/auth/` and every later run on that site uses it, so the pages it finds after login are captured too.

Before each run it opens the page you were on when you logged in; if the site sends it elsewhere or asks for a password, it warns that the login has expired (the menu offers to log in again).

`.screendocs/` gives access to your account. It is added to `.gitignore` automatically; never commit or share it.

## What it does

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
| `--describe <how>` | | who writes the descriptions: `claude`, `codex`, `antigravity`, `api` or `chat` (see below) |
| `--api-url <url>` | | OpenAI-compatible API address, for `--describe api` |
| `--model <id>` | | model for `--describe api` (one that reads images) |
| `--api-key <key>` | | API key for `--describe api` (prefer `SCREENDOCS_API_KEY`) |
| `--docs <dir>` | | Markdown docs the AI reads when describing |
| `--lang <code>` | `en` | description language (`pt`, `es`...) |
| `--config <file>` | `screendocs.config.json` | config file (see below) |
| `--headed` | | show the browser |
| `--open` | | open the report when done (the menu always does) |
| `-v`, `--version` | | show the version |
| `-h`, `--help` | | show the help |

Environment variables:

| Variable | |
|---|---|
| `SCREENDOCS_API_KEY` | API key for `--describe api` |
| `CHROMIUM_PATH` | use another Chromium-based browser instead of Chrome or Edge |
| `SCREENDOCS_DEBUG` | set to `1` to print the full error |

## Config file

Put `screendocs.config.json` where you run the command and keep the options there:

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
  screens.json        every page and screen with title and description
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

The titles and descriptions go into `screens.json` and `index.html`, and the mobile screens reuse the description of the same section on desktop. The report marks each screen with who described it (for example "Claude Code" or "AI chat"), or "page text" when no AI did, and the terminal lists the screens left out. Use `--lang pt` (or the menu) for another language.

> The AI has to **read images**: it looks at each screenshot to write its description. A model that only reads text cannot do this.

**1. A chat in your browser (no key, nothing installed).** Choose "A chat in your browser (ChatGPT, Gemini, Claude.ai...)" or use `--describe chat`. screendocs guides you: it opens a folder with the images (up to 10 per part, with unique names) and copies the text for the AI; you drag the images into the chat, paste the text, and paste the AI's answer back in the terminal. It checks the answer and asks again if it is not right. `prompt.md` explains how to do the chat part on your own.

**2. An AI tool on your computer (uses your plan, no API key).** If [Claude Code](https://code.claude.com), [Codex](https://developers.openai.com/codex) or the [Antigravity CLI](https://antigravity.google) (`agy`, use a recent version) is installed and logged in, screendocs runs it for you:

```bash
npx screendocs https://your-site.com --describe claude   # or codex, antigravity
```

**3. Any API (for developers).** Any provider with an OpenAI-compatible API works, called directly, with no SDK installed:

```bash
export SCREENDOCS_API_KEY=...        # PowerShell: $env:SCREENDOCS_API_KEY="..."
npx screendocs https://your-site.com --describe api --api-url https://api.openai.com/v1 --model <model>
```

| Provider | `--api-url` |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Ollama (local, free, no key) | `http://localhost:11434/v1` |

Pick a model that reads images (e.g. `gpt-4o-mini`, `gemini-2.5-flash`, `llama3.2-vision`); with one that doesn't, screendocs tells you. The menu asks for all of this and never shows the key.

## Real data

Logged-in areas often show real people's data. The automatic blur covers the common cases, not all of them: use a test account when you can and check the images before publishing.

## Requirements

Node.js 18 or newer. Google Chrome or Microsoft Edge installed (Edge comes with Windows). To use another Chromium-based browser, set `CHROMIUM_PATH` to its executable.

## License

MIT
