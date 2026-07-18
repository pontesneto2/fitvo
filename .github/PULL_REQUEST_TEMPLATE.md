<!-- Titulo do PR no padrao Conventional Commits: tipo(escopo): descricao -->
<!-- No squash-merge, este titulo VIRA o commit na main — o CI (job commitlint) o valida. -->

## O que muda

## Por que

## Como foi validado

- [ ] lint
- [ ] typecheck
- [ ] testes
- [ ] build

## Pendente / follow-ups

## Area critica (Politica de Merge)?

<!-- Ver a Politica de Merge no CLAUDE.md. Se tocar area critica E nao-critica ao
     mesmo tempo, trate como CRITICA. Areas criticas exigem revisao humana antes
     do merge — CI verde NAO basta, nao usar --admin. -->

- [ ] **NAO** — area de baixo risco (infra, tooling, config, CI, docs, design
      system, refactor sem mudanca de comportamento, upgrade de dependencia).
      Auto-merge permitido com CI verde.
- [ ] **SIM** — toca area critica (marque quais):
  - [ ] Financeiro (`payments`, billing, split, subconta, fee, cobranca,
        assinatura, webhook de pagamento, reembolso/estorno)
  - [ ] Consentimento e compartilhamento (Consent, motor de compartilhamento)
  - [ ] Autenticacao/autorizacao (auth, RBAC, isolamento de tenant, guards)
  - [ ] Dado clinico (anamnese, avaliacao, prontuario, prescricao)
  - [ ] Migration destrutiva (remove/altera coluna com dado existente)

## ADR relacionado

<!-- ex.: docs/adr/0006-monorepo-e-fundacao.md (quando a mudanca for arquitetural) -->
