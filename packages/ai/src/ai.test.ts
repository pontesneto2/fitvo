import { describe, expect, it, vi } from 'vitest';

import { AnthropicAIProvider, FakeAIProvider, type HttpClient } from './index';

describe('FakeAIProvider', () => {
  it('gera texto deterministico a partir do prompt (ou canned)', async () => {
    expect(await new FakeAIProvider().generateText({ prompt: 'oi' })).toEqual({
      text: '[fake] oi',
    });
    expect(await new FakeAIProvider({ cannedText: 'fixo' }).generateText({ prompt: 'x' })).toEqual({
      text: 'fixo',
    });
  });

  it('devolve o objeto estruturado canned', async () => {
    const provider = new FakeAIProvider({ cannedStructured: { plano: 'A' } });
    const out = await provider.generateStructured<{ plano: string }>({
      prompt: 'p',
      jsonSchema: {},
    });
    expect(out).toEqual({ plano: 'A' });
  });

  it('gera embeddings deterministicos e estaveis para o mesmo texto', async () => {
    const provider = new FakeAIProvider({ embeddingDimensions: 4 });
    const a = await provider.embed({ text: 'saude' });
    const b = await provider.embed({ text: 'saude' });
    expect(a).toHaveLength(4);
    expect(a).toEqual(b);
    expect(a.every((n) => n >= 0 && n <= 1)).toBe(true);
  });
});

describe('AnthropicAIProvider (HTTP mockado — LIVE gated)', () => {
  const config = {
    apiKey: 'placeholder-key',
    model: 'claude-test',
    baseUrl: 'https://api.anthropic.com',
  };

  it('monta a request de /v1/messages com headers e body, e extrai o texto', async () => {
    const calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
    const http: HttpClient = (url, init) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return Promise.resolve({
        status: 200,
        json: () =>
          Promise.resolve({
            content: [
              { type: 'text', text: 'Ola ' },
              { type: 'text', text: 'mundo' },
            ],
          }),
      });
    };
    const provider = new AnthropicAIProvider(config, http);

    const result = await provider.generateText({
      prompt: 'gere um treino',
      system: 'seja conciso',
      maxTokens: 256,
      temperature: 0.2,
    });

    expect(result).toEqual({ text: 'Ola mundo' });
    const [call] = calls;
    expect(call?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call?.headers['x-api-key']).toBe('placeholder-key');
    expect(call?.headers['anthropic-version']).toBe('2023-06-01');
    expect(call?.body).toMatchObject({
      model: 'claude-test',
      max_tokens: 256,
      system: 'seja conciso',
      temperature: 0.2,
      messages: [{ role: 'user', content: 'gere um treino' }],
    });
  });

  it('generateStructured instrui JSON e faz o parse da resposta', async () => {
    const http: HttpClient = (_url, init) => {
      const body = JSON.parse(init.body) as { system?: string };
      expect(body.system).toContain('JSON');
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ content: [{ type: 'text', text: '{"ok":true}' }] }),
      });
    };
    const provider = new AnthropicAIProvider(config, http);
    const out = await provider.generateStructured<{ ok: boolean }>({
      prompt: 'estruture',
      jsonSchema: { type: 'object' },
    });
    expect(out).toEqual({ ok: true });
  });

  it('lanca quando a resposta estruturada nao e JSON valido', async () => {
    const http: HttpClient = () =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'nao-json' }] }),
      });
    const provider = new AnthropicAIProvider(config, http);
    await expect(provider.generateStructured({ prompt: 'p', jsonSchema: {} })).rejects.toThrow(
      /JSON valido/,
    );
  });

  it('lanca em resposta HTTP de erro', async () => {
    const http: HttpClient = () =>
      Promise.resolve({ status: 401, json: () => Promise.resolve({}) });
    const provider = new AnthropicAIProvider(config, http);
    await expect(provider.generateText({ prompt: 'x' })).rejects.toThrow(/401/);
  });

  it('embed e GATED na Anthropic (rejeita de forma explicita, sem rede)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const provider = new AnthropicAIProvider(config);
    await expect(provider.embed({ text: 'x' })).rejects.toThrow(/Embeddings nao suportados/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
