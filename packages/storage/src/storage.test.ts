import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import { buildS3ClientConfig, InMemoryStorage, S3StorageProvider } from './index';

describe('InMemoryStorage', () => {
  it('faz roundtrip de put/get e reporta existencia', async () => {
    const storage = new InMemoryStorage();
    const body = new Uint8Array([1, 2, 3]);
    await storage.put({ key: 'a/b.txt', body, contentType: 'text/plain' });

    expect(await storage.get('a/b.txt')).toEqual(body);
    expect(await storage.exists('a/b.txt')).toBe(true);
    expect(await storage.exists('ausente')).toBe(false);
  });

  it('remove o objeto (delete)', async () => {
    const storage = new InMemoryStorage();
    await storage.put({ key: 'k', body: new Uint8Array([9]) });
    await storage.delete('k');
    expect(await storage.exists('k')).toBe(false);
  });

  it('rejeita get de chave inexistente', async () => {
    const storage = new InMemoryStorage();
    await expect(storage.get('nope')).rejects.toThrow(/nao encontrado/);
  });

  it('devolve uma signed URL deterministica (stub)', async () => {
    const storage = new InMemoryStorage();
    expect(await storage.getSignedUrl('a b/c.txt', { expiresInSeconds: 60 })).toBe(
      'memory://a%20b%2Fc.txt?expiresIn=60',
    );
  });
});

describe('buildS3ClientConfig', () => {
  it('inclui apenas os campos opcionais fornecidos', () => {
    expect(buildS3ClientConfig({ region: 'us-east-1', bucket: 'b' })).toEqual({
      region: 'us-east-1',
    });
    expect(
      buildS3ClientConfig({
        region: 'auto',
        bucket: 'b',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      }),
    ).toEqual({
      region: 'auto',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      credentials: { accessKeyId: 'ak', secretAccessKey: 'sk' },
    });
  });
});

/**
 * Adaptador S3 com o S3Client INJETADO e `send` espionado — exercita a montagem
 * dos comandos sem NENHUMA chamada de rede (LIVE gated: sem credenciais reais).
 */
describe('S3StorageProvider (send mockado — LIVE gated)', () => {
  function makeProvider() {
    const client = new S3Client({
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    const provider = new S3StorageProvider({ region: 'us-east-1', bucket: 'fitvo' }, client);
    return { client, provider };
  }

  it('monta PutObjectCommand com bucket, key, body e contentType', async () => {
    const { client, provider } = makeProvider();
    const send = vi.spyOn(client, 'send').mockResolvedValue({} as never);
    const body = new Uint8Array([1, 2, 3]);

    const result = await provider.put({ key: 'docs/x.pdf', body, contentType: 'application/pdf' });

    expect(result).toEqual({ key: 'docs/x.pdf' });
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'fitvo',
      Key: 'docs/x.pdf',
      Body: body,
      ContentType: 'application/pdf',
    });
  });

  it('le o corpo do GetObjectCommand como bytes', async () => {
    const { client, provider } = makeProvider();
    const bytes = new Uint8Array([4, 5, 6]);
    const send = vi
      .spyOn(client, 'send')
      .mockResolvedValue({ Body: { transformToByteArray: () => Promise.resolve(bytes) } } as never);

    const out = await provider.get('docs/x.pdf');

    expect(out).toEqual(bytes);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it('exists devolve true/false conforme HeadObject (404 => false)', async () => {
    const { client, provider } = makeProvider();
    const send = vi.spyOn(client, 'send');

    send.mockResolvedValueOnce({} as never);
    expect(await provider.exists('presente')).toBe(true);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);

    send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    expect(await provider.exists('ausente')).toBe(false);
  });

  it('exists propaga erros que nao sejam "nao encontrado"', async () => {
    const { client, provider } = makeProvider();
    vi.spyOn(client, 'send').mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(provider.exists('x')).rejects.toThrow(/AccessDenied/);
  });

  it('delete emite DeleteObjectCommand', async () => {
    const { client, provider } = makeProvider();
    const send = vi.spyOn(client, 'send').mockResolvedValue({} as never);
    await provider.delete('docs/x.pdf');
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('assina uma URL offline (presigner) contendo bucket, key e assinatura', async () => {
    const { provider } = makeProvider();
    const url = await provider.getSignedUrl('docs/x.pdf', { expiresInSeconds: 120 });
    expect(url).toContain('/fitvo/docs/x.pdf');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=120');
  });
});
