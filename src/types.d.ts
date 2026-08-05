export {};

declare global {
  interface Window {
    readonly Capacitor?: {
      isNativePlatform?(): boolean;
      getPlatform?(): string;
    };
    readonly PersonixNative?: { hideSplash(): void };
    readonly PersonixSystemBars?: { setDarkMode(dark: boolean): void };
    readonly PersonixBiometric?: {
      isAvailable(): boolean;
      enable(pin: string): void;
      disable(): void;
      authenticate(): void;
    };
    readonly PersonixMetadata?: {
      fetch(url: string, timeoutMs: number, maxImageBytes: number): void;
    };
    readonly PersonixPip?: {
      isSupported(): boolean;
      enter(width: number, height: number): void;
    };
    readonly PersonixBrowser?: {
      openInApp(url: string, title: string): void;
      openExternal(url: string): void;
    };
    readonly PersonixExport?: {
      exportBackup(content: string, filename: string): void;
    };
  }
}
