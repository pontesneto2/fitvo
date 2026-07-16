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

## 4. CI verde **não** prova que a migração aplica

**Sintoma**

Tudo verde no PR, e o `prisma migrate deploy` quebra no deploy — ou no primeiro
`pnpm db:migrate` de quem acabou de clonar o repo.

**Causa**

Os jobs de `lint`, `typecheck`, `test` e `build` **não tocam banco**. Eles provam
que o código compila e passa nos testes, **não** que a cadeia de migrações
aplica. Dois furos passavam batido:

1. uma migração quebrada ou fora de ordem — ninguém aplica a cadeia do zero;
2. **drift**: alguém edita o `schema.prisma` e esquece de gerar a migração. O
   código continua compilando (o client é gerado do schema), então **todo o CI
   fica verde** — e o erro só aparece quando o banco real é migrado.

**Solução (já aplicada)**

O CI tem um job **`migrate`** que sobe um Postgres em container e faz as duas
verificações: aplica a cadeia num banco vazio (`migrate deploy`) e compara
schema × migrações (`migrate diff --exit-code`). Antes dele, o verde mentia sobre
a migração.

**Ao mexer no schema, rode o mesmo localmente antes de abrir o PR:**

```bash
docker exec fitvo-postgres psql -U fitvo -d fitvo -c 'CREATE DATABASE verify;'
export DATABASE_URL="postgresql://fitvo:fitvo@localhost:5434/verify?schema=public"
pnpm --filter @fitvo/database exec prisma migrate deploy       # aplica do zero
pnpm --filter @fitvo/database exec prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://fitvo:fitvo@localhost:5434/verify_shadow?schema=public" \
  --exit-code                                                  # 0 = sem drift
docker exec fitvo-postgres psql -U fitvo -d fitvo -c 'DROP DATABASE verify;'
```

> O shadow database precisa ser **outro banco**: o Prisma o usa como rascunho e
> o reinicia.

## 5. Teste de guard (401/403) que passa a provar validação — e continua verde

**Sintoma**

Um teste afirma `401` (sem autenticação) ou `403` (sem permissão), continua
**verde**, e não prova mais nada: ele passou a exercitar a **validação de
schema**, não o guard.

**Causa**

No Fastify, a **validação do `schema` da rota roda ANTES do handler**. Se o
`payload` do teste ficar inválido — tipicamente porque um campo **novo e
obrigatório** foi adicionado ao body e o teste não foi atualizado —, a requisição
morre em `400` antes de chegar ao guard.

E o teste que espera `401` **quebra ruidosamente** (bom). O perigoso é o inverso:
um teste que espera `400` para "campo faltando" continua verde **mesmo se o guard
sumir**, porque a validação responde primeiro.

**Regra**

> **Teste de guard precisa de payload VÁLIDO.** O único campo que pode faltar num
> teste de `401`/`403` é a credencial.

Ao adicionar campo obrigatório num body, varra os testes daquela rota: os que
mandam payload parcial mudam de significado sem mudar de cor.

**Exemplo real** (D-101, modalidade obrigatória no convite):

```ts
const unauthorized = await app.inject({
  method: 'POST',
  url: `/v1/patients/${TENANT}/invites`,
  // Body VALIDO de proposito: sem `modality` o schema rejeitaria com 400
  // antes do guard, e o teste passaria a provar validacao em vez do 401.
  payload: { email: 'p@fitvo.dev', specialtyId: SPECIALTY, modality: 'ONLINE' },
});
expect(unauthorized.statusCode).toBe(401);
```

> É o mesmo gênero de problema da seção 4 (drift) e da seção 6 (vacuidade):
> **verde que mente**. Um check só vale se você souber o que ele reprova.

## 6. Asserção sobre relação AUSENTE sem a relação no `include` — passa por vacuidade

**Sintoma**

Um check afirma que uma relação **não** existe, fica verde, e não prova nada:

```ts
const loaded = await prisma.anamnesis.findUniqueOrThrow({
  where: { id },
  include: { parq: true }, // <- `lifestyle` NAO esta aqui
});
expect(loaded.lifestyle).toBeUndefined(); // VERDE — e vazio
```

**Causa**

O Prisma só devolve a relação **pedida no `include`**. A relação não pedida vem
`undefined` **sempre** — a asserção fala sobre a *forma da query*, não sobre o
banco. Ela passaria **idêntica** se a linha existisse. O check não tem como falhar,
logo não reprova nada.

A distinção que importa:

- **`undefined`** = não perguntei (ausente do `include`).
- **`null`** = perguntei e não existe. **Só este** é o dado.

**Regra**

> Para afirmar que uma seção/relação está **ausente**, ela precisa estar no
> `include` e a asserção precisa ser contra **`null`**, nunca `undefined`. E
> ancore contra uma relação **presente** no mesmo objeto — se as duas dessem o
> mesmo resultado, o teste estaria quebrado.

```ts
const loaded = await prisma.anamnesis.findUniqueOrThrow({
  where: { id },
  include: { parq: true, lifestyle: true }, // as DUAS pedidas
});
expect(loaded.lifestyle).toBeNull(); // secao ausente = linha ausente
expect(loaded.parq).not.toBeNull(); // ancora: prova que o include funciona
```

**Procedência**

Este caso foi cometido **no PR que escreveu a seção 5 acima** — o autor aplicou a
disciplina ao código de produção e não ao próprio check, no mesmo arquivo, no
mesmo dia. Fica registrado com a procedência de propósito: **o padrão não se
aplica sozinho, nem para quem acabou de escrevê-lo.** A pergunta certa nunca é
"ele passa?", e sim **"o que este check reprova?"** — um check que não consegue
falhar já falhou.

## 7. `prisma migrate reset` pede consentimento explícito

**Sintoma**

O comando não roda e pede a variável `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

**Causa**

É uma trava do Prisma contra agentes de IA apagarem banco sem autorização
humana. Não é bug.

**Solução**

Em banco de desenvolvimento descartável, rode você mesmo o comando. Prefira
`DELETE` cirúrgico dos dados de teste a um reset completo — e nunca contorne a
trava em nada que não seja um banco local descartável.
