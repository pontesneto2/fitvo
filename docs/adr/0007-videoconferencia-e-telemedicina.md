# ADR-0007 — Videoconferência e Telemedicina

**Status:** Aceito
**Decisões cobertas:** D-074 a D-076

## Contexto

Pesquisa competitiva mostrou que MFit e Dietbox tratam videoconferência como
recurso essencial para atendimento remoto. O FITVO já prevê atendimento remoto
global via split Asaas (D-018, ADR-0004), então falta a camada de vídeo em si.
Especialidades têm pesos regulatórios distintos (D-009, ADR-0003) — a
teleconsulta médica no Brasil é regulada pela Resolução CFM nº 2.314/2022, que
exige da **pessoa jurídica prestadora** (o FITVO, não o médico individualmente)
sede no Brasil, inscrição no CRM do estado e médico responsável técnico, além
de criptografia, prontuário integrado e certificação digital.

## Decisão

**Provider — Daily (daily.co), começando pelo Daily Prebuilt:**
- Widget embutível, integração em dias — coerente com a prioridade de
  simplicidade sobre escalabilidade (CLAUDE.md).
- Free tier: 10.000 min/mês; acima disso ~US$ 0,004/min, caindo a ~US$
  0,0015/min em volume.
- Motivo: melhor equilíbrio DX/preço entre os providers avaliados, free tier
  generoso para validar o produto, e caminho de migração para LiveKit
  (~10x mais barato) se o volume justificar — sem acoplar o domínio ao
  provider concreto (ver abstração abaixo).

**Abstração — package `video` novo** (não dentro de `notifications`):
- Vídeo é uma capacidade própria (criar sala, gerar token/link de acesso,
  encerrar sessão, webhook de eventos de chamada), sem sobreposição semântica
  com envio de notificações multi-canal. Agrupar os dois forçaria uma interface
  artificial.
- Segue o padrão dos demais adapters (D-022, ADR-0005): interface única +
  adapter Daily + fake para teste. Domínio chama a interface, nunca o SDK do
  Daily diretamente.
- Interface mínima prevista (a refinar na implementação): `createRoom`,
  `getJoinToken`/`getEmbedUrl`, `endRoom`, tratamento de webhook de eventos.

**Escopo por ambiente — vídeo limitado a treino e nutrição no MVP:**
- Videoconferência habilitada nos ambientes de **treino** e **nutrição**.
- **Bloqueada** no ambiente de **medicina** até a plataforma cumprir os
  requisitos da Resolução CFM nº 2.314/2022 como pessoa jurídica prestadora
  (sede no Brasil, inscrição no CRM do estado, médico responsável técnico,
  criptografia, prontuário integrado, certificação digital). Isso é requisito
  da plataforma, não do médico individual usuário — não é contornável por
  verificação de profissional (D-046, ADR-0003).
- Teleconsulta médica entra na **mesma fase** que a receita eletrônica (D-011,
  ADR-0003), condicionada a assessoria jurídica e registro no CRM — coerente
  com o faseamento por risco regulatório (D-009, ADR-0003): núcleo + treino →
  nutrição → medicina.

**Exames laboratoriais entram no escopo:**
- Solicitação de exames e anexo de resultados (arquivo/estruturado) pelo
  profissional e/ou paciente.
- É a ponte natural nutrição↔medicina: diferencial que concorrentes verticais
  (MFit, Dietbox) não oferecem, aproveitando a unificação de dados do paciente
  que é o núcleo do produto (Missão, CLAUDE.md).
- Fase: junto com o conteúdo fino de nutrição (D-063, ADR-0006), quando os
  campos de anamnese/avaliação por especialidade forem detalhados.

## Alternativas consideradas

- **LiveKit desde o MVP:** ~10x mais barato em volume, mas integração mais
  trabalhosa (self-hosted ou infra própria de SFU) — não compensa para validar
  o produto ainda sem volume. Rejeitado por ora; mantido como destino de
  migração se o custo do Daily virar problema real.
- **Vídeo dentro de `packages/notifications`:** evitaria criar package novo,
  mas mistura duas capacidades sem relação semântica (enviar aviso vs. hospedar
  chamada). Rejeitado — package `video` dedicado.
- **Vídeo liberado também em medicina no MVP, com aviso/disclaimer:** mais
  rápido, mas descumpre a Resolução CFM nº 2.314/2022 na figura da pessoa
  jurídica prestadora — risco jurídico/regulatório inaceitável dado o
  faseamento por risco (D-009). Rejeitado.
- **Exames laboratoriais como domínio separado, fase própria:** o conteúdo é
  pequeno o suficiente para acompanhar o detalhamento de nutrição sem justificar
  fase isolada. Rejeitado — entra junto com D-063.

## Consequências

- Novo package `packages/video` (interface + adapter Daily + fake), seguindo o
  mesmo padrão de teste dos demais adapters (mock por padrão, teste ao vivo
  gated por credenciais).
- Ambiente de medicina fica sem vídeo até a mesma fase da receita eletrônica —
  reduz superfície de risco regulatório no MVP sem bloquear o lançamento de
  treino/nutrição.
- Guard de autorização por ambiente precisa existir na camada de aplicação (não
  só na UI) para impedir sala de vídeo em contexto médico antes da fase
  correta.
- Migração futura para LiveKit é uma troca de adapter, não uma refatoração de
  domínio — mesma garantia dada aos demais providers (ADR-0005).
- Exames laboratoriais somam-se ao escopo de conteúdo fino de nutrição
  (D-063), adiando uma decisão de modelagem que ainda depende de detalhamento
  humano.
