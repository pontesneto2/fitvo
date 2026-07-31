-- ADR-0017 (D-152/D-155) — Camada 3 do isolamento de tenant: Row-Level
-- Security SELETIVO (nao em todas as tabelas — overhead <3% vs ~15% universal).
-- ADITIVA: nao remove nem altera coluna com dado existente, so acrescenta
-- policy. So protege de verdade se a conexao de runtime NAO for superuser/
-- BYPASSRLS (D-155) -- ver docs/troubleshooting.md para o setup do role
-- fitvo_app/fitvo_webhook (fora desta migration: CREATE ROLE nao viaja em
-- migration do Prisma, e um passo de infra por ambiente).
--
-- current_setting(..., true) com o segundo argumento (`missing_ok`) evita erro
-- quando a variavel de sessao nao foi setada (fluxo-excecao sem tenant aberto:
-- registro publico, aceite de convite) -- nesse caso retorna NULL, e
-- "tenantId" = NULL e sempre UNKNOWN/false: leitura ve zero linhas, escrita e
-- rejeitada. Fluxos-excecao que ESCREVEM nestas tabelas setam a variavel
-- explicitamente com o tenantId ja conhecido (ver
-- apps/api/src/modules/intern|reception|patient/prisma-*-repository.ts) --
-- nao afrouxamos a policy para cobrir isso.
--
-- TermsAcceptanceEvent NAO entra (ao contrario do texto original do ADR-0017):
-- a tabela nao tem coluna tenantId (escopada por accountId, cruza tenant de
-- proposito, mesmo racional de Consent/SharingSuggestion) -- uma policy por
-- tenantId e estruturalmente impossivel. ADR marcado para correcao.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bond',
    'intern_profile',
    'reception_profile',
    'payment_account',
    'subscription',
    'charge',
    'encounter',
    'medical_record',
    'prescription',
    'anamnesis'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.current_tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.current_tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Excecao administrativa restrita (ADR-0017, Consequencias: "acesso
-- administrativo/cross-tenant legitimo usa caminho explicito e separado,
-- nunca o cliente padrao"). Achada ao mapear os call sites deste slice: o
-- webhook do Asaas (charge/subscription por asaasChargeId/asaasSubscriptionId,
-- SEM tenantId conhecido a priori) e a regua de cobranca do worker
-- (subscription, varredura de TODAS as nao-terminais, sem filtro de tenant)
-- precisam atravessar tenant de proposito. Sem BYPASSRLS: uma policy
-- PERMISSIVA adicional, so para o role fitvo_webhook, so nestas 2 tabelas,
-- so nos comandos que ele de fato usa. Combinada via OR com a policy geral
-- acima -- nao afrouxa o isolamento para fitvo_app.
CREATE POLICY webhook_cross_tenant_select ON "subscription"
  FOR SELECT TO fitvo_webhook USING (true);
CREATE POLICY webhook_cross_tenant_update ON "subscription"
  FOR UPDATE TO fitvo_webhook USING (true) WITH CHECK (true);
CREATE POLICY webhook_cross_tenant_update ON "charge"
  FOR UPDATE TO fitvo_webhook USING (true) WITH CHECK (true);
