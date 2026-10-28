import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';

const COLORS = {
  PRIMARY: '#5b4bff',
  SECONDARY: '#2ea6ff',
  WHITE: '#FFFFFF',
  ERROR: '#D9576B',
  PRIMARY_DARK: 'rgba(15, 23, 42, 0.12)',
};

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  style,
  onPress,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      {...props}
    >
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator
            color={variant === 'outline' ? COLORS.PRIMARY : COLORS.WHITE}
            size="small"
          />
        </View>
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 50,
    shadowColor: COLORS.PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 3,
  },

  primary: {
    backgroundColor: COLORS.PRIMARY,
  },
  secondary: {
    backgroundColor: COLORS.SECONDARY,
  },
  outline: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    shadowOpacity: 0.08,
  },
  danger: {
    backgroundColor: COLORS.ERROR,
  },

  size_sm: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  size_md: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  size_lg: {
    paddingVertical: 15,
    paddingHorizontal: 22,
  },

  text: {
    fontWeight: '700',
  },
  text_primary: {
    color: COLORS.WHITE,
    fontSize: 16,
  },
  text_secondary: {
    color: COLORS.WHITE,
    fontSize: 16,
  },
  text_outline: {
    color: COLORS.PRIMARY,
    fontSize: 16,
  },
  text_danger: {
    color: COLORS.WHITE,
    fontSize: 16,
  },

  disabled: {
    opacity: 0.6,
  },

  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
