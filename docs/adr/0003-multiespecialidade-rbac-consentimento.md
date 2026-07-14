# ADR-0003 — Multi-especialidade, Clínica, RBAC e Consentimento

**Status:** Aceito
**Decisões cobertas:** D-007 a D-017, D-045 a D-051, D-054

## Contexto

FITVO é um ecossistema "3 apps em 1" (treino, nutrição, medicina) na mesma base,
vendável a profissionais solo e a clínicas. Especialidades têm pesos
regulatórios distintos. O paciente é titular dos dados (LGPD).

## Decisão

**Multi-especialidade:** um profissional pode ter várias especialidades, cada
uma um contexto independente (N:N). Especialidades = catálogo fixo da plataforma
no MVP.

**Faseamento por risco regulatório:** núcleo + treino → nutrição → medicina. A
arquitetura nasce multi-especialidade; a execução é faseada.

**Verificação profissional:** por especialidade, em duas camadas (formato +
revisão de documentos). Sempre feita pela plataforma — a clínica não atesta por
conta própria. Profissional cadastrado não atende até ser verificado. Gera
status (`pendente`/`em análise`/`verificado`/`rejeitado`), usado como selo.

**Receita médica:** sem prescrição eletrônica no MVP. Médico preenche dados; o
sistema imprime folha estruturada para assinatura física. Receita eletrônica é
fase futura com assessoria jurídica.

**Clínica = tenant.** Profissional solo = tenant de 1 (criado automaticamente).
Clínica = tenant multi-profissional, com admin e painel próprio; unidade
comercial de cobrança. Profissional só entra em clínica por convite do admin;
quem se cadastra por fora vira independente.

**RBAC (4 níveis):** Super Admin (FITVO); Clínica + Admin de Clínica;
Profissional; Paciente. "Admin de Clínica" e "Profissional" são desacoplados
(uma pessoa pode ter um, outro ou ambos). Só o admin tem visão ampla.
Administrador puro (não-profissional) acessa dado operacional/financeiro, nunca
dado clínico.

**Consentimento (domínio de primeira classe):** paciente autoriza/revoga
compartilhamento granularmente, por profissional; exporta e solicita exclusão
dos dados. Compartilhamento entre profissionais é sempre autorizado pelo
paciente, nunca automático.

**Motor de compartilhamento (orientado a eventos):** quando um paciente passa a
ter múltiplos profissionais, o sistema detecta a sobreposição e sugere
compartilhamento (sob consentimento) via notificação inteligente. Implementado
com BullMQ + workers.

## Alternativas consideradas

- **Produto de nutrição separado (concorrente do Dietbox):** duplicaria auth,
  pagamento e infra e jogaria fora o diferencial de dados interligados.
  Rejeitado em favor do ecossistema único.
- **Compartilhamento automático intra-clínica:** violaria LGPD. Rejeitado —
  sempre sob consentimento.
- **Clínica atesta habilitação:** transfere risco jurídico ao FITVO. Rejeitado —
  verificação sempre pela plataforma.

## Consequências

- Argumento comercial forte para clínicas (operação centralizada).
- Separação dado-clínico ≠ dado-operacional protege juridicamente e exige
  cuidado de modelagem.
- O motor de consentimento é a parte mais sofisticada do sistema; justifica a
  arquitetura orientada a eventos.
