import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.personix.app',
  appName: 'Personix',
  webDir: 'dist/personix/browser',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#07140f' },
  plugins: {
    SplashScreen: { launchShowDuration: 1800, backgroundColor: '#07140f', showSpinner: false },
  },
};

export default config;
