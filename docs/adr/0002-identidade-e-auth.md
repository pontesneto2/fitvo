# ADR-0002 — Identidade, Autenticação e Onboarding

**Status:** Aceito
**Decisões cobertas:** D-005, D-006, D-041 a D-044, D-029, D-030

## Contexto

Uma mesma pessoa pode exercer papéis diferentes (o profissional que também
treina; o admin que também atende). O produto atende profissionais remotos
globalmente. Autenticação lida com dado clínico e financeiro, exigindo rigor.

## Decisão

**Identidade:** `account` (identidade: e-mail, senha, nome, documento) é separada
dos **perfis de papel** (`professional_profile`, `patient_profile`, membership de
clínica/admin). Uma conta = 1 login = N papéis. Uma conta pode acumular
profissional + paciente simultaneamente.

**Login:** por e-mail (universal, serve para profissional global). E-mail único
por conta.

**Documento fiscal:** obrigatório no cadastro. Clínica = sempre CNPJ (no tenant);
profissional = CPF ou CNPJ; paciente = CPF. Documento da pessoa na `account`;
documento da clínica no tenant. Documento do pagador vem autopreenchido no
checkout.

**Login social (Google/Apple):** fase posterior. Ao ligar qualquer social, Apple
OAuth torna-se obrigatório na App Store — Google e Apple entram juntos.

**Onboarding do paciente:** autocadastro permitido, mas o app fica em estado
mínimo até vincular um profissional. Convite (profissional→paciente) é entidade
de primeira classe, entregue via push + tela + e-mail; expira em 7 dias,
reenviável.

**Autenticação (packages/auth):** JWT próprio (não serviço gerenciado), com:
- access token curto + refresh token com rotação a cada uso;
- detecção de reuso de refresh → revoga a família de tokens da sessão;
- revogação real via rastreamento no Redis (logout, troca de senha);
- hashing Argon2, verificação de e-mail, rate limiting no login, recuperação
  segura (token de uso único);
- estrutura pronta para MFA (ativação pós-MVP, começando por admin de clínica e
  médico).

## Alternativas consideradas

- **Tabela única de usuário com `tipo` fixo:** simples, mas impede multi-papel.
  Rejeitado.
- **Serviço de identidade gerenciado (Clerk/Auth0/Supabase Auth):** rápido, mas
  cobra por usuário ativo e coloca o ativo mais crítico em terceiro. Rejeitado
  em favor de controle e margem.

## Consequências

- Modelo de identidade flexível suporta todos os cenários multi-papel.
- Auth próprio exige rigor de implementação (é onde mora o risco); compensado
  por controle e economia em escala.
- Dois tipos de convite no sistema: profissional→paciente (ADR-0002) e
  admin→profissional (ADR-0003).

## Autenticação no cliente web (BFF + cookies httpOnly)

**Contexto:** a API é *bearer puro* — devolve `accessToken`/`refreshToken` no corpo
do login e valida `Authorization: Bearer` em `/me`, `/logout` etc. Um cliente web
que toca dado clínico e financeiro precisa guardar esses tokens **sem** expô-los a XSS.

**Decisão:** o `web-personal` usa o padrão **BFF (Backend-for-Frontend)**. Os route
handlers do próprio Next (`/api/auth/login|logout|refresh`, `/api/me`) intermediam a
API: recebem as credenciais, chamam `/v1/auth/*` no servidor e guardam os tokens em
**cookies `httpOnly`, `Secure`, `SameSite=Lax`** (`fitvo_at` / `fitvo_rt`). O
navegador **nunca vê o token em JavaScript** — a resposta do login carrega só a conta.
O middleware guarda as rotas por **presença** do cookie de sessão; a validação real
continua na API (Bearer). O refresh (rotação — D-029) acontece server-side, no 401.

**Por quê, e não token em `localStorage`/memória:**
- **XSS = roubo de sessão.** Token legível por JS, num app com dado clínico e
  financeiro, é inaceitável (este ADR pede rigor); `httpOnly` remove essa superfície.
- **Dispensa CORS.** O browser só fala com o Next (same-origin); não é preciso abrir
  CORS na API — coerente com manter a API fechada.

**Consequência:** as chamadas à API a partir do cliente passam pelo BFF (route
handlers / server components), não direto do browser. É o custo aceito pela
segurança do token.

## Gate de e-mail verificado nas ações sensíveis (D-029)

**Contexto:** a destilação inicial deste ADR registrou a verificação de e-mail
como parte do core de auth, mas nenhum ponto do sistema checava
`emailVerifiedAt` — o campo existia, nada o lia. D-029 exige o rigor; faltava a
aplicação.

**Decisão:** um guard reusável (`requireVerifiedEmail`, em
`apps/api/src/shared/auth-context.ts`) roda **depois** da autenticação/RBAC e
**antes** da regra de negócio, nas ações sensíveis: convidar (paciente e
profissional), emitir cobrança (Fluxo B). Login e onboarding **não** passam por
ele — a conta não verificada loga e completa o perfil normalmente; só a ação
sensível esbarra no gate. Falha com **403** e `type`
`https://fitvo.dev/problems/email-not-verified` (`EmailNotVerifiedError`),
tipado na fonte Zod (`@fitvo/validation`) e refletido no `openapi.json`
versionado (D-032). Reenvio da verificação reusa o padrão de token de uso único
com TTL e rate limit já existente (`VerificationTokenStore`, D-029).

**Consequências:**
- Reenviar convite (`resend`) também exige e-mail verificado — está na mesma
  família de ação ("convidar"). Revogar convite e arquivar vínculo, não: são
  ações que reduzem exposição, não que a criam.
- O aceite de convite (`/invites/accept`) fica **fora** do gate: é público,
  autorizado pelo próprio token de uso único do convite, e pode criar a conta
  na hora — não há Bearer nem estado de verificação prévio a checar ali.
- Ações clínicas (anamnese/plano/prescrição — Medicina, ADR-0014) ainda não têm
  rota própria; o guard está pronto para ser aplicado quando essa slice
  nascer.
- `subscribe` (Fluxo A, assinatura) não foi incluído neste gate — o escopo
  pedido foi "cobrança/split/saque"; revisitar se o responsável quiser
  estender.
