import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'qa.alhattab.wfm.mobile',
  appName: 'AHH WFM Mobile',
  webDir: 'out',
  server: {
    url: 'http://192.168.1.50:3101', // Example Hosted IP, replace with dev machine IP or test domain
    cleartext: true
  }
};

export default config;
