import type {
  AIProvider,
  EmbeddingInput,
  GenerateStructuredInput,
  GenerateTextInput,
  GenerateTextResult,
} from './index';

/** Configuracao do adaptador Anthropic. Segredos vem do ambiente (D-070). */
export interface AnthropicConfig {
  apiKey: string;
  /** Base da API (default https://api.anthropic.com). */
  baseUrl?: string;
  /** Modelo (ex.: claude-...). */
  model: string;
  /** Versao da API Anthropic (header `anthropic-version`). */
  anthropicVersion?: string;
  /** Teto padrao de tokens quando o chamador nao especifica. */
  defaultMaxTokens?: number;
}

/** Cliente HTTP minimo — injetavel para testar o mapeamento sem rede real. */
export type HttpClient = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Adaptador de IA multi-provider para a Anthropic (D-024), via REST puro
 * (`fetch`, sem SDK pesado — mantem o osv-scanner enxuto). Cobre `generateText`
 * e `generateStructured` (instrui JSON e faz o parse). `embed` NAO e suportado
 * pela Anthropic (recomendam provider de embedding dedicado) — lanca de forma
 * explicita: GATED (D-024) ate plugarmos um adaptador de embeddings.
 *
 * LIVE GATED: sem `ANTHROPIC_API_KEY` neste repo publico, nao ha chamada real ao
 * modelo. A montagem da request e o parse da response sao testaveis com o
 * HttpClient mockado; nenhuma chamada de rede acontece nos testes.
 */
export class AnthropicAIProvider implements AIProvider {
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly defaultMaxTokens: number;

  constructor(
    private readonly config: AnthropicConfig,
    private readonly http: HttpClient = defaultHttpClient,
  ) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.version = config.anthropicVersion ?? DEFAULT_VERSION;
    this.defaultMaxTokens = config.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const data = await this.postMessages({
      max_tokens: input.maxTokens ?? this.defaultMaxTokens,
      messages: [{ role: 'user', content: input.prompt }],
      ...(input.system !== undefined ? { system: input.system } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    });
    return { text: extractText(data) };
  }

  async generateStructured<TOutput>(input: GenerateStructuredInput): Promise<TOutput> {
    const schema = JSON.stringify(input.jsonSchema);
    const system = [
      input.system,
      `Responda SOMENTE com um JSON valido que satisfaca este JSON Schema: ${schema}.`,
      'Nao inclua texto, markdown ou comentarios fora do JSON.',
    ]
      .filter((part): part is string => Boolean(part))
      .join('\n');

    const data = await this.postMessages({
      max_tokens: this.defaultMaxTokens,
      system,
      messages: [{ role: 'user', content: input.prompt }],
    });

    const text = extractText(data);
    try {
      return JSON.parse(text) as TOutput;
    } catch {
      throw new Error('Resposta da IA nao e um JSON valido (generateStructured).');
    }
  }

  embed(_input: EmbeddingInput): Promise<number[]> {
    // A Anthropic nao oferece endpoint de embeddings (recomendam provider
    // dedicado). GATED ate plugarmos um adaptador de embeddings (D-024).
    return Promise.reject(
      new Error(
        'Embeddings nao suportados pelo provider Anthropic — use um provider de embedding dedicado (GATED — D-024).',
      ),
    );
  }

  private async postMessages(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.http(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.version,
      },
      body: JSON.stringify({ model: this.config.model, ...body }),
    });
    if (response.status >= 400) {
      throw new Error(`Anthropic respondeu ${response.status} em /v1/messages.`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

/** Extrai e concatena os blocos de texto da resposta de mensagens da Anthropic. */
function extractText(data: Record<string, unknown>): string {
  const content = data.content;
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((block) => {
      if (typeof block === 'object' && block !== null) {
        const maybe = block as { type?: unknown; text?: unknown };
        if (maybe.type === 'text' && typeof maybe.text === 'string') {
          return maybe.text;
        }
      }
      return '';
    })
    .join('');
}

/** Cliente HTTP padrao sobre o `fetch` global (Node >= 20). */
const defaultHttpClient: HttpClient = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, json: () => response.json() };
};
