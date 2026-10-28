/**
 * Validation utility functions
 */

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * At least 8 characters, contains uppercase, lowercase, and number
 */
export const isValidPassword = (password: string): boolean => {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

/**
 * Validate name (at least 3 characters, letters and spaces only)
 */
export const isValidName = (name: string): boolean => {
  if (name.length < 3) return false;
  if (!/^[a-zA-Z\s]+$/.test(name)) return false;
  return true;
};

/**
 * Get password validation error message
 */
export const getPasswordErrorMessage = (password: string): string | null => {
  if (password.length === 0) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  return null;
};

/**
 * Validate email format with error message
 */
export const getEmailErrorMessage = (email: string): string | null => {
  if (email.length === 0) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

/**
 * Validate name with error message
 */
export const getNameErrorMessage = (name: string): string | null => {
  if (name.length === 0) {
    return 'Name is required';
  }
  if (name.length < 3) {
    return 'Name must be at least 3 characters';
  }
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    return 'Name can only contain letters and spaces';
  }
  return null;
};
