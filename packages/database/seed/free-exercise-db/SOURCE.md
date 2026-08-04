# free-exercise-db — proveniência da base de exercícios PLATFORM

`exercises.json` neste diretório é uma cópia **congelada** (vendored) do dataset
público [free-exercise-db](https://github.com/yuhonas/free-exercise-db), usado
como base da biblioteca de exercícios PLATFORM do FITVO (D-089 — ADR-0009).

| Campo             | Valor                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| Repositório       | `https://github.com/yuhonas/free-exercise-db`                                     |
| Commit fixado     | `b0eed061e1c832b3ed815fbaa4b45b3cdc14df49`                                        |
| Arquivo de origem | `dist/exercises.json`                                                             |
| Registros         | 873                                                                               |
| Licença           | **Unlicense** (domínio público — uso comercial livre, sem atribuição obrigatória) |
| Data da cópia     | 2026-08-04                                                                        |

## Por que o arquivo está commitado

Reprodutibilidade. O seed da base global não pode depender do `HEAD` de um
repositório de terceiro mudando debaixo dele: rodar o seed hoje e daqui a um ano
tem que produzir exatamente o mesmo conjunto. O dataset é domínio público, então
versioná-lo é legalmente livre.

Para atualizar a base: baixar o `dist/exercises.json` de um commit NOVO, trocar
o SHA desta tabela **no mesmo commit** e rodar o seed — que é idempotente
(D-169) e só insere o que ainda não existe.

```sh
SHA=<novo-sha>
curl -sL -o exercises.json \
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/$SHA/dist/exercises.json"
```

## Formato de cada registro

```jsonc
{
  "id": "3_4_Sit-Up",
  "name": "3/4 Sit-Up",
  "force": "push" | "pull" | "static" | null,   // 29 nulos
  "level": "beginner" | "intermediate" | "expert",
  "mechanic": "compound" | "isolation" | null,  // 87 nulos
  "equipment": "barbell" | "dumbbell" | ... | null, // 77 nulos
  "primaryMuscles": ["abdominals"],             // nunca vazio
  "secondaryMuscles": [],
  "instructions": ["...", "..."],
  "category": "strength" | "stretching" | ...,
  "images": ["3_4_Sit-Up/0.jpg", "..."]         // nunca vazio
}
```

`force`, `mechanic` e `equipment` vêm **incompletos** de propósito na fonte — o
mapeador trata nulo como ausência, nunca assume preenchido.

## O que o FITVO consome hoje

O schema atual de `Exercise` (#131) **não tem** coluna para `equipment`,
`level`, `force`, `mechanic` nem para imagem estática. O mapeamento desses
campos existe e é testado (`equipment-map.ts`), mas hoje só é **reportado** pelo
seed — nada é gravado em coluna inventada. Ver `docs/pendencias-mesa.md`.

As imagens ficam em `raw.githubusercontent.com` e **não são hotlinkadas**: o
schema só tem `videoStorageKey` (vídeo — D-091), então nenhuma imagem é
importada. A referência de origem fica no dataset para uma futura migração ao
storage próprio.
