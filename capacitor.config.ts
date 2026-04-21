import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.euruslifestyleerp.app',
  appName: 'Eurus ERP',
  webDir: 'public',
  server: {
    url: 'https://epanel.euruslifestyle.in',
    cleartext: false
  }
};

export default config;
