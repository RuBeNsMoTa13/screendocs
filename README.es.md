# screendocs

Apunta a un sitio web y recibe todas las pantallas documentadas: una captura de cada sección de cada página, en computadora y en celular, un video recorriendo la página, una descripción corta de lo que hace cada pantalla y un informe HTML para abrir o compartir. Las páginas que piden inicio de sesión también entran: inicias sesión una vez y screendocs reutiliza la sesión.

Funciona con cualquier sitio, en cualquier stack. No se instala nada en el proyecto documentado.

[English](https://github.com/RuBeNsMoTa13/screendocs/blob/main/README.md) · [Português](https://github.com/RuBeNsMoTa13/screendocs/blob/main/README.pt-BR.md)

> **Este README es para quien usa screendocs desde npm** (`npx screendocs`): cómo usarlo, sin descargar ni compilar nada. Para ejecutarlo desde el código de GitHub, cambiarlo o mandar una corrección, mira la [guía para desarrolladores](https://github.com/RuBeNsMoTa13/screendocs/blob/main/CONTRIBUTING.es.md).

## Inicio rápido

**Manual del usuario (npm):** las imágenes de abajo vienen de [docs/user-manual.html](https://github.com/RuBeNsMoTa13/screendocs/blob/main/docs/user-manual.html), un manual de una página en inglés, portugués y español. Descárgalo y ábrelo en el navegador para ver todo, incluida cada flag.

![Dos formas de usarlo](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/ways.png)

<details>
<summary>El menú, paso a paso</summary>

![El menú: idioma, sitio y comprobación de la dirección](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/menu-start.png)

![El menú: revisión, inicio y la captura](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/menu-run.png)

</details>

```bash
npx screendocs
```

Sin argumentos, abre un menú interactivo que pregunta el sitio y las opciones (inicio de sesión, computadora/celular, video, qué páginas) y al final muestra el comando equivalente. Debajo de cada pregunta, una línea muestra lo que hace cada tecla: las flechas para elegir, `Enter` confirma, `Esc` vuelve a la pregunta anterior y `Ctrl+C` sale. O pasa todo de una vez:

```bash
npx screendocs https://seu-site.com
```

Usa el Chrome o el Edge que ya tienes instalado en tu computadora; no se descarga ningún navegador. El resultado queda en `screendocs-output/<site>/`; abre el `index.html`.

## Qué se ejecuta por defecto

Solo con el enlace (`npx screendocs meusite.com.br`), no pregunta nada y usa los valores por defecto:

| Qué | Por defecto | Para cambiarlo |
|---|---|---|
| Dirección | revisa que abra antes de empezar y sugiere correcciones | `--no-url-check` |
| Inicio de sesión | usa la sesión guardada del sitio, si existe (`screendocs login`), y avisa si expiró | `npx screendocs login <site>` |
| Páginas | sigue los enlaces desde la página de inicio, hasta 20 páginas y 3 clics de distancia | `--max-pages`, `--depth`, `--exclude`, `--pages` |
| Pantallas | computadora y celular | `--viewports desktop` o `--viewports mobile` |
| Capturas | una por sección, más la página completa | |
| Video | uno recorriendo cada página | `--no-video` |
| Datos personales | difumina correos, teléfonos, documentos, tarjetas y campos llenos, y los quita del texto guardado | `--mask`, `--no-auto-mask` |
| Descripciones | ninguna IA: cada pantalla queda con el texto de la página (título y primer párrafo) | `--describe`, o después `npx screendocs describe <site>` |
| Idioma de las descripciones | el idioma de screendocs (se pregunta la primera vez) | `--lang pt` |
| Carpeta | `screendocs-output/<site>/` dentro de la carpeta donde ejecutas el comando (la terminal muestra la ruta completa al principio), reemplazando la captura anterior del mismo sitio | `--out`, `--keep` |
| Navegador | oculto | `--headed` |
| Informe | no se abre solo; la terminal muestra la ruta del `index.html` | `--open` |

Hay cuatro formas de cambiar los valores por defecto:

1. **En el comando**, solo para esa vez: `npx screendocs meusite.com.br --no-video --describe chat --lang pt --open`. Todas las opciones están en [Opciones](#opciones) y en `npx screendocs --help`.
2. **Con `npx screendocs config`**, tus valores por defecto, en cualquier carpeta. Consulta [Tus valores por defecto e idioma](#tus-valores-por-defecto-e-idioma).
3. **En el archivo `screendocs.config.json`** (opcional), en la carpeta donde ejecutas el comando, para que valga solo ahí. Consulta [Archivo de configuración](#archivo-de-configuración).
4. **Desde el menú** (`npx screendocs` sin enlace): pregunta cada cosa, partiendo de tus valores por defecto, y al final muestra el comando equivalente, para repetirlo después sin las preguntas.

Cuando más de uno define la misma opción, piensa en capas, una encima de otra. La de arriba gana:

1. **Los valores por defecto de screendocs** (abajo): lo que viene en el paquete, como hasta 20 páginas.
2. **Tus valores por defecto**, guardados con `npx screendocs config`: valen en cualquier carpeta.
3. **Un `screendocs.config.json` en la carpeta** (opcional): vale solo en esa carpeta.
4. **El comando** (arriba): lo que escribes ahora, solo esta vez.

Por ejemplo, con el número de páginas: screendocs dice 20. Guardaste 40 con `npx screendocs config`, así que usa 40 en cualquier lugar. La carpeta `cliente-x` tiene un `screendocs.config.json` que dice 10, así que ahí usa 10. Si escribes `--max-pages 5` en esa carpeta, usa 5, solo esta vez.

La mayoría solo necesita las capas 2 y 4: guarda lo que quieres siempre con `npx screendocs config` y cámbialo una vez con una opción en el comando.

![Qué vale más: las cuatro capas](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/layers.png)

## Páginas con inicio de sesión

```bash
npx screendocs login https://seu-site.com
```

Abre una ventana del navegador. Inicia sesión normalmente (el inicio de sesión con Google funciona), vuelve a la terminal y presiona Enter. La sesión queda guardada en tu carpeta de usuario, junto con tus valores por defecto, y las siguientes ejecuciones en ese sitio la usan, así que las páginas que encuentra después del inicio de sesión también se capturan.

Antes de cada captura abre la página en la que estabas cuando iniciaste sesión; si el sitio te manda a otro lugar o pide contraseña, avisa que la sesión expiró (el menú ofrece iniciar sesión de nuevo).

Como queda en tu carpeta de usuario, la sesión vale en cualquier carpeta donde ejecutes screendocs. La sesión guardada da acceso a tu cuenta, por eso solo tu usuario puede leerla. Para salir de un sitio, ejecuta `npx screendocs login` de nuevo o cierra sesión desde el propio sitio.

## Qué hace

![Cómo se mapea el sitio](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/mapping-steps.png)

<details>
<summary>Cómo se encuentran las páginas y las secciones</summary>

![Buscando las páginas](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/mapping-pages.png)

![Cortando cada página en secciones](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/mapping-sections.png)

</details>

- **Revisa la dirección** antes de empezar: si el sitio no abre, prueba direcciones parecidas (con o sin `www.`, otras terminaciones como `.com.br`, `.com`, `.net`, `.org`, `.io`, `.app`, `.dev`, errores como `.con`) y sugiere las que abren, con ejemplos como `meusite.com.br`, `meusite.app` o `app.meusite.io/login`.
- **Encuentra las páginas solo**: sigue los enlaces del propio sitio desde la página de inicio, omite enlaces de salir/cerrar sesión y archivos, y trata `/posts/12` y `/posts/13` como una sola pantalla.
- **Una imagen por sección**: `<header>`, `<section>`, `<footer>` y bloques parecidos; las páginas sin eso se cortan en franjas del tamaño de la pantalla. También captura la página completa.
- **Computadora y celular** (1440×900 y 390×844).
- **Video** de cada página recorriéndola.
- **Oculta datos personales**: quedan difuminados en las capturas y en los videos, y se cambian por `•••` en el texto guardado con la captura (`screens.json`, el informe y el texto enviado a la IA):
  - correos, números de tarjeta (revisados con su dígito verificador) y teléfonos en los formatos de Brasil, EE. UU., España e internacional (`+código`);
  - documentos: CPF y CNPJ (Brasil, con o sin puntuación), SSN (EE. UU.), DNI y NIE (España), DNI (Argentina), CURP y RFC (México), IBAN;
  - campos de correo, teléfono y contraseña llenos, y cualquier campo con uno de los datos anteriores.

  Agrega tus propios selectores CSS con `--mask` (que también quedan fuera del texto guardado). Los nombres y el texto libre no se detectan: usa una cuenta de prueba cuando puedas.
- **Descripciones**: por defecto, el título y el primer párrafo de cada sección. Una IA puede mirar cada captura y escribir un título y una descripción: consulta [Descripciones con cualquier IA](#descripciones-con-cualquier-ia).
- **Informe**: `index.html` con todas las páginas, las dos pantallas y los videos, más el `screens.json` para usar en scripts.

## Opciones

| Opción | Por defecto | |
|---|---|---|
| `--max-pages <n>` | 20 | cuántas páginas buscar |
| `--depth <n>` | 3 | profundidad de enlaces desde la página de inicio |
| `--pages /a,/b` | | captura exactamente esas rutas en vez de buscar |
| `--exclude a,b` | | omite las URL que contienen esos textos |
| `--viewports <lista>` | `desktop,mobile` | `desktop` (computadora), `mobile` (celular) o los dos |
| `--no-video` | | sin videos |
| `--out <pasta>` | `screendocs-output` | carpeta de salida |
| `--keep` | | conserva la captura anterior del sitio (renombrada con la fecha) en vez de reemplazarla |
| `--mask <seletores>` | | selectores CSS extra para difuminar |
| `--no-auto-mask` | | no difumina correos, teléfonos ni documentos |
| `--describe <como>` | | quién escribe las descripciones: `claude`, `codex`, `antigravity` o `chat` (ver abajo). `none`: sin IA solo esta vez, para cuando tus valores por defecto tienen una IA y ejecutas directo desde el comando (en el menú, elige "Por ahora, solo el escaneo de la página") |
| `--model <provedor/modelo>` | | describe con una API (ej.: `gemini/gemini-2.5-flash`, `ollama/llama3.2-vision`; ver abajo) |
| `--instructions <texto>` | | qué más deben tener en cuenta las descripciones, ej.: `"fale do que o cliente ganha"` |
| `--docs <caminho>` | | documentación del proyecto para que la IA la lea: una carpeta o un archivo (consulta [Pedido extra y documentación](#pedido-extra-y-documentación)) |
| `--lang <código>` | el idioma de screendocs | idioma de las descripciones (`pt`, `en`, `es`...) |
| `--config <arquivo>` | `screendocs.config.json` | archivo de configuración (ver abajo) |
| `--headed` | | muestra el navegador |
| `--no-url-check` | | no revisa si la dirección abre (sitios que solo abren en tu red o VPN) |
| `--open` | | abre el informe al final (el menú siempre lo abre) |
| `-v`, `--version` | | muestra la versión |
| `-h`, `--help` | | muestra la ayuda |

Variables de entorno:

| Variable | |
|---|---|
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | la clave del proveedor para `--model` |
| `SCREENDOCS_API_KEY` | una clave para `--model`, sea cual sea el proveedor |
| `OPENAI_BASE_URL` | otro servidor compatible con OpenAI, con `--model openai/<modelo>` |
| `OLLAMA_HOST` | dónde se ejecuta Ollama, cuando no es `localhost:11434` |
| `CHROMIUM_PATH` | usa otro navegador basado en Chromium en lugar de Chrome o Edge |
| `SCREENDOCS_DEBUG` | defínela como `1` para ver el error completo |
| `SCREENDOCS_LANGUAGE` | el idioma de screendocs en esta ejecución: `en`, `pt` o `es` |
| `SCREENDOCS_HOME` | otra carpeta para tus valores por defecto y claves guardadas (por defecto `~/.screendocs`) |

## Tus valores por defecto e idioma

screendocs habla inglés, portugués o español. La primera vez que se ejecuta en una terminal pregunta cuál (ya viene marcado el idioma de la computadora) y guarda la respuesta.

Tus valores por defecto quedan guardados en tu computadora, en tu carpeta de usuario (`npx screendocs config path` muestra dónde), y no en la carpeta donde ejecutas el comando. Valen en cualquier carpeta y siguen ahí cuando screendocs se actualiza. Una opción escrita en el comando, o un `screendocs.config.json` en la carpeta, todavía les gana.

```bash
npx screendocs config                         # menú: elige una opción, cámbiala, Listo
npx screendocs config list                    # lo que está guardado
npx screendocs config set language pt         # en, pt o es
npx screendocs config set max-pages 30
npx screendocs config set viewports desktop
npx screendocs config set video false
npx screendocs config set describe claude     # o: config set model gemini/gemini-2.5-flash
npx screendocs config unset video             # vuelve al valor por defecto
npx screendocs config reset                   # borra todo (el idioma se pregunta de nuevo)
npx screendocs config path                    # dónde está el archivo
```

Las opciones tienen los mismos nombres que en `screendocs.config.json` (`maxPages` o `max-pages`, da igual), más `language`.

## Archivo de configuración

Opcional, para cuando un proyecto necesita opciones distintas de tus valores por defecto. Crea un archivo llamado `screendocs.config.json` en la carpeta donde ejecutas el comando para ese proyecto, con sus opciones. Valen siempre que ejecutas screendocs en esa carpeta, y una opción escrita en el comando todavía vale más que el archivo. Nadie necesita crear este archivo: sin él, valen tus valores por defecto.

```json
{
  "maxPages": 30,
  "exclude": ["/admin", "/blog/"],
  "viewports": ["desktop", "mobile"],
  "mask": [".nome-cliente", "#saldo"],
  "describe": "claude",
  "docs": "./docs",
  "instructions": "fale do que o cliente ganha em cada tela",
  "lang": "pt"
}
```

## Resultado

![Lo que recibes](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/output.png)

```
screendocs-output/seu-site.com/
  index.html          informe
  index-original.html el informe tal como se capturó, antes de cualquier descripción de la IA (nunca se reescribe)
  screens.json        todas las páginas y pantallas con título y descripción
  screens-original.json  lo mismo, tal como se capturó
  prompt.md           cómo describir las pantallas con un chat de IA por tu cuenta
  docs-for-ai.md      el texto sacado de la documentación (solo con --docs)
  for-ai/part-1/...   las pantallas por describir, con nombres únicos, y el texto para la IA
  desktop/<pagina>/01.jpg, 02.jpg ... full.jpg, video.webm
  mobile/<pagina>/...
```

## Descripciones con cualquier IA

![Quién escribe las descripciones](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/describe.png)

Elige quién escribe las descripciones en el menú ("¿Quién escribe las descripciones de las pantallas?") o con `--describe`. Para describir una captura que ya hiciste, sin capturar de nuevo:

```bash
npx screendocs describe seu-site.com.br
```

Sin el sitio (o con un sitio que no tiene captura), lista las capturas que existen para que elijas.

Los títulos y descripciones van al `screens.json` y al `index.html`, y las pantallas del celular reutilizan la descripción de la misma sección en la computadora. El informe marca en cada pantalla quién la describió (por ejemplo "Claude Code" o "AI chat"), o "texto de la página" cuando ninguna IA la describió, y la terminal lista las pantallas que quedaron fuera. Lo que cambió la IA queda visible: cada pantalla descrita tiene una línea "Antes de la IA" con el texto que tenía antes, y el `index-original.html` guarda el informe completo tal como se capturó, sin reescribirlo nunca. Usa `--lang pt` (o el menú) para descripciones en otro idioma.

> La IA necesita **leer imágenes**: mira cada captura para escribir la descripción. Un modelo que solo lee texto no puede.

**1. Un chat en el navegador (sin clave, sin instalar nada).** Elige "Un chat en tu navegador (ChatGPT, Gemini, Claude.ai...)" o usa `--describe chat`. screendocs te guía: abre una carpeta con las imágenes (hasta 10 por parte, con nombres únicos) y copia el texto para la IA; tú arrastras las imágenes al chat, pegas el texto y pegas la respuesta de la IA de vuelta en la terminal. Cuando una parte termina, cierra la ventana de esa carpeta (Windows y macOS). Revisa la respuesta y la pide de nuevo si no llega bien. El `prompt.md` explica cómo hacer la parte del chat por tu cuenta.

**2. Una herramienta de IA en tu computadora (usa tu plan, sin clave de API).** Si [Claude Code](https://code.claude.com), [Codex](https://developers.openai.com/codex) o [Antigravity CLI](https://antigravity.google) (`agy`, usa una versión reciente) está instalado y con la sesión iniciada, screendocs lo ejecuta por ti. El menú siempre muestra los tres; si el elegido no está instalado, ofrece instalarlo con el instalador oficial y te dice cómo iniciar sesión:

```bash
npx screendocs https://seu-site.com.br --describe claude   # o codex, antigravity
```

**3. Cualquier API (para desarrolladores).** Indica el modelo con el proveedor adelante, el formato común de las herramientas de IA (LiteLLM, aider); se llama directo, sin instalar SDK:

```bash
npx screendocs seu-site.com.br --model gemini/gemini-2.5-flash
```

| Modelo | Proveedor | Clave |
|---|---|---|
| `openai/gpt-4o-mini` | OpenAI | `OPENAI_API_KEY` |
| `gemini/gemini-2.5-flash` | Google Gemini | `GEMINI_API_KEY` |
| `anthropic/claude-sonnet-4-5` | Anthropic | `ANTHROPIC_API_KEY` |
| `openrouter/<modelo>` | OpenRouter | `OPENROUTER_API_KEY` |
| `ollama/<modelo>` | Ollama en tu computadora (gratis) | ninguna |
| `lmstudio/<modelo>` | LM Studio en tu computadora (gratis) | ninguna |

Para OpenAI, Gemini y Anthropic el prefijo se puede omitir (`--model gemini-2.5-flash` también funciona), porque el nombre ya indica el proveedor.

**La clave** se busca en este orden: la variable del proveedor de arriba (si ya usas otra herramienta de IA, probablemente ya existe), `SCREENDOCS_API_KEY` y la clave guardada con `npx screendocs keys set <provedor>`. Si no encuentra ninguna, screendocs pide la clave sin mostrar lo que escribes y pregunta si debe guardarla (ya viene marcado No, así que por defecto vale solo para esa ejecución).

La clave se prueba con el proveedor antes de que empiece la captura. Si la escribes mal, la pide de nuevo en el momento. Si una clave guardada o la de una variable es rechazada (expiró o fue cambiada), screendocs dice cuál fue y, en una terminal, pide la nueva y ofrece reemplazar la guardada.

Una clave guardada va al lugar seguro del propio sistema: el Keychain en macOS, cifrada con tu cuenta de Windows en Windows (solo tú, en esta computadora, puedes leerla), o el llavero de Linux (`secret-tool`). Cuando no existe ninguno, queda en `~/.screendocs/keys.json`, que solo tu usuario puede leer. En los dos casos queda en tu carpeta de usuario, fuera de cualquier proyecto, así que nunca va a Git. `npx screendocs keys list` muestra qué proveedores tienen clave guardada y dónde, y `keys remove <provedor>` borra una. Una clave guardada por una versión anterior sigue en el archivo hasta que la guardes de nuevo con `keys set`.

![Dónde queda una clave guardada y de qué la protege](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/keys.png)

**Los modelos locales** (Ollama, LM Studio) no necesitan clave. Antes de capturar, screendocs revisa si el servidor responde y, en Ollama, si el modelo fue descargado (si no, muestra el comando `ollama pull`). Si Ollama se ejecuta en otra dirección, define `OLLAMA_HOST`. El modelo necesita leer imágenes (ej.: `llama3.2-vision`, `qwen2.5vl`, `llava`, `gemma3`) y necesita una computadora con memoria suficiente.

Para otro servidor compatible con OpenAI, haz como las herramientas de OpenAI: define `OPENAI_BASE_URL` con su dirección y usa `--model openai/<modelo>`.

Elige un modelo que lea imágenes; si eliges uno que no las lee, screendocs avisa. El menú pregunta el proveedor y el modelo, usa la clave guardada cuando la hay y nunca muestra la clave.

screendocs manda hasta 10 pantallas por pedido, así que la documentación se envía pocas veces y la cuenta sale menor. Las pantallas que un pedido deje fuera (o todas, si el modelo solo acepta una imagen a la vez) se piden de nuevo una por una.

### Pedido extra y documentación

Todas las formas de describir (chat, Claude Code, Codex, Antigravity, API y MCP) reciben el mismo texto con las reglas. Después de elegir quién describe, el menú hace dos preguntas opcionales, y Enter salta cada una:

- **"¿Las descripciones deben enfocarse en algo específico?"**: lo que escribas va junto para la IA, por ejemplo *"habla de lo que gana el cliente en cada pantalla"*. En el comando: `--instructions "..."`.
- **"¿Hay una carpeta o archivo con la documentación del sitio para que la IA lea?"**: un manual, un README, las notas del proyecto. En el comando: `--docs <caminho>`.

La documentación puede ser una carpeta (con subcarpetas) o un solo archivo, en `.md`, `.mdx`, `.txt`, `.html`, `.rst`, `.adoc`, `.json`, `.yaml`, `.csv`, PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`) y OpenDocument (`.odt`, `.ods`, `.odp`). screendocs no resume nada: saca el texto, lo guarda en `docs-for-ai.md` en la carpeta de la captura y lo manda completo a la IA, hasta unos 150 KB (cerca de 40 páginas); lo que pase de eso se corta. Un PDF escaneado (solo imagen) no tiene texto y queda fuera.

Los dos quedan guardados con la captura, así que un `npx screendocs describe <site>` después usa los mismos. Para cambiarlos, pasa otro valor; para quitarlos, pásalos vacíos (`--instructions ""`, `--docs ""`).

## Usar desde una IA (MCP)

`screendocs mcp` convierte screendocs en herramientas para clientes de IA que hablan [MCP](https://modelcontextprotocol.io) (Claude Code, Cursor, VS Code, Claude Desktop, Codex...). Pides con tus palabras, por ejemplo *"documenta las pantallas de meusite.com.br en español"*, y la IA captura el sitio, mira cada captura y escribe las descripciones ella misma, con tu plan, sin clave de API.

**Claude Desktop (un clic).** Descarga el [screendocs.mcpb](https://github.com/RuBeNsMoTa13/screendocs/releases/latest/download/screendocs.mcpb) y ábrelo: Claude Desktop muestra un botón Instalar y pregunta en qué carpeta quedan las capturas. No necesitas instalar nada más; Claude Desktop trae su propio Node.js.

**Claude Code**

```bash
claude mcp add screendocs -- npx -y screendocs mcp
# Windows:
claude mcp add screendocs -- cmd /c npx -y screendocs mcp
```

Con `--scope user` queda disponible en todos los proyectos. Revísalo con `/mcp` dentro de Claude Code.

**Cursor** (`.cursor/mcp.json`), Claude Desktop sin el instalador (`claude_desktop_config.json`) y la mayoría de los otros clientes:

```json
{
  "mcpServers": {
    "screendocs": { "command": "npx", "args": ["-y", "screendocs", "mcp", "--dir", "C:/Users/voce/screendocs"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`): lo mismo, dentro de `"servers"` y con `"type": "stdio"`. **Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.screendocs]
command = "npx"
args = ["-y", "screendocs", "mcp"]
```

Las capturas y las sesiones guardadas quedan en la carpeta en la que el cliente inicia el servidor (en Claude Code y en Cursor, tu proyecto). `--dir <pasta>` elige esa carpeta, lo que vale la pena en Claude Desktop, donde no es tuya (el instalador la pregunta). Para usar una copia de screendocs que no está en npm, cambia `npx -y screendocs` por `node <caminho>/bin/screendocs.mjs`.

| Herramienta | Qué hace |
|---|---|
| `capture_site` | Captura un sitio (las mismas opciones de la línea de comandos: `pages`, `exclude`, `viewports`, `maxPages`, `depth`, `video`, `keep`, `mask`, `lang`, `instructions`, `docs`...) |
| `list_captures` | Los sitios ya capturados |
| `get_capture` | Las pantallas de una captura, con la ruta de cada imagen, la descripción actual y el mismo texto con las reglas que reciben los otros modos (acepta `instructions` y `docs`) |
| `view_screens` | Muestra hasta 10 capturas a la IA |
| `save_descriptions` | Guarda títulos y descripciones en el `screens.json` y en el informe, marcados con el nombre de la IA |
| `login`, `save_login` | Abre una ventana del navegador para que inicies sesión y después guarda la sesión para las próximas capturas |

Una captura tarda de uno a varios minutos; con `video: false` es más rápida.

> **Qué IA funcionan.** Cualquier app que ejecute servidores MCP en tu computadora: Claude Desktop, Claude Code, Cursor, VS Code (Copilot), Windsurf, Codex, Gemini CLI, Cline, LM Studio y otras. Los chats de IA que funcionan solo en el navegador (ChatGPT, Claude.ai, Gemini en la web) no pueden abrir un programa en tu computadora, así que no funcionan. El modelo también necesita **leer imágenes**: mira cada captura para describirla. Un modelo solo de texto puede capturar el sitio, pero no describir las pantallas.

## Qué queda en tu computadora

![Lo que queda en tu computadora](https://raw.githubusercontent.com/RuBeNsMoTa13/screendocs/main/docs/images/es/files.png)

En la carpeta donde ejecutas el comando, solo `screendocs-output/`: las capturas y los informes, una carpeta por sitio. Todo lo demás queda en tu carpeta de usuario (`npx screendocs config path` muestra dónde):

| Qué | |
|---|---|
| Tus valores por defecto | lo que guardaste con `npx screendocs config`, incluido el idioma |
| Sesiones de los sitios | un archivo por sitio, guardado por `npx screendocs login`. Nunca lo compartas |
| Claves de API | solo si elegiste guardarlas, y solo cuando el sistema no tiene un almacén de contraseñas |

Borrar esa carpeta borra los tres: vuelves a iniciar sesión en los sitios, y el idioma se pregunta de nuevo la próxima vez.

Un `screendocs.config.json` solo se lee, si lo creaste; screendocs nunca crea ese archivo.

## Datos reales

Las áreas con inicio de sesión suelen mostrar datos de personas reales. El difuminado automático cubre los casos comunes, no todos: usa una cuenta de prueba cuando puedas y revisa las imágenes antes de publicarlas.

## Requisitos

Node.js 18 o más reciente. Google Chrome o Microsoft Edge instalado (Edge ya viene en Windows). Para usar otro navegador basado en Chromium, apunta `CHROMIUM_PATH` a su ejecutable.

## Ejecutar desde el código

Para descargar el código de GitHub y ejecutarlo, cambiarlo o enviar una corrección, consulta [CONTRIBUTING.es.md](https://github.com/RuBeNsMoTa13/screendocs/blob/main/CONTRIBUTING.es.md).

## Licencia

MIT
