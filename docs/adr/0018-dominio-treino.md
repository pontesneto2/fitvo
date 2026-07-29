# ADR-0018 — Domínio de Treino (prescrição, periodização e execução)

**Status:** Proposto (mesa, jul/2026). Decisões D-158 – D-163.
**Relacionados:** `bond` (entidade central — o programa é prescrito num bond); ADR-0015 (cadastro/vínculo/estagiário); ADR-0016 (storage — dependência do card com foto, fora do MVP); ADR-0017 (tenant isolation — todas as tabelas escopadas por tenant); brief FITVO academias; roadmap camada "instagramável".
**Classe:** decisão de fundação do maior domínio de produto. Destrava academia, estagiário (fluxo de validação), e a camada de compartilhamento.

---

## Contexto

Treino é o primeiro grande domínio de produto do FITVO depois do cadastro. A pesquisa competitiva
(jul/2026, apps BR e globais: Hevy, Strong, Fitbod, Trainerize, TrueCoach, RP, MFIT, App Treino/
Pacto, JEFIT) consolidou três verdades que moldam este ADR:

1. **A hierarquia de dados é convergente** entre os líderes — exercício → treino → programa na
   prescrição, e sessão → série na execução. Adotar o padrão comprovado, não inventar.
2. **A execução do aluno é o que faz migrar do concorrente.** Loggers globais (Hevy/Strong) ganham
   na experiência de treinar; softwares de gestão BR perdem exatamente aí. Sem execução de primeira,
   nenhum diferencial de prescrição segura o aluno.
3. **O fosso do FITVO não é o treino isolado** — é treino na mesma base que nutrição e medicina,
   ligados pelo `bond`. O domínio de treino deve nascer preparado pra esse cruzamento.

Público-alvo do FITVO inclui iniciantes/idosos além de avançados/atletas — a modelagem precisa
servir os dois sem forçar complexidade no público-base.

---

## Decisão

### D-158 — Hierarquia de entidades (prescrição + execução), toda escopada por `bond`/`tenant`

**Catálogo (compartilhável global + custom por tenant):**
- `Exercise`: id, nome, grupo muscular primário (FK `MuscleGroup`), grupos secundários, equipamento,
  padrão de movimento, dificuldade, mídia (gif/vídeo), `tenantId` NULL = global / preenchido = custom
  do tenant, `isPublic`. (Ver D-160.)
- `MuscleGroup`: tabela-pai.

**Prescrição (o profissional monta, ligado ao `bond`):**
- `Program`: FK `bond`, objetivo, `dataInicio`, **`dataValidade`** (validade é table-stake no BR),
  tipo de periodização, status (DRAFT/ISSUED/CANCELLED — lifecycle padrão do projeto), nível-alvo.
- `Mesocycle`: FK `Program`, ordem, número de semanas, `ehDeload` (bool). (Ver D-159.)
- `Workout`: FK `Program`/`Mesocycle`, nome, ordem/dia, notas.
- `WorkoutExercise`: junção FK `Workout` + FK `Exercise`, ordem, agrupamento (superset/circuito),
  séries-alvo, reps-alvo, carga-alvo, `descansoSeg`, RIR/RPE-alvo, %1RM, tempo sob tensão,
  tipo de progressão.

**Execução (o aluno realiza — append-only, imutável):**
- `WorkoutSession`: FK `bond`, FK `Workout`, início, fim, status, `feedbackAluno`, `rpeSessao`.
- `ExerciseSet`: FK `WorkoutSession`, FK `Exercise`, número da série, tipo (warmup/normal/drop/falha),
  reps realizadas, carga realizada, RIR realizado, concluída, timestamp.
- `PersonalRecord`: FK `bond`, FK `Exercise`, tipo (1RM/carga×reps/volume/reps/duração), valor,
  FK `WorkoutSession`, data. Calculado ao fechar `ExerciseSet`; dispara PR ao vivo (D-162).

Todas as tabelas carregam `tenantId` e `@@index([tenantId])` (ADR-0017). Execução é append-only:
o histórico do que o aluno fez não se reescreve (princípio de derivação congelada aplicado ao
registro de execução).

### D-159 — Periodização COMPLETA no schema desde o MVP; progressão automática logo em seguida

O schema nasce com periodização completa (`Mesocycle`, RIR/RPE, %1RM, deload, tipo de progressão) —
não uma versão simplificada. Isso porque periodização é o diferencial competitivo (RP/Fitbod se
especializam só nisso) e retrofitar depois seria custoso.

**Faseamento da INTELIGÊNCIA (não da estrutura):**
- **Lançamento:** o profissional **prescreve** a periodização manualmente — define mesociclos,
  cargas, RIR-alvo, semanas de deload. A estrutura completa existe e é usável.
- **Logo em seguida:** o algoritmo de **progressão automática** sugere as cargas/progressões por
  mesociclo (linear simples para iniciante; RIR progressivo + deload para avançado/atleta), usando
  o nível do aluno (D-161) e o histórico de execução como input.

O aluno recebe periodização de verdade desde o dia um; a diferença (manual → automático) é
invisível pra ele.

**Modo por nível:** a periodização se adapta ao nível do aluno (D-161) — iniciante/idoso recebe
progressão linear simples (+carga quando completa as reps); avançado/atleta recebe mesociclos com
RIR/deload. Não impor a complexidade do avançado ao público-base.

### D-160 — Biblioteca de exercícios: curada (~300-400) + custom do profissional

- **Base inicial curada de ~300-400 exercícios essenciais** (cobrem ~90% dos treinos reais — modelo
  Hevy prova que biblioteca enxuta e bem-feita basta). Ponto de partida: importar e curar de base
  open-source (ex.: wger, licença compatível — confirmar na implementação) em vez de catalogar tudo
  à mão.
- **Mídia:** gif/animação na base (barato, suficiente); o profissional pode subir **vídeo próprio**
  para exercícios custom (depende de storage — ADR-0016; para o MVP, custom pode começar sem vídeo
  ou com link externo, a definir no slice).
- **Custom do profissional:** `Exercise` com `tenantId` preenchido = exercício do tenant, preenche
  as lacunas da base curada sem catalogação central. A biblioteca cresce organicamente.
- Escalar para 1.000+ exercícios é evolução pós-MVP, se o uso justificar.

### D-161 — Anamnese alimenta a periodização (nível + tempo de treino)

A anamnese do aluno captura, entre outros campos, os inputs que a periodização (D-159) precisa:
- **Nível de treino:** enum `TrainingLevel { INICIANTE, INTERMEDIARIO, AVANCADO, ATLETA }`.
- **Tempo de treino:** há quanto tempo treina.
- (Demais campos de anamnese — objetivo, lesões, restrições, disponibilidade semanal, PAR-Q —
  são decididos numa mesa de anamnese própria; este ADR fixa só os dois que a periodização consome.)

O nível determina o modo de progressão (D-159). O campo não é decorativo — é o input do algoritmo.

### D-162 — Execução do aluno: Bloco 1 + Bloco 2 + card instagramável no lançamento

**Bloco 1 (indispensável — piso para competir com Hevy/Strong):**
- Registro de série com 1 toque (carga/reps realizadas vs. prescritas; marcar concluída).
- Cronômetro de descanso automático com alerta **em segundo plano** (app fechado / música tocando).
- Histórico de execução por exercício + gráficos de progressão (carga, volume, 1RM estimado).
- Substituição de exercício em tempo real.
- Gif/vídeo do exercício embutido na tela de execução.

**Bloco 2 (alto impacto, barato):**
- **PR ao vivo** — notificação em tempo real ao bater recorde (barato de construir, alto impacto
  de retenção). Banner instantâneo + tela de resumo pós-treino.
- Feedback do aluno pós-treino ao profissional (loop de accountability do coaching).

**Card "instagramável" EFÊMERO no lançamento:**
- Gerado **no cliente** (mobile), **PNG com fundo transparente**, só com os dados do treino (PR,
  volume, exercícios) + branding leve do tenant. O usuário sobrepõe na própria foto/story do IG
  (modelo Strava/Hevy — "fundo transparente serve de overlay pra selfie").
- **Efêmero: NÃO persiste, NÃO usa storage, NÃO usa foto guardada** → não depende do ADR-0016.
  Compartilhamento via share sheet nativo (IG Stories deep link, WhatsApp).
- Opt-in do usuário sempre; nunca automático; dado clínico/corporal nunca aparece sem ação explícita.

### D-163 — Fora do escopo do MVP de treino (pós-MVP)

- Progressão automática por algoritmo (vem logo após o lançamento — D-159).
- Sync Apple Watch / Apple Health / Google Fit (Bloco 3).
- Streaks / badges / gamificação (Bloco 3).
- Card instagramável **com foto/persistência** (depende de storage — ADR-0016; Bloco 3).
- Fluxo de validação do trabalho do estagiário (produz→pendente→supervisor valida→aluno) —
  engancha em `WorkoutSession`/`Program` quando o treino existir; agora ganha o alvo onde plugar.
- Cruzamento treino↔nutrição (macros por dia de treino/descanso; calorias de execução no balanço)
  — fosso, fase posterior.

---

## Consequências

- **Destrava a academia** (o produto que o professor usa: prescrever treino ao aluno) e dá o alvo
  onde o **fluxo de validação do estagiário** vai enganchar (o estagiário monta `Program`/`Workout`
  em estado DRAFT, o supervisor revisa e emite — ISSUED).
- **Destrava a camada instagramável** de aquisição (card efêmero, sem depender de storage).
- Schema de periodização completo desde o dia um evita retrofit custoso; a inteligência automática
  é acréscimo, não reestruturação.
- Execução append-only + `PersonalRecord` derivado alimentam PR ao vivo e progressão automática
  sem coluna de estado que possa divergir.
- Todas as tabelas nascem escopadas por tenant (ADR-0017) — o slice de treino deve rodar **depois**
  do tenant isolation implementado, ou sob a mesma disciplina de `tenantId` explícito até lá.
- Prepara o cruzamento com nutrição/medicina (mesmo `bond`), sem implementá-lo agora.

## Alternativas consideradas

- **Periodização simples no MVP (só treinos com validade, sem mesociclo):** rejeitada — você quer
  produto "top" e periodização é o diferencial; retrofitar o schema depois seria custoso. Adotado
  o meio-termo: schema completo, inteligência faseada (D-159).
- **Biblioteca de 1.000+ exercícios própria no lançamento:** rejeitada — muito trabalho/custo de
  vídeo; ~300-400 curados + custom cobrem o real (D-160).
- **Card instagramável com foto/persistência no lançamento:** rejeitada — criaria dependência em
  cascata (storage → card → lançamento). Card efêmero transparente entrega o instagramável sem a
  cascata (D-162); versão com foto vem com o storage.
- **Modelar treino sem `bond` (treino "solto"):** rejeitada — quebra o eixo central do FITVO; todo
  treino é prescrito num vínculo paciente↔profissional+especialidade.

## Pendências para fechar na implementação (slice)

- Confirmar a base open-source de exercícios e sua licença (D-160).
- Definir se exercício custom no MVP aceita vídeo (storage) ou só gif/link até o storage existir.
- Modelar o algoritmo de progressão automática (pós-lançamento) — mesa própria.
- Anamnese completa (além de nível + tempo) — mesa própria.
- Ordem vs. tenant isolation: idealmente treino roda depois do isolamento implementado.
