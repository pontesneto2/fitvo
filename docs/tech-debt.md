# Dívida técnica priorizada

Registro de dívida técnica **conhecida e priorizada**, no nível de detalhe
adequado a um repositório **público**: descreve a lacuna e a direção do
endurecimento, **sem** apontar `file:line`, endpoint específico ou prova de
exploração. O detalhe técnico fino fica fora do repositório até o furo ser
fechado (disciplina de segurança do `CLAUDE.md`).

A ordem numerada = ordem de "o que morde primeiro", definida pelo responsável.

---

## API — endurecimento para produção (D-033 / D-035 / D-073)

O D-033 pede o padrão de segurança de "sistema grande" para a API. O **núcleo já
está de pé e sólido**; o que falta é endurecimento operacional (carga e
adversário). Esta seção separa o que já é sólido, o que foi resolvido, e a dívida
aberta priorizada.

### Já sólido — não é dívida

- **Validação de entrada** — todas as rotas com schema + `parse` (Zod/AJV).
- **Idempotência de cobrança (D-035)** — chaves únicas em cobrança, assinatura e
  evento de webhook; replay não gera cobrança dobrada.
- **Rate limiting existe** — em camadas: global, rotas sensíveis de auth, webhook.
- **Correlation/request ID** — gerado e ecoado por requisição (base de D-073).

### Resolvido

- ✅ **Segredo em log** — tokens de verificação/recuperação não vão mais ao log;
  o logger passou a **redigir** campos sensíveis. Era o item de prioridade
  máxima; fechado.

### Dívida aberta — priorizada

Decidida **como dívida**, não como trabalho em andamento. Implementar sob ordem,
**um item por PR**, cada um em área que exige revisão humana.

1. **Política de CORS explícita.** A origem permitida hoje tem default
   permissivo; trocar por política **explícita** que falhe ruidosamente em vez de
   abrir por omissão. (Contradiz o "CORS restrito" que o ADR-0005 pede.)
2. **Limites de resultado (paginação).** Endpoints de listagem não têm teto de
   resultados — um tenant grande pode gerar resposta desproporcional (DoS
   acidental). Adicionar paginação (limite + cursor) e teto máximo. (Promessa do
   ADR-0005 ainda não cumprida.)
3. **Timeouts.** Não há timeout de requisição nem de query. Adicionar timeout de
   request na borda e `statement_timeout` no banco, para que uma operação lenta
   não pendure recurso indefinidamente.
4. **Resiliência de dependência externa.** A chamada ao gateway de pagamento é
   direta, sem timeout/retry/circuit-breaker; um provedor lento pendura a
   requisição. Adicionar timeout (AbortSignal) + retry com backoff.
5. **Topologia do rate limit.** O store é em memória — por-instância, zera no
   restart e não soma entre réplicas — e a chave por IP não confia no proxy.
   Apoiar no Redis já existente e ligar o trust de proxy, para contar o cliente
   certo atrás do balanceador.

> Itens 1–5 são lacunas de **endurecimento**, não bugs de comportamento: o
> sistema funciona; falta blindá-lo. O detalhe com `file:line` de cada um vive
> fora do repositório (disciplina de repo público) e entra no PR que fechar o
> item, junto com o teste que prova o furo tampado.
