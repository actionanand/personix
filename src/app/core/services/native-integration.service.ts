import { Injectable } from '@angular/core';

export interface NativeMetadataResult {
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly url?: string;
  readonly logo?: string;
  readonly siteName?: string;
}

@Injectable({ providedIn: 'root' })
export class NativeIntegrationService {
  isAndroid(): boolean {
    return (
      window.Capacitor?.isNativePlatform?.() === true &&
      window.Capacitor.getPlatform?.() === 'android'
    );
  }

  setDarkMode(dark: boolean): void {
    window.PersonixSystemBars?.setDarkMode(dark);
  }

  hideSplash(): void {
    window.PersonixNative?.hideSplash();
  }

  biometricAvailable(): boolean {
    return this.isAndroid() && window.PersonixBiometric?.isAvailable() === true;
  }

  async enableBiometric(pin: string): Promise<void> {
    if (!window.PersonixBiometric)
      throw new Error('Biometric security is unavailable on this device.');
    await this.waitForResult('biometric-enabled', () => window.PersonixBiometric?.enable(pin));
  }

  async disableBiometric(): Promise<void> {
    window.PersonixBiometric?.disable();
  }

  async biometricUnlock(): Promise<string> {
    if (!window.PersonixBiometric)
      throw new Error('Biometric security is unavailable on this device.');
    return this.waitForResult('biometric-unlock', () => window.PersonixBiometric?.authenticate());
  }

  async fetchMetadata(
    url: string,
    timeoutMs: number,
    maxImageBytes: number,
  ): Promise<NativeMetadataResult | null> {
    if (!window.PersonixMetadata) return null;
    const data = await this.waitForResult('metadata-fetch', () =>
      window.PersonixMetadata?.fetch(url, timeoutMs, maxImageBytes),
    );
    try {
      return JSON.parse(data) as NativeMetadataResult;
    } catch {
      return null;
    }
  }

  private waitForResult(action: string, invoke: () => void, timeoutMs = 60_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Android did not complete the request in time.'));
      }, timeoutMs);
      const listener = (event: Event) => {
        const detail = (
          event as CustomEvent<{
            readonly action: string;
            readonly success: boolean;
            readonly data: string;
            readonly message: string;
          }>
        ).detail;
        if (detail.action !== action) return;
        cleanup();
        if (detail.success) resolve(detail.data);
        else reject(new Error(detail.message || 'Android request failed.'));
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener('personix-native-result', listener);
      };
      window.addEventListener('personix-native-result', listener);
      invoke();
    });
  }
}
