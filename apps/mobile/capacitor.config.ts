import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'qa.com.alhattab.ahhwfm',
  appName: 'AHH WFM',
  webDir: 'out',

  server: {
    url: 'http://10.10.50.24:3201',
    cleartext: true,
    allowNavigation: [
      '10.10.50.24',
    ],
  },

  android: {
    allowMixedContent: true,
  },
};

export default config;