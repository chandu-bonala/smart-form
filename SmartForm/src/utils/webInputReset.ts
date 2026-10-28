import { Platform } from 'react-native';

export const webInputReset =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'solid',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
      } as const)
    : {};
