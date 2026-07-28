-- Area de estagio (D-143): o estagiario deixa de ser so de educacao fisica em
-- academia e passa a existir em qualquer tenant-empresa, declarando a AREA que
-- determina qual conselho o responsavel precisa ter.
--
-- ADITIVA: cria um enum NOVO e acrescenta uma coluna a cada tabela. Nada e
-- removido; nenhuma coluna existente e alterada.
--
-- `CREATE TYPE` de enum NOVO pode ser usado na mesma transacao que o cria — a
-- restricao do Postgres e para `ALTER TYPE ... ADD VALUE` (valor novo em enum
-- JA existente, como foi o caso de ACADEMIA em TenantType). Por isso aqui uma
-- migration basta.
CREATE TYPE "InternArea" AS ENUM ('EDUCACAO_FISICA', 'NUTRICAO', 'MEDICINA');

-- BACKFILL, NAO default permanente. As tabelas ja tem linhas (estagiarios
-- criados sob D-142), e `NOT NULL` sem default reprovaria: as linhas existentes
-- nao teriam valor. O default preenche o passado com o UNICO valor que ele pode
-- ter — antes deste slice, todo estagiario era de educacao fisica, porque era a
-- unica possibilidade.
ALTER TABLE "intern_profile" ADD COLUMN "area" "InternArea" NOT NULL DEFAULT 'EDUCACAO_FISICA';
ALTER TABLE "intern_invite" ADD COLUMN "area" "InternArea" NOT NULL DEFAULT 'EDUCACAO_FISICA';

-- E o default SAI. Mantê-lo tornaria "area obrigatoria" uma mentira: um INSERT
-- que esquecesse a area passaria calado, gravando EDUCACAO_FISICA — e um
-- estagiario de medicina viraria de educacao fisica em silencio. Com o default
-- removido, a coluna e NOT NULL sem escapatoria: quem escreve informa a area.
ALTER TABLE "intern_profile" ALTER COLUMN "area" DROP DEFAULT;
ALTER TABLE "intern_invite" ALTER COLUMN "area" DROP DEFAULT;
