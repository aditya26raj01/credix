import { createTamagui } from 'tamagui';
import { defaultConfig } from '@tamagui/config/v5';

const config = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    disableSSR: true,
  },
});

type AppConfig = typeof config;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
