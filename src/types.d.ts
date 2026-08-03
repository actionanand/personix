export {};

declare global {
  interface Window {
    readonly Capacitor?: {
      readonly Plugins?: {
        readonly CapacitorSQLite?: {
          isConnection(options: Record<string, unknown>): Promise<{ readonly result?: boolean }>;
          createConnection(options: Record<string, unknown>): Promise<void>;
          isDBOpen(options: Record<string, unknown>): Promise<{ readonly result?: boolean }>;
          open(options: Record<string, unknown>): Promise<void>;
          execute(options: Record<string, unknown>): Promise<unknown>;
          query(
            options: Record<string, unknown>,
          ): Promise<{ readonly values?: readonly unknown[] }>;
          run(options: Record<string, unknown>): Promise<unknown>;
          beginTransaction(options: Record<string, unknown>): Promise<unknown>;
          commitTransaction(options: Record<string, unknown>): Promise<unknown>;
          rollbackTransaction(options: Record<string, unknown>): Promise<unknown>;
        };
      };
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
  }
}
