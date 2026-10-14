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

Antes de publicar, dá para testar localmente com `npm link` e depois `screendocs https://seu-site.com` em qualquer pasta.
