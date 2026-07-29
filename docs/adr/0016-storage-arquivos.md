# ADR-0016 — Arquitetura de armazenamento de arquivos

**Status:** Proposto (mesa, jul/2026). Decisões D-144 – D-149.
**Destino:** `docs/adr/0016-storage-arquivos.md`
**Relacionados:** bloqueador de tenant isolation (go-live #1); bond como entidade central; D-025 (consentimento); gate de bond (`requireBondAccess`).
**Classe:** decisão de fundação — precede qualquer slice que suba/leia arquivo (exames, avaliação física com foto, documento de menor, foto de perfil, cards, feed).

---

## Contexto

O FITVO não tem capacidade de armazenar arquivos hoje (só dado estruturado no Postgres).
Múltiplos slices futuros dependem disso, em graus diferentes de sensibilidade:

- **Dado de saúde (sensível — grau máximo LGPD):** exames laboratoriais, fotos de avaliação física/antropometria, laudos, documento de vínculo de responsável de menor.
- **Dado comum:** foto de perfil do profissional, logo da clínica/academia, materiais compartilhados.
- **Efêmero (não persiste):** cards "instagramáveis" gerados no cliente e compartilhados na hora (§ camada de share) — **não** exigem storage no MVP.

Decidir a fundação uma vez evita que o primeiro slice que precise de arquivo invente uma
solução ad-hoc e os demais refaçam (mesmo padrão do bloqueador de tenant isolation).

Risco central pesquisado: **egress (download) é o custo dominante**, não o storage.
Storage é barato em todos os provedores; o que explode a conta é o volume de downloads —
e o FITVO serve arquivos vistos repetidamente (perfil, exames, feed). Provedores com egress
caro (S3, Firebase, GCS) geram "bill shock"; provedores com egress zero (Cloudflare R2)
eliminam o problema. Firebase Storage **não** é S3-compatible — migrar de/para ele exige
reescrever a camada de storage.

---

## Decisão

### D-144 — Provedor de partida: Supabase Storage
Começar com **Supabase Storage**, porque:
- já usamos Supabase (Postgres); menor superfície de infra nova;
- controle de acesso via Postgres, coerente com o RLS já previsto para tenant isolation;
- tier incluído cobre o MVP (custo ≈ zero até haver escala real de download).

### D-145 — Camada escrita contra interface S3-compatible (adapter), **nunca** contra o SDK proprietário
Toda leitura/escrita de arquivo passa por um `StorageAdapter` com **interface S3** (put/get/
delete/signed-url). Supabase Storage é S3-compatible por baixo; portanto trocar de provedor
depois é **mudar credenciais + endpoint**, não reescrever código.
- **Evolução sem reescrita:** quando o egress escalar e doer → apontar para **Cloudflare R2**
  (egress zero, S3-compatible) via config. Para arquivo frio / retenção legal longa (exames
  antigos) → **Backblaze B2** pela mesma interface.
- **NUNCA** acoplar lógica de negócio ao SDK específico do Supabase, nem usar Firebase Storage
  (não é S3 → migração = reescrita). Esta é a trava que impede o cenário "começar de um jeito
  e ter que trocar tudo depois".

### D-146 — Controle de acesso: bucket privado + URL assinada, com autorização no backend
- **Buckets privados.** Nenhum arquivo é público. Não existe URL pública permanente para
  dado de saúde.
- **URL assinada com expiração curta.** O acesso a um arquivo é concedido gerando uma URL
  temporária (expiração curta, ex.: minutos), emitida **somente após** o backend autorizar.
- **A autorização mora no backend**, onde a lógica de `bond` vive — não em regra de storage.
  Motivo: a autorização real não é "dono = user_id"; é "existe bond ativo entre este
  profissional e este paciente, neste tenant, nesta especialidade" — lógica de aplicação,
  complexa demais para caber limpa em RLS de storage.
- **RLS de storage = reforço opcional (cinto-e-suspensório), não o gate principal.** Pode ser
  adicionada depois como segunda barreira; a decisão de acesso continua no backend.

### D-147 — Arquivo é um recurso do bond — reusa o gate existente
Um arquivo clínico (exame, foto de avaliação, laudo) **é um recurso do `bond`**, sujeito à
**mesma guarda** que anamnese e plano (`requireBondAccess` ou equivalente). **NÃO** criar um
caminho de autorização paralelo para arquivos — caminho paralelo é onde vazamento nasce.
- Quem vê o exame de um paciente: **o profissional daquele bond + o próprio paciente**. Ninguém
  mais — nem outro profissional, nem outro paciente, nem profissional de outro tenant.
- Escopo por `tenantId` injetado (mesmo gate do bloqueador nº1): arquivo nunca cruza tenant.

### D-148 — Metadados no Postgres, binário no storage
O binário vive no storage; o **registro** vive numa entidade no Postgres (ex.: `Attachment`/
`File`): quem subiu, quando, qual `bond`/`tenant`, tipo, tamanho, hash, nível de sensibilidade,
chave/caminho no bucket. Consultas e autorização operam sobre o metadado; o binário só é
buscado via URL assinada após autorização.

### D-149 — Níveis de sensibilidade (a detalhar em slice)
Distinguir **dado de saúde** (exame, avaliação, laudo, documento de menor) de **dado comum**
(foto de perfil, logo). Implicações a definir quando o primeiro slice de arquivo for planejado:
retenção, criptografia em repouso, se foto de perfil pode ter cache/URL mais longa que exame,
e política de exclusão. Registrado como aberto — não bloqueia a fundação.

---

## Consequências

- **Custo no MVP ≈ zero** (tier incluído). A conta só aparece com escala de download — e é
  exatamente aí que D-145 permite migrar para R2 (egress zero) sem reescrever.
- Cards "instagramáveis" efêmeros (gerados no cliente, compartilhados na hora) **não** usam
  storage — zero custo, zero LGPD extra. Só persistir se um dia houver histórico de cards.
- Feed social de academia (fase 2+) e fotos de avaliação física herdam esta fundação; não
  redecidir storage por feature.
- Consentimento (D-025): upload de dado de saúde e de imagem exige base legal/consentimento;
  o usuário controla e pode solicitar exclusão do que subiu (a modelar no slice).

## Alternativas consideradas

- **Cloudflare R2 desde já:** egress zero e mais barato em escala, mas adiciona peça de infra
  nova agora sem o benefício de integração com o Postgres/RLS que já usamos. Preferimos partir
  do Supabase e migrar via adapter (D-145) quando o egress justificar. Não descartado — é o
  destino provável em escala.
- **Firebase Storage:** rejeitado — não é S3-compatible, vendor lock-in, sem spending cap
  (risco de bill spike), egress caro. Migrar dele = reescrever a camada.
- **RLS de storage como gate principal:** rejeitado como principal — a lógica de bond é de
  aplicação, não expressável limpa em RLS; fica como reforço (D-146).
- **URL pública para foto de perfil:** a avaliar no slice (D-149) — pode ser aceitável para dado
  não sensível, mas dado de saúde nunca é público.
