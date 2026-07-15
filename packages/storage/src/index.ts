/**
 * @fitvo/storage — contrato de storage S3-compatible (D-026): upload,
 * download, URL assinada e remocao. Alem do contrato, expoe o adaptador
 * concreto (`S3StorageProvider`, LIVE gated) e a store em memoria
 * (`InMemoryStorage`) para testes e dev local.
 */

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
}

export interface StorageProvider {
  put(input: PutObjectInput): Promise<{ key: string }>;
  get(key: string): Promise<Uint8Array>;
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Adaptadores concretos (D-026). O dominio depende apenas de `StorageProvider`.
export { InMemoryStorage } from './in-memory-storage';
export {
  buildS3ClientConfig,
  type S3StorageConfig,
  S3StorageProvider,
} from './s3-storage-provider';
