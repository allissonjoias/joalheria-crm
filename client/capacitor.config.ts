import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alissonjoalheria.ialisson',
  appName: 'IAlisson',
  webDir: 'dist',
  server: {
    // Para desenvolvimento: permite conexoes HTTP (nao HTTPS)
    cleartext: true,
    allowNavigation: ['192.168.31.238'],
  },
};

export default config;
