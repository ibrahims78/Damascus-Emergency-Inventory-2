import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'syrian.emergency.inventory',
  appName: 'Damascus Emergency Inventory',
  webDir: 'artifacts/web/dist/public',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;