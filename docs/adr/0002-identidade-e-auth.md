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
