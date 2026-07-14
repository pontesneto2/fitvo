# Contribuindo — FITVO

> ⚠️ **Repositório PÚBLICO.** O repositório Git existe e é público
> (`github.com/pontesneto2/fitvo.git`). Higiene de segredos é obrigatória:
> nunca commitar `.env`/segredos, sempre `.gitignore` antes de qualquer arquivo,
> e **nenhum push/deploy sem autorização explícita** do responsável. Ver o aviso
> de segurança no topo do `CLAUDE.md`.

## Conventional Commits

Formato: `tipo(escopo): descrição curta no imperativo`

**Tipos:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`,
`chore`, `style`, `revert`.

**Escopo:** o app ou package afetado — ex.: `api`, `mobile`, `web-personal`,
`web-admin`, `site`, `worker`, `auth`, `payments`, `ai`, `database`, `ui-web`,
`ui-mobile`, `contracts`, etc.

Exemplos:
```
feat(auth): adiciona rotação de refresh token
fix(payments): corrige cálculo de split em centavos
refactor(api): extrai repositório de bond para o domínio
docs(adr): registra decisão de paginação híbrida
chore(config): adiciona editorconfig
```

Regra de escopo por PR: **um escopo por branch/PR**. Não misturar mobile, API,
web, admin, landing, banco e infraestrutura na mesma alteração, salvo
autorização explícita. Se a worktree ficar suja ou misturada, parar e
classificar as mudanças antes de continuar.

## Branches

Uma branch por escopo. Padrão de nome:
```
tipo/escopo-descricao-curta
```
Exemplos: `feat/auth-refresh-rotation`, `fix/payments-split-centavos`,
`chore/ci-github-actions`.

## Pull Requests

- Pequenos e focados (um escopo).
- Título no padrão Conventional Commits.
- Descrição com: o que muda, por que, o que foi validado, o que ficou pendente.
- Referência ao ADR quando a mudança for arquitetural.

## CI obrigatório (bloqueia merge)

Nenhum PR faz merge se qualquer etapa falhar:
`lint` · `typecheck` · `testes` · `build` · `security scan` · `dependency scan`.

## Regras de segurança do repositório

- Nunca commitar segredos: senha, token, cookie, `DATABASE_URL`, `.env`,
  certificado, keystore, chave privada.
- Nunca usar `git add .` — adicionar arquivos explicitamente.
- Nunca commitar arquivos sensíveis.
- Nunca publicar deploy, build de loja ou submit sem autorização explícita.
- Nunca rodar comandos destrutivos de banco (migrate reset, db push, drop,
  truncate, delete em massa) sem autorização explícita.
