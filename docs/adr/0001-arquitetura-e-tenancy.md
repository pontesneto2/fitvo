# ADR-0001 — Arquitetura, Tenancy e Modelo de Relacionamento

**Status:** Aceito
**Decisões cobertas:** D-001 a D-004, D-052 a D-055

## Contexto

FITVO é um SaaS multi-especialidade onde profissionais (e clínicas) atendem
pacientes. Precisa escalar para milhares de usuários mantendo isolamento de
dados e simplicidade. A relação entre paciente e profissional é o núcleo do
domínio.

## Decisão

**Arquitetura:** Modular Monolith (não microservices). Cada domínio é uma fatia
vertical autocontida, preparada para extração futura sem grande refatoração.

**Tenancy:** shared database / shared schema. Isolamento por `tenant_id` na
camada de aplicação, com guard obrigatório na camada de repositório. RLS do
Postgres fica como possível defesa em profundidade futura (baixa prioridade).

**Relacionamento:** N:N entre paciente e profissional. A unidade central é o
**vínculo** (`bond`), que conecta `paciente ↔ (profissional + especialidade)`.
"Léo educador" e "Léo nutricionista" são dois vínculos distintos.

**Unidade de dados:**
- Global (uma vez por pessoa): identidade, data de nascimento, sexo, altura.
- Por vínculo: anamnese, avaliações, medidas, treinos, agenda, check-ins,
  financeiro, fotos de evolução.

**Isolamento de dados corporais:** avaliação física, medidas e fotos de evolução
são isoladas por vínculo — cada profissional só vê o que registrou.

**Materialização na UX:** o app expõe **ambientes por especialidade**
("vários apps dentro do mesmo app"). Trocar de ambiente = trocar de vínculo. O
paciente nunca vê dados de um profissional no ambiente de outro.

**Encerramento de vínculo:** vira arquivo; dados preservados; paciente continua
vendo o histórico.

## Alternativas consideradas

- **Schema-por-tenant / database-por-tenant:** isolamento mais forte, mas
  complica migrations e escala pior com milhares de tenants. Rejeitado.
- **Vínculo por profissional (sem especialidade):** não suportaria o profissional
  multi-especialidade sem ambiguidade. Rejeitado.
- **Dados corporais compartilhados por padrão:** mais rico para o paciente, mas
  o caminho isolado→compartilhado é aditivo e reversível; o inverso é custoso.
  Optou-se por isolar agora.

## Consequências

- Disciplina absoluta de escopo de tenant em toda query (risco: vazamento entre
  tenants se um repositório esquecer o filtro).
- Duplicação legítima de dados corporais quando o paciente tem múltiplos
  profissionais — a UX deve segmentar por profissional, nunca fundir.
- Evolução para compartilhamento (sob consentimento) é possível sem quebrar o
  modelo.
