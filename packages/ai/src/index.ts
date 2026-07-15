/**
 * @fitvo/ai — contrato multi-provider de IA (D-024): interface unica
 * (gerar texto, gerar estruturado, embedding). Alem do contrato, expoe um
 * adaptador concreto (`AnthropicAIProvider`, REST via fetch, LIVE gated) e um
 * `FakeAIProvider` deterministico para testes/fallback. Trocar de provider =
 * novo adaptador, sem tocar no dominio.
 */

export interface GenerateTextInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
}

export interface GenerateStructuredInput {
  prompt: string;
  system?: string;
  /** JSON Schema (ou equivalente) que descreve a saida esperada. */
  jsonSchema: unknown;
}

export interface EmbeddingInput {
  text: string;
}

/** Provider de IA. O dominio depende desta interface, nunca do provider. */
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<TOutput>(input: GenerateStructuredInput): Promise<TOutput>;
  embed(input: EmbeddingInput): Promise<number[]>;
}

// Adaptadores concretos (D-024). O dominio depende de `AIProvider`, nunca do
// provider. O adaptador Anthropic e LIVE gated; o Fake e o fallback deterministico.
export {
  AnthropicAIProvider,
  type AnthropicConfig,
  type HttpClient,
} from './anthropic-ai-provider';
export { FakeAIProvider, type FakeAIProviderOptions } from './fake-ai-provider';
