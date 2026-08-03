import { inject, Injectable } from '@angular/core';
import { PinParameters } from '../models/app.models';
import { CryptoService } from './crypto.service';

const PIN_ITERATIONS = 310_000;

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly crypto = inject(CryptoService);

  async createPin(pin: string): Promise<PinParameters> {
    this.validatePin(pin);
    const salt = this.crypto.randomBytes(16);
    const verifier = await this.crypto.deriveVerifier(pin, salt, PIN_ITERATIONS);
    return {
      algorithm: 'PBKDF2-SHA-256',
      version: 1,
      iterations: PIN_ITERATIONS,
      salt: this.crypto.toBase64(salt),
      verifier: this.crypto.toBase64(verifier),
    };
  }

  async verifyPin(pin: string, parameters: PinParameters | null): Promise<boolean> {
    if (!parameters) return true;
    const derived = await this.crypto.deriveVerifier(
      pin,
      this.crypto.fromBase64(parameters.salt),
      parameters.iterations,
    );
    return this.crypto.constantTimeEqual(derived, this.crypto.fromBase64(parameters.verifier));
  }

  validatePin(pin: string): void {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Use a numeric PIN with 4 to 8 digits.');
  }
}
