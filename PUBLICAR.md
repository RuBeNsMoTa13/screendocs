# Como publicar o screendocs no npm (uma vez)

1. Crie uma conta grátis em https://www.npmjs.com/signup
2. Nesta pasta, rode:

```
npm login
npm publish
```

Pronto: qualquer pessoa já consegue rodar `npx screendocs https://site.com`.

Para lançar uma versão nova depois de mudar o código:

```
npm version patch
npm publish
```

## Instalador do Claude Desktop (.mcpb)

A cada versão, crie a tag e envie para o GitHub:

```
git push --follow-tags
```

(`npm version patch` já cria a tag `v0.1.1`.) O GitHub Actions gera o `screendocs.mcpb` e cria o Release sozinho. O link para baixar a versão mais recente é sempre:

https://github.com/RuBeNsMoTa13/screendocs/releases/latest/download/screendocs.mcpb

Para gerar o arquivo no seu PC sem publicar: `npm run build:mcpb` (sai em `dist/screendocs.mcpb`).

Antes de publicar, dá para testar localmente com `npm link` e depois `screendocs https://seu-site.com` em qualquer pasta.
