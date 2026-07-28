-- Academia como tipo de tenant (D-141). ADITIVA: so acrescenta um valor ao enum,
-- nao remove nem altera nada existente.
--
-- Migration SEPARADA de proposito: `ALTER TYPE ... ADD VALUE` nao pode ter o
-- valor novo USADO na mesma transacao em que foi criado (Postgres). Como o
-- Prisma envolve cada migration numa transacao, o DDL do seat de estagiario vive
-- na migration seguinte.
ALTER TYPE "TenantType" ADD VALUE 'ACADEMIA';
