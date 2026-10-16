# Ejecutar screendocs desde el código

Esta guía es para quien descarga el código de GitHub para ejecutarlo, cambiarlo o mandar una corrección. Para solo usar screendocs, nada de esto hace falta: basta con `npx screendocs`, y el [README](README.es.md) lo explica todo.

[English](CONTRIBUTING.md) · [Português](CONTRIBUTING.pt-BR.md)

## Ejecutar

Necesitas Node.js 18 o más nuevo y Chrome o Edge instalado.

```bash
git clone https://github.com/RuBeNsMoTa13/screendocs.git
cd screendocs
npm install
node bin/screendocs.mjs https://tu-sitio.com
```

Para escribir `screendocs` en cualquier carpeta, como si viniera de npm, ejecuta `npm link` una vez dentro de la carpeta del código. Desde ahí, cada cambio en el código vale en el momento. `npm unlink -g screendocs` lo deshace.

Define `SCREENDOCS_DEBUG=1` para ver el error completo cuando algo falle.

## Qué cambia al ejecutarlo desde el código

Nada en el comportamiento: lee y guarda lo mismo que el paquete de npm. La diferencia es dónde estás cuando lo ejecutas.

- **En la carpeta donde ejecutas el comando**, crea solo `screendocs-output/` (las capturas). Si lo ejecutas dentro de la carpeta del código, aparece en el repositorio; el `.gitignore` del repositorio ya la deja fuera, junto con `dist/`.
- **En tu carpeta de usuario**, `~/.screendocs/` guarda tus valores (`config.json`), los inicios de sesión de los sitios (`auth/`) y, cuando no hay almacén de contraseñas del sistema, las claves de API guardadas (`keys.json`). Los archivos temporales, como la prueba del codificador de video, van a la carpeta temporal del sistema. Es la misma carpeta que usa el paquete de npm, así que una prueba desde el código cambia tus valores de verdad. Para probar sin tocarlos, apunta a otro lugar:

```bash
SCREENDOCS_HOME=/tmp/sd-prueba node bin/screendocs.mjs config
```

## De dónde viene cada opción

Cada capa reemplaza a la de abajo (`loadConfig` en `src/config.mjs`):

1. `DEFAULTS` en `src/config.mjs`: los valores de fábrica. Cámbialos aquí para cambiar lo que recibe todo el mundo.
2. Los valores del usuario, `~/.screendocs/config.json`, guardados por `screendocs config` (`src/userconfig.mjs`, `src/configcmd.mjs`).
3. El `screendocs.config.json` de la carpeta donde se ejecuta, o el archivo pasado con `--config`.
4. Las opciones escritas en el comando.

`describe` y `model` dicen los dos quién escribe las descripciones, así que una capa que define uno borra el otro de las capas de abajo.

## Dónde está cada cosa en el código

| Archivo | Qué hace |
|---|---|
| `bin/screendocs.mjs` | punto de entrada; llama a `run()` |
| `src/cli.mjs` | lee el comando, el `--help` en los tres idiomas, ejecuta la captura |
| `src/interactive.mjs` | el menú (`npx screendocs` sin enlace); cada pregunta es un paso, `Esc` vuelve |
| `src/hud.mjs`, `src/theme.mjs` | la apariencia del menú: las teclas debajo de cada pregunta y los colores |
| `src/config.mjs` | valores de fábrica y el orden de las capas |
| `src/userconfig.mjs`, `src/configcmd.mjs` | los valores del usuario y `screendocs config` |
| `src/i18n.mjs` | idioma de la terminal (`SCREENDOCS_LANGUAGE`, elección guardada, idioma de la computadora) |
| `src/checkurl.mjs` | comprueba que la dirección abre y sugiere correcciones |
| `src/discover.mjs` | encuentra las páginas siguiendo los enlaces |
| `src/browser.mjs`, `src/capture.mjs`, `src/mask.mjs` | abre Chrome o Edge, toma las capturas y videos, difumina datos personales |
| `src/login.mjs`, `src/session.mjs`, `src/paths.mjs` | inicio de sesión en los sitios y la sesión guardada |
| `src/report.mjs` | `screens.json`, `prompt.md`, el informe HTML y `for-ai/` |
| `src/agents.mjs`, `src/chat.mjs`, `src/providers.mjs` | descripciones con una herramienta de IA instalada, un chat en el navegador o una API |
| `src/answers.mjs` | encuentra una captura anterior y le pone las respuestas de la IA (`screendocs describe`) |
| `src/secrets.mjs` | claves guardadas: Keychain, Windows (DPAPI), `secret-tool` o `keys.json` |
| `src/docs.mjs` | lee `--docs` (texto, PDF, Office) para la IA |
| `src/mcp.mjs` | el servidor MCP (`screendocs mcp`) |
| `scripts/build-mcpb.mjs`, `mcpb/` | el instalador de Claude Desktop (`npm run build:mcpb`) |

Todo texto que ve el usuario está escrito en inglés, portugués y español, junto al código que lo muestra. Al crear o cambiar uno, escribe los tres.

## Mandar un cambio

1. Crea una rama, haz el cambio y pruébalo con `node bin/screendocs.mjs` en un sitio real.
2. Si cambia una opción, una pregunta del menú o lo que aparece en la terminal, actualiza también `README.md`, `README.pt-BR.md` y `README.es.md`.
3. Abre un pull request que diga qué estaba mal antes y qué pasa ahora.

La publicación en npm está en [PUBLICAR.md](PUBLICAR.md).
