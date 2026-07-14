# ADR-0006 — Monorepo, Domínios de Conteúdo e Fundação Técnica

**Status:** Aceito
**Decisões cobertas:** D-037 a D-040, D-063 a D-068, D-070 a D-073

## Contexto

O projeto reúne múltiplos apps e packages compartilhados, e precisa nascer com
fundação técnica sólida (ambientes, testes, CI, observabilidade) conforme os
documentos. Conteúdo de treino/nutrição/medicina tem detalhe que só vale
definir por fase.

## Decisão

**Monorepo único (Turborepo + pnpm workspaces):** todas as pastas visíveis num
só projeto. Apps independentes (build/deploy próprios) coabitam o repositório.
web-personal e web-admin são apps Next separados, ambos no monorepo.

**API por vertical slice:** cada domínio (auth, patient, professional, clinic,
bond, consent, billing, workout, nutrition...) é autocontido, com camadas
internas. Facilita extração futura.

**Design system:** dois packages (`ui-web`, `ui-mobile`) mais `brand-tokens`
compartilhado (cores, tipografia, espaçamento — fonte única de marca).
**Design system e logo ainda não definidos**; qualquer cor mencionada é
provisória (definir em bloco de design próprio).

**Domínios de conteúdo (esqueleto — detalhar por fase):**
- Treino: `exercise` (biblioteca), `workout`/`routine`, séries/reps/carga.
- Nutrição: `meal_plan`, refeições, base de alimentos, macros.
- Médico: atendimento, prontuário, folha de receita impressa.
- Transversal: anamnese/avaliação/medidas/fotos por especialidade, isoladas por
  vínculo.
- Bibliotecas: base compartilhada da plataforma + itens próprios do profissional
  (privados por padrão).
- Anamnese/avaliação: modelo de campos por especialidade (sem formulário
  genérico único).

**Fundação técnica:**
- **i18n:** textos externalizados desde já; lançamento pt-BR.
- **Datas:** UTC no banco; conversão só na exibição; fuso preferido por usuário.
- **Ambientes:** Dev + Staging + Produção, com secrets isolados.
- **Dinheiro:** inteiro em centavos, nunca float.
- **Testes:** pirâmide com foco no core de risco + E2E nos fluxos críticos;
  evitar excesso de mocks.
- **CI (GitHub Actions):** lint, typecheck, testes, build, security scan,
  dependency scan — bloqueia merge se qualquer etapa falhar.
- **Observabilidade:** log estruturado JSON + request/correlation ID + health
  checks desde o dia 1; gancho para Sentry e OpenTelemetry.

## Alternativas consideradas

- **Repositórios separados por app:** perderia o compartilhamento simples de
  packages e a visão unificada. Rejeitado — monorepo.
- **Organização da API por camada técnica (controllers/services/repos no topo):**
  dificulta a extração de domínio. Rejeitado — vertical slice.
- **Detalhar todo o conteúdo agora:** trabalho que envelhece antes da fase.
  Rejeitado — esqueleto agora, detalhe por fase.

## Consequências

- Estrutura pronta para a Fase 1 (fundação sem regra de negócio).
- Detalhe de conteúdo, design system/logo e redação jurídica ficam como
  trabalho futuro explícito, não pendência esquecida.
