import React from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { webInputReset } from '../utils/webInputReset';

const COLORS = {
  GRAY_50: '#F8F7FF',
  GRAY_400: '#5EA0FF',
  GRAY_700: '#3B374C',
  GRAY_900: '#171429',
  BORDER: 'rgba(91, 75, 255, 0.14)',
  PRIMARY_DARK: 'rgba(15, 23, 42, 0.12)',
  ERROR: '#D9576B',
  ERROR_LIGHT: '#FFF0F3',
};

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: any;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
        <TextInput
          style={[styles.input, !!error && styles.inputError, style]}
          placeholderTextColor={COLORS.GRAY_400}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.GRAY_700,
    marginBottom: 8,
  },
  inputWrapper: {
    borderRadius: 8,
    backgroundColor: COLORS.GRAY_50,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 2,
    shadowColor: COLORS.PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  inputWrapperError: {
    backgroundColor: COLORS.ERROR_LIGHT,
  },
  input: {
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.GRAY_900,
    borderWidth: 0,
    ...webInputReset,
  },
  inputError: {
    color: COLORS.GRAY_900,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
});
