import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly keys: Map<string, Buffer>;
  private readonly activeKeyVersion: string;

  constructor(private readonly configService: ConfigService) {
    const keysConfig =
      this.configService.get<string>('app.encryptionKeys') ||
      this.configService.get<string>('ENCRYPTION_KEYS');
    if (!keysConfig) {
      throw new Error('ENCRYPTION_KEYS environment variable is required');
    }

    this.keys = new Map();
    let firstVersion = '';

    const keyPairs = keysConfig.split(',');
    for (const pair of keyPairs) {
      const [version, base64Key] = pair.split(':');
      if (!version || !base64Key) {
        throw new Error(`Invalid encryption key format: ${pair}`);
      }
      const keyBuffer = Buffer.from(base64Key, 'base64');
      if (keyBuffer.length !== 32) {
        throw new Error(
          `Encryption key for ${version} must be 32 bytes (256 bits)`,
        );
      }
      this.keys.set(version, keyBuffer);
      if (!firstVersion) {
        firstVersion = version;
      }
    }

    this.activeKeyVersion = firstVersion;
    this.logger.log(
      `Encryption service initialized with key version: ${this.activeKeyVersion}`,
    );
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(16);
    const key = this.keys.get(this.activeKeyVersion);

    if (!key) {
      throw new Error(
        `Active encryption key version ${this.activeKeyVersion} not found`,
      );
    }

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${this.activeKeyVersion}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error(
        `Invalid encrypted text format: expected version:iv:authTag:ciphertext`,
      );
    }

    const [version, ivHex, authTagHex, encrypted] = parts;
    const key = this.keys.get(version);

    if (!key) {
      throw new Error(`Encryption key version ${version} not found`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  getActiveKeyVersion(): string {
    return this.activeKeyVersion;
  }
}
