import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.offsetcalc.app',
  appName: 'Offset Calculator',
  webDir: 'dist',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#f9f9f7' },
};

export default config;
