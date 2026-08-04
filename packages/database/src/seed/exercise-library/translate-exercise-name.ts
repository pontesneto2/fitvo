import { CURATED_EXERCISE_NAMES } from './translation-curated';
import {
  type Gender,
  type Phrase,
  type PhraseRole,
  TRANSLATION_PHRASES,
} from './translation-phrases';

/**
 * Tradução de NOME de exercício EN → pt-BR para o seed da base PLATFORM.
 *
 * Duas camadas, nesta ordem:
 *
 * 1. **CURADA** — tabela de-para manual, nome inteiro → nome inteiro. Cobre os
 *    exercícios de alta frequência (supino, agachamento, rosca, terra, remada,
 *    puxada, leg press, cadeira extensora...). É ela que garante nome idiomático
 *    onde importa: são os nomes que o personal lê todo dia.
 * 2. **COMPOSICIONAL** — para o resto, casa FRASES do dicionário
 *    (`translation-phrases.ts`) e recompõe na ordem do português:
 *    `<movimento> <modificadores> <equipamento>`, com o modificador concordando
 *    em gênero com o movimento ("Remada alternada", "Supino alternado").
 *
 * O QUE ESTE MÓDULO SE RECUSA A FAZER: chutar. Sem provider de IA disponível
 * (não há `ANTHROPIC_API_KEY` neste repo, e chamar API paga não foi autorizado),
 * a alternativa a "não traduzir" seria tradução literal palavra a palavra — que
 * em nome de exercício produz coisa como "Imprensa de Banco" para "Bench Press".
 * Nome errado com cara de certo é pior que nome em inglês: o profissional
 * confia no errado e não confia no inglês. Então o tradutor só devolve
 * `COMPOSITIONAL` quando:
 *
 * - **todos** os tokens do nome foram consumidos por alguma frase conhecida
 *   (nada sobrou sem tradução), e
 * - existe **exatamente um** núcleo de movimento (dois núcleos — "Clean and
 *   Press" — só saem corretos pela tabela curada, nunca por composição).
 *
 * Fora disso devolve `UNTRANSLATED` com o nome original em inglês, e o seed
 * conta e reporta. É o gate honesto que substitui a tradução em massa ruim.
 */
export type TranslationStrategy = 'CURATED' | 'COMPOSITIONAL' | 'UNTRANSLATED';

export interface TranslatedName {
  /** Nome final: pt-BR quando traduzido, o original em inglês quando não. */
  name: string;
  strategy: TranslationStrategy;
}

/**
 * Palavras de ligação: consumíveis, sem contribuir texto. Sem elas, "Bench
 * Press with Chains" ficaria eternamente não-traduzido por causa do "with".
 *
 * A absorção acontece DEPOIS do casamento de frases, nunca antes — e a ordem
 * importa. Marcar "over" e "up" como consumidos de saída impediria o casamento
 * de "bent over" e "push up", que são frases inteiras do dicionário. Casando
 * primeiro e absorvendo o resto depois, as duas coisas convivem: "Bent Over
 * Barbell Row" usa a frase, "Palms-Down Wrist Curl Over A Bench" descarta a
 * preposição solta.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'with',
  'on',
  'of',
  'to',
  'in',
  'off',
  'from',
  'for',
  'at',
  'against',
  'and',
  'or',
  'over',
  'up',
  'into',
  'onto',
  'through',
  'between',
  'no',
  'an',
]);

/**
 * Tokenização para CASAMENTO (não é a normalização de anti-duplicação — essa é
 * a `normalizeLibraryItemName`, e serve a outro propósito). Aqui qualquer coisa
 * que não seja letra ou dígito vira separador, porque a fonte usa `-`, `/`,
 * `(`, `)` e `,` como ruído: "Close-Grip EZ-Bar Curl" e "Close Grip EZ Bar
 * Curl" têm que casar com a mesma frase.
 *
 * O APÓSTROFO é a exceção: some SEM virar separador. Tratá-lo como separador
 * quebraria "Farmer's Walk" em `farmer s walk` — um token `s` órfão que frase
 * nenhuma casa, condenando à não-tradução todo nome possessivo ("Child's
 * Pose", "Dancer's Stretch").
 */
export function toMatchTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token !== '');
}

/** Chave de lookup da tabela curada. */
export function toCuratedKey(name: string): string {
  return toMatchTokens(name).join(' ');
}

interface Match {
  phrase: Phrase;
  index: number;
}

/** Casa uma frase numa janela de tokens ainda NÃO consumidos. */
function findPhrase(
  tokens: readonly string[],
  consumed: readonly boolean[],
  phraseTokens: readonly string[],
): number {
  const limit = tokens.length - phraseTokens.length;
  for (let start = 0; start <= limit; start += 1) {
    let hit = true;
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      const at = start + offset;
      if (consumed[at] === true || tokens[at] !== phraseTokens[offset]) {
        hit = false;
        break;
      }
    }
    if (hit) return start;
  }
  return -1;
}

/** Forma do modificador que concorda com o gênero do movimento. */
function inflect(phrase: Phrase, gender: Gender): string {
  if (gender === 'F' && phrase.ptFeminine !== undefined) {
    return phrase.ptFeminine;
  }
  return phrase.pt;
}

function compose(matches: readonly Match[]): string | null {
  const ordered = [...matches].sort((a, b) => a.index - b.index);
  const cores = ordered.filter((match) => match.phrase.role === 'CORE');

  // Exatamente um núcleo. Zero = não é nome de movimento reconhecível; dois ou
  // mais = a ordem do português não é derivável por regra (ver doc do módulo).
  if (cores.length !== 1) return null;

  const core = cores[0];
  if (core === undefined) return null;

  const coreText = core.phrase.pt;
  const coreGender: Gender = core.phrase.gender ?? 'M';
  const coreNormalized = coreText.toLowerCase();

  const partsFor = (role: PhraseRole): string[] => {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const match of ordered) {
      if (match.phrase.role !== role) continue;
      const text = inflect(match.phrase, coreGender);
      // Modificador já embutido no núcleo não se repete: "Incline Bench Press"
      // tem núcleo "Supino inclinado" — anexar "inclinado" daria "Supino
      // inclinado inclinado".
      if (coreNormalized.includes(text.toLowerCase())) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      parts.push(text);
    }
    // Termo REDUNDANTE some quando outro, mais específico, já o contém.
    // "One-Arm High-Pulley Cable Side Bends" casa "high pulley" E "cable" —
    // sem isto sairia "...na polia alta na polia". Fica o mais informativo.
    return parts.filter(
      (part) =>
        !parts.some((other) => other !== part && other.toLowerCase().includes(part.toLowerCase())),
    );
  };

  return [coreText, ...partsFor('MODIFIER'), ...partsFor('EQUIPMENT')].join(' ');
}

export function translateExerciseName(englishName: string): TranslatedName {
  const curated = CURATED_EXERCISE_NAMES[toCuratedKey(englishName)];
  if (curated !== undefined) {
    return { name: curated, strategy: 'CURATED' };
  }

  const tokens = toMatchTokens(englishName);
  if (tokens.length === 0) {
    return { name: englishName, strategy: 'UNTRANSLATED' };
  }

  const consumed: boolean[] = tokens.map(() => false);
  const matches: Match[] = [];

  // TRANSLATION_PHRASES já vem ordenado da frase mais longa para a mais curta —
  // é o que faz "bench press" ganhar de "bench" + "press".
  for (const phrase of TRANSLATION_PHRASES) {
    const phraseTokens = phrase.en.split(' ');
    for (;;) {
      const index = findPhrase(tokens, consumed, phraseTokens);
      if (index === -1) break;
      for (let offset = 0; offset < phraseTokens.length; offset += 1) {
        consumed[index + offset] = true;
      }
      matches.push({ phrase, index });
    }
  }

  // Só AGORA as palavras de ligação são absorvidas — ver doc de STOP_WORDS.
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token !== undefined && STOP_WORDS.has(token)) {
      consumed[index] = true;
    }
  }

  // Sobrou token sem tradução: não inventa. Devolve o inglês e deixa o seed
  // contar — é isso que impede tradução parcial passando por completa.
  if (consumed.some((isConsumed) => !isConsumed)) {
    return { name: englishName, strategy: 'UNTRANSLATED' };
  }

  const composed = compose(matches);
  if (composed === null) {
    return { name: englishName, strategy: 'UNTRANSLATED' };
  }

  return { name: composed, strategy: 'COMPOSITIONAL' };
}
