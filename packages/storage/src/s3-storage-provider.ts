import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { PutObjectInput, SignedUrlOptions, StorageProvider } from './index';

/**
 * Configuracao do adaptador S3-compatible. "S3-compatible" nao implica AWS
 * (ADR-0005: escolher provedor por custo de egress) — dai `endpoint` e
 * `forcePathStyle` (MinIO, R2, Backblaze etc.). Todas as credenciais vem do
 * ambiente e sao OPCIONAIS: sem elas a DI cai para `InMemoryStorage`.
 */
export interface S3StorageConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/** Monta a config do S3Client a partir da config do dominio (campos opcionais). */
export function buildS3ClientConfig(config: S3StorageConfig): S3ClientConfig {
  const clientConfig: S3ClientConfig = { region: config.region };
  if (config.endpoint !== undefined) {
    clientConfig.endpoint = config.endpoint;
  }
  if (config.forcePathStyle !== undefined) {
    clientConfig.forcePathStyle = config.forcePathStyle;
  }
  if (config.accessKeyId !== undefined && config.secretAccessKey !== undefined) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }
  return clientConfig;
}

/**
 * Adaptador concreto de `StorageProvider` sobre S3 (@aws-sdk/client-s3) — D-026.
 * LIVE GATED: sem credenciais neste repo publico, nao ha chamada real a um S3;
 * a montagem de comandos e a assinatura de URL (offline, via presigner) sao
 * testaveis. O S3Client e INJETAVEL para testar `send` sem rede.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig, client?: S3Client) {
    this.bucket = config.bucket;
    this.client = client ?? new S3Client(buildS3ClientConfig(config));
  }

  async put(input: PutObjectInput): Promise<{ key: string }> {
    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
    };
    if (input.contentType !== undefined) {
      commandInput.ContentType = input.contentType;
    }
    await this.client.send(new PutObjectCommand(commandInput));
    return { key: input.key };
  }

  async get(key: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Objeto sem corpo: ${key}`);
    }
    return bytes;
  }

  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: options?.expiresInSeconds ?? 900,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }
}

/** Reconhece o "objeto inexistente" do S3 (HeadObject) sem tratar outros erros. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  if (name === 'NotFound' || name === 'NoSuchKey') {
    return true;
  }
  const status = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode;
  return status === 404;
}
