import { createHash } from 'node:crypto';

import type {
  AIProvider,
  EmbeddingInput,
  GenerateStructuredInput,
  GenerateTextInput,
  GenerateTextResult,
} from './index';

export interface FakeAIProviderOptions {
  /** Texto fixo devolvido por generateText (default deriva do prompt). */
  cannedText?: string;
  /** Objeto fixo devolvido por generateStructured (default `{}`). */
  cannedStructured?: unknown;
  /** Dimensao do embedding deterministico (default 8). */
  embeddingDimensions?: number;
}

/**
 * Provider de IA FALSO e DETERMINISTICO (sem rede) — o fallback quando nenhum
 * provider real esta configurado e o provider usado nos testes. Nao chama modelo
 * nem fabrica credencial: apenas modela o contrato de forma previsivel para que
 * as slices que consomem IA sejam exercitaveis ponta a ponta sem infra.
 */
export class FakeAIProvider implements AIProvider {
  constructor(private readonly options: FakeAIProviderOptions = {}) {}

  generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return Promise.resolve({ text: this.options.cannedText ?? `[fake] ${input.prompt}` });
  }

  generateStructured<TOutput>(_input: GenerateStructuredInput): Promise<TOutput> {
    return Promise.resolve((this.options.cannedStructured ?? {}) as TOutput);
  }

  embed(input: EmbeddingInput): Promise<number[]> {
    const dimensions = this.options.embeddingDimensions ?? 8;
    // Vetor deterministico derivado do hash do texto (normalizado em [0,1]).
    const hash = createHash('sha256').update(input.text).digest();
    const vector = Array.from(
      { length: dimensions },
      (_, index) => (hash[index % hash.length] ?? 0) / 255,
    );
    return Promise.resolve(vector);
  }
}
