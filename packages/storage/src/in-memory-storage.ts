import type { PutObjectInput, SignedUrlOptions, StorageProvider } from './index';

interface StoredObject {
  body: Uint8Array;
  contentType?: string;
}

/**
 * Storage em memoria (Map), DETERMINISTICO e sem infra — o fake do contrato
 * `StorageProvider` para testes e dev local. `getSignedUrl` devolve um stub
 * previsivel (`memory://...`) para que fluxos que dependem de URL assinada sejam
 * exercitaveis sem um S3 real.
 */
export class InMemoryStorage implements StorageProvider {
  private readonly objects = new Map<string, StoredObject>();

  put(input: PutObjectInput): Promise<{ key: string }> {
    const object: StoredObject = { body: input.body };
    if (input.contentType !== undefined) {
      object.contentType = input.contentType;
    }
    this.objects.set(input.key, object);
    return Promise.resolve({ key: input.key });
  }

  get(key: string): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) {
      return Promise.reject(new Error(`Objeto nao encontrado: ${key}`));
    }
    return Promise.resolve(object.body);
  }

  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresInSeconds ?? 900;
    return Promise.resolve(`memory://${encodeURIComponent(key)}?expiresIn=${expiresIn}`);
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(key));
  }
}
