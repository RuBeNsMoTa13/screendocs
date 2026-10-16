# Como publicar o screendocs no npm

## Primeira versão (0.1.0)

O `package.json` já está em `0.1.0`. Na pasta do projeto, com a `main` atualizada (`git pull`):

```
npm login
npm pack --dry-run
npm publish
git tag v0.1.0
git push origin v0.1.0
```

O `npm pack --dry-run` mostra o que vai para o npm: só `bin/`, `src/`, os READMEs, o `LICENSE` e o `package.json`.

Pronto: qualquer pessoa já consegue rodar `npx screendocs https://site.com`.

## Versões seguintes

Depois de mudar o código:

```
npm version patch
npm publish
git push --follow-tags
```

(`npm version patch` sobe a versão no `package.json`, faz o commit e cria a tag, por exemplo `v0.1.1`.)

## Instalador do Claude Desktop (.mcpb)

Ao enviar a tag para o GitHub, o GitHub Actions gera o `screendocs.mcpb` e cria o Release sozinho. A tag precisa ser igual à versão do `package.json`. O link para baixar a versão mais recente é sempre:

https://github.com/RuBeNsMoTa13/screendocs/releases/latest/download/screendocs.mcpb

Para gerar o arquivo no seu PC sem publicar: `npm run build:mcpb` (sai em `dist/screendocs.mcpb`).

Antes de publicar, dá para testar localmente com `npm link` e depois `screendocs https://seu-site.com` em qualquer pasta.
