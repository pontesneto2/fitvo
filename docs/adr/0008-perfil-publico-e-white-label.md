# ADR-0008 — Perfil Público e White-Label Estrutural

**Status:** Aceito
**Decisões cobertas:** D-077, D-078

## Contexto

Duas necessidades de crescimento surgiram em paralelo, sem relação com
videoconferência (ADR-0007): dar ao profissional uma vitrine de aquisição sem
o FITVO virar intermediário da relação profissional↔paciente, e preparar o
produto para eventualmente ser revendido com marca de terceiros (clínicas
grandes, parceiros comerciais) sem reescrever a camada de tema.

## Decisão

### D-077 — Página pública de perfil (não marketplace)

- Cada profissional verificado pode ter uma URL pública própria
  (`fitvo.com.br/<slug>`), com slug editável pelo profissional.
- Conteúdo da página: foto, especialidades, selo de verificação (D-010 —
  mesmo status `verificado` já usado como selo, ADR-0003), e botão **"solicitar
  contato"**.
- O botão cai no fluxo de **convite invertido**: reaproveita a entidade de
  convite já modelada para profissional→paciente (D-006, ADR-0002) e o vínculo
  paciente↔(profissional+especialidade) (D-055, ADR-0001) — não é uma entidade
  nova, é o mesmo convite disparado a partir de uma origem pública em vez do
  app.
- **Opt-in:** o profissional ativa a página; não é padrão para todo cadastro
  verificado.
- Mora no app `site` (Next.js institucional), não no `web-personal` nem no
  `mobile` — é a única superfície pública do produto voltada a
  não-autenticados.
- **O FITVO não distribui alunos.** O profissional traz e divulga sua própria
  audiência; a página é vitrine de conversão, não canal de descoberta operado
  pela plataforma.

**Fora de escopo, explicitamente:**
- Busca ou vitrine agregada de profissionais (diretório navegável pela
  plataforma).
- Ranking ou matching automático paciente↔profissional.
- Reviews/avaliações públicas.
- Comissão sobre lead ou conversão.

Motivo do corte: cada um desses itens transforma o produto em **marketplace**
— outro produto, com outro conjunto de riscos: moderação de conteúdo gerado
por usuário (reviews), disputa entre partes, e o risco jurídico mais
importante — a plataforma deixa de intermediar só o **pagamento** (papel já
assumido conscientemente no Fluxo B, ADR-0004) e passa a intermediar a
**relação** profissional↔paciente em si (quem aparece, quem é recomendado a
quem). Isso é uma mudança de natureza de negócio, não um incremento de
feature, e não está autorizada por nenhum ADR existente.

### D-078 — White-label estrutural

- A estrutura de tenant já suporta, desde já, campos de marca própria (nome
  exibido, logo, tokens de tema) no schema — sem ativar nada no MVP.
- `packages/brand-tokens` já resolve tema de forma dinâmica (não hardcoded);
  ativar white-label por tenant é trocar o conjunto de tokens consumido, não
  reescrever a camada de apresentação.
- **MVP renderiza sempre a marca FITVO.** Nenhum tenant recebe marca própria
  no lançamento.
- Ativação futura (pós-MVP) = feature comercial: tenant ganha nome/logo/tokens
  próprios, mesma UI consumindo tokens diferentes por tenant — sem
  refatoração estrutural quando o momento chegar.
- Mesmo padrão de "estrutura pronta, ativação faseada" já usado em MFA
  (D-030, ADR-0002) e i18n (D-066, ADR-0006): a arquitetura nasce preparada,
  a exposição ao usuário é decisão de fase.

## Alternativas consideradas

- **Perfil público como diretório buscável (marketplace leve):** aumentaria
  aquisição mais rápido, mas introduz moderação, disputa e risco jurídico de
  review público — peso desproporcional para o estágio do produto. Rejeitado
  — mantém-se página individual opt-in, sem busca.
- **Perfil público dentro do `web-personal`:** o `web-personal` é autenticado
  (painel do profissional); misturar superfície pública ali quebraria o
  modelo de acesso. Rejeitado — vive no `site`.
- **White-label via deploy separado por tenant (multi-tenant físico):**
  contradiz a decisão de shared database/shared schema (D-001, ADR-0001) e
  multiplicaria infraestrutura sem necessidade no estágio atual. Rejeitado —
  branding é dado de tenant + tokens, não infraestrutura separada.
- **Ativar white-label já no MVP:** nenhum tenant hoje demanda isso e adiciona
  superfície de teste (temas por cliente) sem validação de produto ainda.
  Rejeitado — estrutura pronta, ativação adiada.

## Consequências

- `site` ganha uma rota pública nova consumindo dados do profissional
  verificado — precisa de guard explícito para só expor o que é público por
  design (nunca dado clínico/financeiro).
- O convite invertido reaproveita o motor de convite existente; não deve
  nascer como fluxo paralelo — qualquer divergência de comportamento entre
  convite iniciado no app e convite iniciado pela página pública é bug, não
  feature.
- Qualquer decisão futura de abrir busca/ranking/reviews exige um ADR novo
  (mudança de modelo de negócio), não uma extensão incremental deste.
- Campos de branding no schema de tenant chegam "esqueleto" (nome
  exibido/logo/tokens), sem UI de configuração no MVP — mesmo tratamento dado
  a outras capacidades faseadas do produto.
