import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'qa.com.alhattab.ahhwfm',
  appName: 'WFM',
  webDir: 'www',
  server: {
    url: 'http://10.10.50.24:3201',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;