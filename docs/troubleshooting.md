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

> **Quem roda migração em dev.** Enquanto não houver produção com dado real, o
> agente PODE aplicar migrations **forward** sozinho (`prisma migrate deploy` /
> `migrate status`) para provar que a cadeia aplica. `migrate reset`, `DROP`,
> `TRUNCATE`, `DELETE` em massa e qualquer migration **destrutiva** continuam
> exigindo o responsável, **mesmo em dev**. Quando existir produção com dado
> real, religar o bloqueio total de banco para o agente (ver `CLAUDE.md`,
> "Banco em DEV/MVP").

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

## 7. `git diff main branch` NÃO responde "posso deletar esta branch?"

**Sintoma**

Você quer saber se uma branch já mergeada pode ser removida. Roda o diff e vê
centenas de arquivos diferentes:

```bash
git diff origin/main origin/feat/velha --stat
# 286 files changed, 154 insertions(+), 25153 deletions(-)
```

Conclusão intuitiva: *"tem muita coisa exclusiva, não posso deletar"*. **Errado
— e o inverso também acontece.**

**Causa**

`git diff A B` (dois pontos) compara os **estados finais** de A e B. Ele acusa
diferença **nos dois sentidos** — inclusive tudo o que a `main` ganhou e a
branch **não tem**. Uma branch velha e totalmente mergeada acusa milhares de
linhas de diferença **só por estar atrás**. O diff responde *"os dois lados são
iguais?"*, e a pergunta era outra.

**Regra**

> Para saber o que uma branch tem de **exclusivo**, use **três pontos**:
> `git diff A...B` compara B contra o **merge-base** — o que a branch adicionou
> desde que divergiu. Vazio = não contribui nada.

```bash
git diff origin/main...origin/feat/velha        # vazio = seguro deletar
git rev-list --count origin/main..origin/feat/velha   # quantos commits exclusivos
git merge-base --is-ancestor origin/feat/velha origin/main && echo "ja na main"
```

**Caso real**

Uma branch acusava 286 arquivos no diff de dois pontos. No de três pontos: vazio.
Os 2 commits exclusivos eram um commit de doc **e o revert dele** — somavam zero.
O teste errado quase preservou lixo; o mesmo erro, com o sinal trocado, **deleta
trabalho**. É `git diff` respondendo com precisão a uma pergunta que você não fez.

## 8. `2>/dev/null` num comando de git esconde a falha, e você trabalha sobre a base errada

**Sintoma**

Você cria uma branch a partir da `main`, o comando não reclama, e horas depois
descobre que a base estava velha — sem nenhum dos merges recentes.

**Causa**

Num **worktree**, `git checkout main` **falha** se a `main` já está em uso por
outro worktree (o principal, tipicamente):

```
fatal: 'main' is already used by worktree at '/Users/.../fitvo'
```

Com `git checkout main 2>/dev/null`, esse `fatal` **desaparece**. O `git pull`
seguinte atualiza outra coisa, e o `git checkout -b nova` sai de onde o HEAD
estiver — **uma base antiga**. Nada avisa. O CI fica verde, porque o código está
correto: só está construído sobre a árvore errada.

**Regra**

> Nunca silencie o `stderr` de um comando de git. Ele não é ruído: é o único
> lugar onde o git diz que não fez o que você pediu.

E, ao criar branch, **confirme a base em vez de assumi-la**:

```bash
git fetch origin
git checkout -b nova origin/main          # explicito, nao depende do HEAD atual
git rev-parse --short HEAD origin/main    # os dois tem que bater
```

> Primo das seções 4, 5 e 6, com a mecânica invertida. Lá o check **não
> conseguia falhar** (nada foi reprovado porque nada podia reprovar). Aqui a
> falha **aconteceu** — o git disse `fatal:` — e foi jogada fora antes de chegar
> aos seus olhos. Nos dois casos o resultado é o mesmo: verde que não significa
> nada. Silenciar erro de git é desligar o alarme porque ele estava apitando.

## 9. `git reset --hard origin/main` apaga a branch em que você está

**Sintoma**

Você quer voltar a `main` para começar outra branch. Roda o reset, cria a branch
nova, trabalha. Depois volta à branch anterior e **o commit sumiu** — mesmo sem
nunca ter rodado nada que "apagasse" nada.

**Causa**

`git reset --hard <alvo>` **não te leva** ao alvo: ele **move o ponteiro da branch
atual** para lá. Se você está em `feat/x` e roda `git reset --hard origin/main`, a
`feat/x` **passa a apontar para a main** — os commits dela saem do caminho e só
sobrevivem no reflog.

O `git checkout -b nova origin/main` seguinte funciona e mascara o estrago: a
branch nova nasce certa, e a antiga só se revela destruída quando você volta nela.

**Regra**

> `reset --hard` age na **branch atual**, não no alvo. Confirme onde você está
> **antes**, e prefira o comando que não depende disso:

```bash
git branch --show-current                  # ONDE eu estou?
git checkout -b nova origin/main           # nao precisa de reset nenhum
git fetch origin && git switch -d origin/main   # se quer so olhar a main
```

**Se já aconteceu, o reflog recupera:**

```bash
git reflog | head              # acha o SHA anterior ao reset
git reset --hard <sha-antigo>  # devolve a branch
# ou, se ja tinha empurrado:
git reset --hard origin/feat/x
```

**Caso real**

Aconteceu nesta sessão: um `reset --hard origin/main` rodado **de dentro** de uma
branch de PR moveu o ponteiro dela e descartou o commit localmente. **Nada se
perdeu só porque o `push` tinha acontecido antes** — o remoto era a cópia
sobrevivente. O acaso foi o backup.

> Fecha a família das seções 7, 8 e 9: **comando destrutivo cujo alvo não foi
> confirmado**. A 7 lê o diff errado e conclui errado; a 8 joga fora o erro que
> avisaria; a 9 age sobre um alvo que não é o que você pensou. Nos três, a
> ferramenta obedeceu com precisão — a uma pergunta que não era a sua.

## 10. `timestamp` → `timestamptz`: o Prisma gera o `ALTER` SEM `USING`, e isso corrompe dado

**Sintoma**

Você troca `DateTime` para `@db.Timestamptz(3)`, gera a migração, o CI fica verde,
a migração aplica sem erro — e **os horários de quem tinha dados andam algumas
horas**. Ninguém vê nada quebrar: só os valores estão errados.

**Causa**

O Prisma emite:

```sql
ALTER TABLE "x" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);
```

**Sem `USING`.** E sem `USING`, o Postgres interpreta o valor existente como
**hora local da SESSÃO** — não como UTC. Se a sessão que roda a migração não
estiver em UTC, todo o histórico desloca.

**Verificado** — mesmo valor gravado como `14:00 UTC`, migrado com a sessão em
`America/Sao_Paulo`:

| Conversão | Resultado |
|---|---|
| `SET DATA TYPE TIMESTAMPTZ(3)` (o que o Prisma gera) | **`17:00 UTC`** — 3h de corrupção |
| `... USING "createdAt" AT TIME ZONE 'UTC'` | **`14:00 UTC`** |

**Regra**

> **Toda** conversão de `timestamp` para `timestamptz` precisa de
> **`USING "coluna" AT TIME ZONE 'UTC'`** — explícito, em cada coluna. O Prisma não
> o gera; edite a migração à mão.

```sql
ALTER TABLE "x"
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';
```

**O princípio, que vale além deste caso**

O `USING` faz duas coisas, e a segunda importa mais:

1. Torna a conversão **independente da sessão**.
2. **DECLARA a premissa em vez de assumi-la:** *"o que está gravado aqui É UTC"*.

Sem ele, a migração está correta **por circunstância** — porque o servidor está em
UTC, porque o banco está vazio, porque ninguém rodou `SET TimeZone`. Nada disso
está escrito em lugar nenhum, e nada avisa quando deixa de valer.

> **Migração que funciona por circunstância é a mesma classe de defeito que o verde
> que mente** (seções 4/5/6). Nos dois casos algo passa, e nos dois casos o que
> passou não é o que você acha que foi verificado. A diferença é só que aqui o
> preço é dado corrompido em vez de bug não detectado.
>
> Quando uma condição é necessária para a correção, **escreva-a no código**. Se ela
> só existe na sua cabeça — ou no fuso do servidor —, ela não existe.

## 11. Rodar o comando DA FERRAMENTA em vez do comando DO PROJETO

**Sintoma**

Você roda a ferramenta direto para conferir o estado do repo, e ela **reprova**
algo que está no `main` verde:

```bash
pnpm exec prettier --check .
# [warn] packages/ui-web/gallery/index.html
# → vermelho
```

**Causa**

O comando do projeto **não é** o comando da ferramenta:

```jsonc
"format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,yml,yaml}\""
```

O escopo é **deliberado** — `.html` fica de fora (a galeria é markup manual, e o
prettier a reformataria). `prettier --check .` cobre **tudo** e reprova o que está
fora de escopo **de propósito**. O vermelho é real; o defeito, não.

**Regra**

> Rode **`pnpm format:check`**, `pnpm lint`, `pnpm test` — os scripts do
> `package.json`, que são o que o CI roda. Ao conferir um estado, use o comando do
> **projeto**, não o da ferramenta: eles têm escopos diferentes, e o da ferramenta
> não sabe o que foi excluído por decisão.

Se precisar rodar a ferramenta direto (para depurar), confira antes o escopo real:

```bash
grep -E '"(format|lint|test)' package.json
```

**Caso real**

`prettier --check .` deu vermelho em `gallery/index.html` e o agente quase
reportou "a `main` tem problema de formatação". `pnpm format:check` — o comando do
CI — dava **verde**. O agente estava errado, não a `main`.

> **Esta armadilha já pegou DUAS vezes** — a sessão que escreveu esta seção e a
> seguinte, que caiu no mesmo `.html` da galeria depois de já tê-la documentado. O
> hábito de rodar a ferramenta em vez do comando do projeto é **forte**: saber da
> armadilha não basta, porque `prettier --check .` é o reflexo, e o reflexo dispara
> antes da memória. A defesa é mecânica, não de vontade — **abrir o `package.json`
> e rodar o script**, sempre, mesmo "só para conferir".

> **Fecha o documento, e vale para todas as seções acima.** As seções 4, 5 e 6 são
> **verde que não prova nada**; esta é o espelho: **vermelho que não reprova nada**.
> A pergunta certa nunca foi *"passou?"* — e também não é *"falhou?"*. É:
>
> ### **"Qual pergunta este comando está respondendo?"**
>
> Um check só vale quando você sabe **o que ele reprova**. Se não sabe, a cor dele
> é decoração.

## 12. `prisma migrate reset` pede consentimento explícito

**Sintoma**

O comando não roda e pede a variável `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

**Causa**

É uma trava do Prisma contra agentes de IA apagarem banco sem autorização
humana. Não é bug.

**Solução**

Em banco de desenvolvimento descartável, rode você mesmo o comando. Prefira
`DELETE` cirúrgico dos dados de teste a um reset completo — e nunca contorne a
trava em nada que não seja um banco local descartável.

---

## 13. `outputs: null` no turbo = cache que reporta HIT restaurando ZERO arquivos

**Sintoma**

O CI da `main` fica **verde por sorte**. O mesmo código passa num PR e falha na
`main`, sem ninguém ter mudado nada. Não reproduz sob demanda — e por isso a
tentação é reexecutar o job até passar.

Localmente, o turbo afirma ter buildado sem ter produzido nada:

```
@fitvo/database:build: cache hit, replaying logs
 Tasks:    1 successful, 1 total
```

**Causa — dois defeitos, um sintoma**

**1. O turbo só captura o que está DENTRO do pacote.** O `prisma generate` sem
`output` explícito escreve em:

```
node_modules/.pnpm/@prisma+client@X/node_modules/.prisma/client   # virtual store COMPARTILHADO
```

Fora de `packages/database`, portanto **invisível ao turbo**. O `build` ficava com
`outputs: null` — o turbo cacheava um conjunto **vazio** de artefatos. **É verde
que mente em forma de cache:** `cache HIT, timeSaved: 1041` produzindo zero
arquivos.

**2. A defesa contra o cache mentiroso CRIOU a corrida.** Como ninguém podia
confiar que o `build` produzira algo, enxertou-se `prisma generate` também no
`typecheck` e no `test:integration`. E o grafo do turbo mostrava que
`database#build` e `database#typecheck` **não dependiam um do outro**:

```
@fitvo/database#build      command: prisma generate
                           dependsOn: [eslint-config#build, typescript-config#build]
@fitvo/database#typecheck  command: prisma generate && tsc --noEmit
                           dependsOn: [eslint-config#build, typescript-config#build]
```

Livres para rodar **em paralelo**, dois `generate` escrevendo no mesmo diretório.
`prisma generate` não escreve atomicamente: um **trunca enquanto o outro lê**.

> **O sintoma nasceu da cura.** É o padrão a reconhecer: a corrida não era o
> problema original — era o remendo do problema original. Procurar só a corrida
> leva ao remendo, não à doença.

**Solução — a ORDEM importa**

1. **Mover o output para dentro do pacote** (`output = "../src/generated/client"`).
2. **Declarar `outputs`** no `turbo.json` do pacote — agora o cache é honesto.
3. **Só então remover os `generate` redundantes** e fazer o `typecheck` depender
   do `build`.

**Fazer só o passo 3 transformaria flaky em quebra dura**: o `typecheck` perderia
seu `generate` e encontraria um cache HIT que não restaurou cliente nenhum.

**Como verificar (o loop NÃO basta)**

A corrida é **probabilística**: passadas verdes não provam nada — foi assim que a
`main` ficou "verde". Medido nesta base: **10/10 verdes no código SEM a
correção**, numa máquina que simplesmente não dispara o defeito. Um loop verde
teria "provado" que não havia bug.

> **O loop inconclusivo, reportado como inconclusivo, vale mais que "8/8 verde,
> provado".** Trazer só a branch corrigida passando teria repetido exatamente o
> erro da `main`: **chamar sorte de prova**. O baseline sem correção — 10/10 verde
> — é o que desmascara o loop: se o código quebrado também passa, o verde do código
> certo não vem da correção. Rode o baseline *antes* de comemorar o loop verde; sem
> o controle, o experimento não tem grupo de comparação e a cor não significa nada.

O que prova são duas coisas **determinísticas**:

1. **O grafo** (`turbo typecheck --dry=json`): a corrida é **estruturalmente
   impossível** quando só uma tarefa gera e as outras dependem dela. Prova por
   construção, não por amostragem.
2. **Cache HIT com o artefato APAGADO** — o inverso do defeito:

```bash
npx turbo build --filter=@fitvo/database   # gera
rm -rf packages/database/src/generated     # apaga
npx turbo build --filter=@fitvo/database   # cache hit
ls packages/database/src/generated/client/index.js   # DEVE existir
```

Antes da correção esse teste devolvia **replay vazio**: `1 successful` e nenhum
arquivo. Depois, o cliente é **restaurado**. Determinístico, nos dois sentidos.

> **Princípio geral:** tarefa cujo artefato o turbo não enxerga é tarefa cujo
> cache **mente**. Antes de aceitar `cache HIT`, pergunte **onde o artefato caiu**
> — se for fora do pacote, o HIT não significa nada.

---

## 14. Nem todo `DateTime` é instante — são TRÊS tipos de dado temporal

**Sintoma (o que dá errado se ignorar)**

Você modela toda data como `DateTime` e deixa o Prisma mapear para o default. Meses
depois: a data de nascimento de alguém "muda de dia" perto da meia-noite conforme o
fuso de quem consulta; ou um horário de atendimento "desliza uma hora" duas vezes
por ano. Nenhum erro aparece — o dado só fica **errado em silêncio**.

**Causa — três perguntas diferentes tratadas como uma**

"Data" não é um tipo só. O FITVO já bateu de frente com isso três vezes, e a regra
é: **o tipo da coluna tem que combinar com a natureza do dado.**

| Natureza | Exemplo | Tipo | Por quê |
|---|---|---|---|
| **Instante** | `Appointment.startsAt`, `createdAt` | `@db.Timestamptz(3)` | Um ponto único na linha do tempo. UTC no banco, convertido na exibição (ADR-0012, D-111). |
| **Data de calendário** | `Account.birthDate` | `@db.Date` | Ninguém nasce "às 00h UTC". Não tem hora nem fuso — é um dia no calendário. |
| **Janela recorrente** | `AvailabilityRule` | hora local (min) + `timezone` IANA | "Atendo 9h–18h" é hora de parede que se repete; guardar em UTC congela um offset e desliza no DST (ADR-0012, adendo do D-111). |

**Regra**

> **Converter cedo destrói informação.** O ADR-0012 provou isso do jeito difícil
> com a janela recorrente: guardar "9h no relógio dele" como UTC apaga o fato de
> que era 9h **local**. O mesmo vale para baixo: guardar uma data de nascimento
> como `timestamptz` inventa uma hora e um fuso que não existem, e reintroduz o
> deslize que o D-111 combate.

Antes de escrever `DateTime`, pergunte: **isto é um instante, um dia, ou uma regra
que se repete?** Três respostas, três tipos. `birthDate` é o primeiro `@db.Date` do
schema — não por acaso, e não deve ser o último tratado por reflexo como instante.

---

## 15. Redis fora do ar: a API **sobe**, mas o login quebra

O `docker compose` sobe Postgres **e** Redis. É fácil subir só o Postgres (ou o
container do Redis parar) e não perceber: a API **não** falha no boot por causa
disso — ela escuta na 3333 como se estivesse tudo certo.

**Sintoma**

- `pnpm --filter @fitvo/api dev` sobe normalmente, `/docs` responde e rotas sem
  sessão (ex.: `register/professional`) funcionam.
- Mas `POST /v1/auth/login` e `POST /v1/auth/refresh` **quebram** (erro/timeout),
  e o log da API mostra o `ioredis` tentando reconectar
  (`ECONNREFUSED 127.0.0.1:6379`).
- A leitura enganosa é _"a API subiu, então o ambiente está de pé — o login é que
  está bugado"_. Não está: falta o Redis.

**Causa**

Redis **não é cache opcional aqui — é onde a sessão vive.** O refresh token e a
revogação de sessão são persistidos no Redis (`RedisRefreshTokenStore` /
`RedisVerificationTokenStore`, ADR-0002/D-029). No login, o `startSession` grava
o refresh token no Redis; sem Redis, a gravação falha e a operação inteira cai. A
API sobe assim mesmo porque o `ioredis` conecta de forma preguiçosa e fica em
retry — a conexão só é **exigida** quando uma rota de auth a usa.

**Resolver**

```bash
docker compose -f docker/docker-compose.yml ps           # redis deve estar "healthy"
docker compose -f docker/docker-compose.yml up -d redis  # se faltou / caiu
redis-cli -p 6379 ping                                    # PONG
```

---

# Integrações externas

Armadilhas que não são do ambiente local, mas do **gateway/serviço de terceiros**.
Mordem na implementação, não no setup: o comportamento do provider não é o que a
intuição supõe, e o código escrito sobre a suposição fica errado em silêncio.

## 16. Asaas / split: a taxa incide sobre o `netValue`, e o estorno reverte tudo

**Sintoma**

Dois erros distintos, nenhum quebra nada — só dá número errado:

1. A receita projetada do FITVO vem **inflada**: o dashboard soma mais do que o
   Asaas de fato transfere.
2. A implementação de estorno assume que a taxa do FITVO **fica retida** e concilia
   um saldo que nunca existiu.

**Causa**

Duas premissas do split do Asaas que contrariam a intuição (fatos verificados,
ver ADR-0004 / D-018 e D-021):

1. **A taxa do Asaas é descontada ANTES do split.** O percentual do split incide
   sobre o `netValue`, **nunca sobre o valor bruto**. Numa cobrança de **R$ 200 no
   cartão** → o Asaas desconta **R$ 6,47** → `netValue` **R$ 193,53** → o split de
   2% do FITVO rende **R$ 3,87**, não R$ 4,00. Calcular sobre o bruto infla a
   receita esperada. A taxa do FITVO é margem limpa; o profissional absorve o custo
   do gateway.

2. **Estorno total reverte o split inteiro — taxa do FITVO incluída.** Em estorno
   total da cobrança, todas as contas que receberam saldo têm a transferência
   revertida, o FITVO entre elas. **Não é configurável** — é comportamento do
   gateway. A implementação de estorno **deve assumir isso**: a taxa volta, não há
   como retê-la dentro do split.

**Regra**

> O split do FITVO é **percentual sobre o `netValue`**, e o estorno **devolve a
> taxa**. Não calcule receita sobre o bruto, e não modele estorno supondo que a
> taxa fica. Os dois vêm do gateway, não da nossa configuração.

A decisão e as alternativas rejeitadas (cobrar a taxa fora do split para
preservá-la no estorno — rejeitado) estão em `docs/adr/0004-financeiro.md`. Este
registro é o que morde quem for **codar** o split: o ADR é a decisão; isto é a
consequência prática.

## 17. Escolher versão de dependência sem rodar o `osv-scanner` ANTES é decidir no escuro

**Sintoma**

O plano fixa uma versão (ex.: Next 14, "a estável compatível com React 18"), tudo
compila, o E2E passa, o PR abre — e o `dependency-scan` (osv-scanner) do CI reprova
por vulnerabilidade conhecida naquela versão. O retrabalho não é uma linha: é
reabrir a decisão de versão com o código já construído em cima dela.

**Causa**

`typecheck`/`lint`/`build`/E2E provam que o código **funciona** — não que a versão
é **segura**. Vulnerabilidade conhecida é ortogonal a "compila". O CI tem o gate
certo (`osv-scanner scan --lockfile=pnpm-lock.yaml`, ADR-0006), mas ele roda
**depois** do plano inteiro.

**Caso real (PR #62):** a escolha de **Next 14.2.35** (por casar com React 18, trava
do ui-web) foi reprovada — 14 advisories, 5 High (até CVSS 8.6, SSRF), **sem fix na
linha 14.x**, só em Next 15+. Custo: reabrir a versão do framework (Next 15, que
também aceita React 18), migrar `cookies()` para async, refazer gates e E2E. Tudo
evitável com um scan antes.

**O que fazer**

Antes de fixar a versão de uma dependência nova (ou subir major), rode o mesmo
scanner do CI **local**:

```bash
# osv-scanner na mesma versao do CI (ver .github/workflows/ci.yml)
./osv-scanner scan --lockfile=pnpm-lock.yaml   # exit 0 = sem vulnerabilidade
```

> A pergunta não é "compila com esta versão?" — é "esta versão tem vulnerabilidade
> conhecida?". O CI responde a segunda, mas tarde. Responda-a no plano, não no PR.

---

# Documentação e decisões (ADR)

## 18. Destilar o histórico num ADR pode APAGAR a força da decisão

**Sintoma**

Alguém lê só o ADR (a fonte viva), implementa conforme ele, e o resultado fica
"certo" contra o ADR e **verde** no CI — mas **viola a decisão original**. O ADR,
ao resumir o histórico, perdeu uma **palavra de força** (obrigatório, sempre,
nunca) e ninguém percebeu. Quem lê só o ADR nunca saberá que faltou algo.

**Causa**

O fluxo do projeto **destila** o histórico bruto (`docs/history/`) em ADRs.
Destilar é resumir — e resumo tende a **suavizar**. Só que palavra de força não é
ênfase retórica: é o **contrato**. "Verificação de e-mail **obrigatória**" e
"verificação de e-mail" são requisitos **diferentes** — a segunda permite não
enforçar; a primeira, não. Quando a força cai na síntese, a decisão enfraquece
**silenciosamente**, sem ninguém ter decidido enfraquecê-la.

**Caso real (D-029 / ADR-0002)**

O histórico (D-029, sob *"Medidas de segurança **obrigatórias**"*) diz literal:
*"Verificação de e-mail **obrigatória**."* O ADR-0002 destilou para
*"verificação de e-mail"* — **apagou "obrigatória"**. No código: o mecanismo de
verificação existe inteiro (`/verify-email`, `emailVerifiedAt`, `markEmailVerified`),
mas **nada enforça** — o login não checa `emailVerifiedAt`. A obrigação evaporou
na tradução.

**Regra**

> Ao destilar o histórico em ADR, palavras de força — **obrigatório, sempre,
> nunca, proibido, inegociável, apenas** — NÃO são ruído: são o contrato. Perdê-las
> na síntese enfraquece a decisão silenciosamente. Ao revisar um ADR contra o
> histórico, compare a **FORÇA**, não só o conteúdo.

**Classe de defeito (nova)**

Isto **não** é "decidido e não implementado" — o mecanismo existe. É "decidido e
**destilado errado**": o defeito nasce na **síntese**, não na implementação. Um
`grep` de conteúdo não pega (o assunto está lá); só a comparação de **força**
pega. Ao gerar ou revisar um ADR, o diff que importa contra o histórico é o das
palavras de força, não o dos tópicos.

## 19. ADR aceito não carrega estado de implementação

**Sintoma**

Um ADR **aceito** afirma que algo está "pronto", "estruturado" ou traz um
checkbox de tarefa — e o leitor não consegue dizer se aquilo foi **construído**
ou não. O estado real vive noutro lugar (ou em lugar nenhum). A decisão está
tomada, mas o ADR passou a responder também a pergunta errada ("foi feito?"), e
responde mal.

**Causa**

ADR e roadmap respondem perguntas diferentes. O **ADR** responde *"o que foi
decidido e por quê"* (é atemporal: uma vez aceito, a decisão vale até ser
revisada por outro ADR). O **roadmap** responde *"o que foi construído e o que
falta"* (muda a cada PR). Quando o ADR absorve linguagem de estado de
implementação — um `- [ ]`, um "estrutura pronta", um "a ativar" — ele passa a
carregar informação **volátil** num documento **atemporal**. Ninguém atualiza o
ADR quando o código muda (o roadmap é que se atualiza), então a frase congela num
estado que pode já não ser verdade. Um checkbox vazio é o pior caso: em decisão
aceita, `- [ ]` não diz "não feito" nem "feito" — diz **"ninguém sabe"**.

**Caso real (D-030 / ADR-0002 — MFA)**

O ADR-0002 (aceito) lista *"estrutura pronta para MFA (ativação pós-MVP,
começando por admin de clínica e médico)"*. "Estrutura pronta" sugere que algo
foi construído — mas o leitor do ADR não tem como saber o quê. Só cruzando com o
roadmap (item 2, PR #7: *"MFA (D-030) ... deferido"*) se descobre que **não foi
construído**. O ADR afirmou implementação sem provar; a verdade estava só no
roadmap. (Não havia checkbox literal aqui — a ambiguidade veio da **prosa de
estado**; a regra cobre as duas formas.)

**Regra**

> ADR aceito **não** usa checkbox de implementação nem prosa de estado
> ("pronto", "estruturado", "a ativar"). Ou a decisão está tomada — e o **estado
> de implementação vive no roadmap** —, ou o ADR não deveria estar aceito.
> Checkbox vazio (ou "estrutura pronta") em ADR aceito é **ambiguidade
> permanente**: descreva a decisão no ADR, o progresso no roadmap, e nunca
> misture os dois.

---

## 20. RLS (D-152, ADR-0017 Slice 3/3): dois roles de banco, nunca um só

**Sintoma**

Testes de integração passam mesmo com uma policy RLS quebrada, ou o app
conecta e nada muda de comportamento depois de habilitar `ENABLE ROW LEVEL
SECURITY` numa tabela.

**Causa**

RLS só protege se a conexão **não** for superuser nem tiver `BYPASSRLS`
(Postgres ignora toda policy para essas conexões, silenciosamente — sem erro,
sem aviso). O role de dev local (`fitvo`) é superuser desde sempre (usado por
migrations, seeds, `db:studio`). Se a app/testes continuarem conectando como
`fitvo`, o RLS existe no schema mas nunca roda — "RLS de teatro".

**Solução**

Dois roles, dois papeis, nunca compartilhados:

- `fitvo` (privilegiado, superuser): **só** para `prisma migrate`/`db:studio`
  (`packages/database/.env`). Só ele pode criar/alterar policy.
- `fitvo_app` (sem `BYPASSRLS`/`SUPERUSER`): runtime da API e do worker
  (`apps/api/.env`, `apps/worker/.env`, var `DATABASE_URL`). CRUD normal nas
  tabelas, sujeito a TODAS as policies de tenant.
- `fitvo_webhook` (idem, sem bypass): runtime SÓ do webhook Asaas e da régua de
  cobrança do worker (var `WEBHOOK_DATABASE_URL`) — os dois únicos fluxos que
  legitimamente atravessam tenant (atualizam `charge`/`subscription` por id
  externo, sem `tenantId` conhecido a priori). Autorizado por uma policy
  PERMISSIVA adicional, só nessas 2 tabelas, só nos comandos que usa
  (`SELECT`/`UPDATE`) — nunca um GRANT amplo.

Criar os dois roles é DDL fora de migration do Prisma (CREATE ROLE não viaja
em `migration.sql` — é passo de infra por ambiente, não schema). Rode uma vez
por ambiente:

```sql
CREATE ROLE fitvo_app WITH LOGIN PASSWORD '<gerada>'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA public TO fitvo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fitvo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fitvo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fitvo IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fitvo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fitvo IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fitvo_app;

CREATE ROLE fitvo_webhook WITH LOGIN PASSWORD '<gerada>'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA public TO fitvo_webhook;
GRANT SELECT, UPDATE ON charge, subscription TO fitvo_webhook;
```

**Rodando `test:integration` (`packages/database`) contra o role certo**

O pacote não carrega `.env` para os testes (só o Prisma CLI carrega `.env`
automaticamente, para migrations) — `vitest` usa o que estiver exportado no
shell. Exporte ANTES de rodar:

```bash
export DATABASE_URL="postgresql://fitvo_app:<senha>@localhost:5434/fitvo?schema=public"
export WEBHOOK_DATABASE_URL="postgresql://fitvo_webhook:<senha>@localhost:5434/fitvo?schema=public"
pnpm --filter @fitvo/database test:integration
```

`tenant-rls.integration.test.ts` verifica o role ANTES de rodar (consulta
`pg_roles.rolbypassrls`/`rolsuper`) e lança erro claro se detectar um role
privilegiado — prefere falhar alto a dar falso-verde. Os blocos que dependem
de `WEBHOOK_DATABASE_URL` pulam (`describe.skipIf`) se a var não estiver
setada, em vez de quebrar quem não precisa deles.

**Se um teste/fluxo quebrar depois de trocar para `fitvo_app`:** é o role
revelando onde o código assumia privilégio de superuser — reporte e conceda o
GRANT específico que faltou. Nunca volte pro role privilegiado como atalho.

---

## 21. Agentes em paralelo: território disjunto, schema serializado, `pnpm install` antes do gate

**Sintoma**

Três coisas que aparecem quando mais de uma sessão trabalha no repo ao mesmo
tempo, e que parecem bugs mas são coordenação faltando:

1. Dois agentes editam o mesmo arquivo em worktrees diferentes; o segundo PR
   nasce com conflito que ninguém pediu.
2. Duas migrations do Prisma criadas em paralelo. Cada uma aplica sozinha; a
   segunda a mergear falha ou gera **drift**, porque foi gerada contra um schema
   que não incluía a primeira.
3. Depois de mergear, a `main` "fica vermelha": `pnpm typecheck`/`test` quebra
   com módulo não encontrado, num pacote que a sua mudança nem tocou.

**Causa**

Os três têm a mesma raiz — **estado compartilhado que o git não versiona**.

1. Worktree isola o **checkout**, não o **arquivo lógico**. Dois agentes no
   mesmo arquivo colidem exatamente como colidiriam sem worktree.
2. A migration do Prisma é gerada **contra o schema atual**, e o nome carrega
   ordem (`<timestamp>_nome`). Duas geradas em paralelo produzem duas cadeias
   que nunca se viram. Não é conflito de texto — o git **mergeia limpo** os dois
   arquivos e o estrago só aparece ao aplicar.
3. O terceiro é o que mais engana. Quando **outro** merge adiciona um pacote ou
   uma dependência entre pacotes do workspace, o `node_modules` do **seu**
   worktree não ganha o symlink correspondente — `pnpm-lock.yaml` mudou, seu
   `node_modules` não. O gate falha por **ambiente desatualizado**, não por
   código quebrado. Ler isso como "a `main` está quebrada" (ou pior, como
   colisão com o outro agente) leva a investigar o lugar errado por meia hora.

**Regra**

> **1. Território disjunto, declarado antes de começar.** Cada sessão paralela
> recebe branch própria, worktree própria e um **conjunto de caminhos** que só
> ela toca. Divisão que funciona na prática: `apps/api` × `apps/worker` ×
> `packages/*` × `docs/`. Se dois territórios precisam do mesmo arquivo, não são
> disjuntos — **serialize ou repense a divisão**, não "tome cuidado".
>
> **2. Migração de schema SERIALIZA — um dono de schema por vez.** Não importa
> quantos agentes estejam ativos: só **um** tem permissão de gerar migration em
> `packages/database/prisma` num dado momento. Os demais **esperam o merge** e
> então **rebasam** antes de gerar a sua. Não há divisão de território que torne
> duas migrations concorrentes seguras — a cadeia é linear por construção.
>
> **3. `pnpm install` ANTES do gate, sempre que a base mudou.** Depois de
> rebasar ou de mergear outra branch, rode `pnpm install` **antes** de
> `typecheck`/`lint`/`test`. Gate vermelho sem `pnpm install` na base nova não é
> evidência de nada — não abra investigação, não culpe o outro agente, e não
> reporte a `main` como quebrada até ter reinstalado.

**Ordem prática, quando dois agentes trabalham ao mesmo tempo**

```bash
# antes de começar: worktree própria, a partir da main de verdade
git fetch origin
git worktree add ../fitvo-worktrees/<slice> -b <tipo>/<slice> origin/main

# depois que o OUTRO agente mergear (ou antes de abrir o seu PR)
git fetch origin && git rebase origin/main
pnpm install          # <- o passo que todo mundo pula
pnpm typecheck && pnpm lint && pnpm test
```

**Reflexo a treinar:** gate vermelho logo após rebase/merge → primeira hipótese
é **`node_modules` desatualizado**, não regressão. Só depois de `pnpm install`
o vermelho vira sinal.
