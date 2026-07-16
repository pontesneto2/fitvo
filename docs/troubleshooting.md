# Troubleshooting — ambiente local

Armadilhas conhecidas do setup local, com **sintoma** e **causa**. Todas custam
tempo justamente porque o erro que aparece aponta para o lugar errado.

---

## 1. Porta 5432: o repo conecta no banco ERRADO, silenciosamente

**Sintoma**

```
Error: P1000: Authentication failed against database server,
the provided database credentials for `fitvo` are not valid.
```

...com a credencial **correta**. Pior: `docker exec fitvo-postgres psql -U fitvo`
funciona normalmente, e `docker logs fitvo-postgres` **não registra tentativa
nenhuma** de conexão.

**Causa**

A 5432 é a porta padrão do Postgres, e uma instalação **nativa** na máquina
(comum no macOS) a ocupa em `127.0.0.1`. O Docker publica em `0.0.0.0:5432` sem
conflito aparente — o container **sobe normalmente** — mas conexões a
`localhost:5432` são atendidas pelo binding mais específico, o Postgres **nativo**.
Ou seja: a aplicação fala com outro banco, que por acaso não tem o usuário
`fitvo` (daí o erro de autenticação enganoso).

`lsof -nP -iTCP:5432 -sTCP:LISTEN` pode **não mostrar** o processo nativo se ele
rodar sob outro usuário — o que reforça a impressão errada de que a porta está
livre.

**Solução (já aplicada no repo)**

O `docker-compose.yml` e todos os `.env.example` usam a **5434**, não a 5432:

```bash
docker compose -f docker/docker-compose.yml up -d postgres
# -> 0.0.0.0:5434->5432/tcp

DATABASE_URL=postgresql://fitvo:change-me@localhost:5434/fitvo?schema=public
```

Para usar outra porta, `POSTGRES_PORT` continua funcionando
(`POSTGRES_PORT=5440 docker compose -f docker/docker-compose.yml up -d postgres`)
— mas **não volte para a 5432** sem confirmar que não há Postgres nativo.

**Como confirmar que você está no banco certo**

```bash
docker logs fitvo-postgres --tail 5     # a tentativa de conexao aparece aqui?
docker ps --format '{{.Names}}\t{{.Ports}}' | grep postgres
```

Se a falha de auth **não** aparece nos logs do container, você não está falando
com ele.

> O Redis (6379) **não** tem esse problema hoje — verificado sem colisão. Se um
> dia der o mesmo sintoma, a causa e a solução são as mesmas (`REDIS_PORT`).

---

## 2. `pnpm install` falha — e com `--silent` falha sem dizer nada

**Sintoma**

```
ERR_PNPM_UNSUPPORTED_ENGINE  Unsupported environment (bad pnpm and/or Node.js version)
Expected version: >=22.12
Got: v20.x.x
```

Com `pnpm install --silent`, **não imprime nada** e o comando seguinte quebra por
falta de `node_modules` — o que faz parecer outro problema.

**Causa**

O `package.json` exige `node >=22.12` (`engines`), mas o shell pode abrir com uma
versão mais antiga por padrão.

**Solução**

O `.nvmrc` já fixa a versão. Carregue o nvm **antes** de qualquer `pnpm`/`prisma`:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use   # le o .nvmrc
node -v   # deve ser >= v22.12
```

---

## 3. `npx prisma` baixa o Prisma 7 — que está fora do projeto de propósito

**Sintoma**

Comandos do Prisma rodam numa versão diferente da do projeto:

```
Prisma CLI Version : 7.8.0     # <- errado
```

**Causa**

`npx prisma` resolve da rede e pega a **última** versão. O projeto está no
**6.19.3**: a migração para o Prisma 7 (`prisma.config.ts` + `@prisma/adapter-pg`)
é mudança arquitetural na forma como o `PrismaClient` é instanciado em toda a
API/worker, e está **deliberadamente adiada** (ver `docs/roadmap.md`,
BLOQUEADO — RESPONSÁVEL).

**Solução**

Use sempre o binário do workspace:

```bash
pnpm exec prisma --version   # -> prisma : 6.19.3
pnpm exec prisma validate
pnpm exec prisma migrate dev
```

Ou os scripts do package: `pnpm --filter @fitvo/database db:migrate`.

---

## 4. `prisma migrate reset` pede consentimento explícito

**Sintoma**

O comando não roda e pede a variável `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

**Causa**

É uma trava do Prisma contra agentes de IA apagarem banco sem autorização
humana. Não é bug.

**Solução**

Em banco de desenvolvimento descartável, rode você mesmo o comando. Prefira
`DELETE` cirúrgico dos dados de teste a um reset completo — e nunca contorne a
trava em nada que não seja um banco local descartável.
