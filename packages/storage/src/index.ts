/**
 * @fitvo/storage — contrato de storage S3-compatible (D-026): upload,
 * download, URL assinada e remocao. Interfaces apenas; adaptador (provedor
 * escolhido por custo de egress) em fase posterior.
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
