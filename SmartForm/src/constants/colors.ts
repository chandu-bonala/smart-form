// Color Palette
export const COLORS = {
  // Primary colors
  PRIMARY: '#7657F7',           // Violet
  PRIMARY_LIGHT: '#ECE9FF',
  PRIMARY_DARK: '#31226F',

  // Secondary colors
  SECONDARY: '#4E84F4',         // Blue
  SECONDARY_LIGHT: '#E8F0FF',
  SECONDARY_DARK: '#295DB9',

  // Status colors
  SUCCESS: '#159A8A',
  WARNING: '#D88B20',
  ERROR: '#D9576B',
  ERROR_LIGHT: '#FFF0F3',

  // Neutral colors
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  GRAY_50: '#F8F7FF',
  GRAY_100: '#F1F0FF',
  GRAY_200: '#DED9FB',
  GRAY_300: '#C8C2E8',
  GRAY_400: '#A09BB6',
  GRAY_500: '#716C87',
  GRAY_600: '#565168',
  GRAY_700: '#3B374C',
  GRAY_800: '#272338',
  GRAY_900: '#171429',

  // Backgrounds
  BG_LIGHT: '#F6F5FF',
  BG_DARK: '#171429',

  // Borders
  BORDER: '#DED9FB',

  // Shadows
  SHADOW: 'rgba(49, 34, 111, 0.14)',
};

// Color modes
export const LIGHT_COLORS = {
  background: COLORS.WHITE,
  foreground: COLORS.GRAY_900,
  card: COLORS.GRAY_50,
  border: COLORS.GRAY_200,
  primary: COLORS.PRIMARY,
  success: COLORS.SUCCESS,
  error: COLORS.ERROR,
};

export const DARK_COLORS = {
  background: COLORS.GRAY_900,
  foreground: COLORS.WHITE,
  card: COLORS.GRAY_800,
  border: COLORS.GRAY_700,
  primary: COLORS.PRIMARY_LIGHT,
  success: COLORS.SUCCESS,
  error: COLORS.ERROR,
};
