/**
 * @fitvo/ai — contrato multi-provider de IA (D-024): interface unica
 * (gerar texto, gerar estruturado, embedding) com adaptadores plugaveis
 * (OpenAI, Anthropic, Gemini, DeepSeek, local). Interfaces apenas na Fase 1.
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
