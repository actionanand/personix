import { Injectable } from '@angular/core';

export interface EncryptedValue {
  readonly salt: string;
  readonly iv: string;
  readonly iterations: number;
  readonly ciphertext: string;
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  readonly defaultIterations = 310_000;

  randomBytes(length: number): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  async deriveVerifier(
    secret: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256,
    );
    return new Uint8Array(bits);
  }

  async encrypt(
    text: string,
    password: string,
    iterations = this.defaultIterations,
  ): Promise<EncryptedValue> {
    const salt = this.randomBytes(16);
    const iv = this.randomBytes(12);
    const key = await this.deriveAesKey(password, salt, iterations, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(text),
    );
    return {
      salt: this.toBase64(salt),
      iv: this.toBase64(iv),
      iterations,
      ciphertext: this.toBase64(new Uint8Array(encrypted)),
    };
  }

  async decrypt(value: EncryptedValue, password: string): Promise<string> {
    const salt = this.fromBase64(value.salt);
    const iv = this.fromBase64(value.iv);
    const key = await this.deriveAesKey(password, salt, value.iterations, ['decrypt']);
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        this.fromBase64(value.ciphertext),
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      throw new Error('The backup password is incorrect or the backup is damaged.');
    }
  }

  toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  fromBase64(value: string): Uint8Array<ArrayBuffer> {
    try {
      const binary = atob(value);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
      throw new Error('The encrypted data is not valid Base64.');
    }
  }

  constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++)
      difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
    return difference === 0;
  }

  private async deriveAesKey(
    password: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
    usages: readonly KeyUsage[],
  ): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usages,
    );
  }
}
