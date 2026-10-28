import { httpClient, authService } from '../api';
import { getErrorMessage } from '../api/client';

/**
 * Test utilities for debugging API connection and auth flow
 */

export const testUtils = {
  /**
   * Test backend connectivity
   */
  async testBackendConnection(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const response = await httpClient.get('/../../health');
      return {
        success: response.status === 200,
        message: `Backend is reachable. Status: ${response.status}`,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: 'Backend is not reachable',
        error: message,
      };
    }
  },

  /**
   * Test registration
   */
  async testRegistration(name: string, email: string, password: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await authService.register({
        name,
        email,
        password,
      });
      return {
        success: true,
        message: 'Registration successful',
        data: response,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: 'Registration failed',
        error: message,
      };
    }
  },

  /**
   * Test login
   */
  async testLogin(email: string, password: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await authService.login({
        email,
        password,
      });
      return {
        success: true,
        message: 'Login successful',
        data: response,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: 'Login failed',
        error: message,
      };
    }
  },

  /**
   * Test get current user (requires token)
   */
  async testGetUser(): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await authService.getMe();
      return {
        success: true,
        message: 'Get user successful',
        data: response,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: 'Get user failed',
        error: message,
      };
    }
  },

  /**
   * Test logout
   */
  async testLogout(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      await authService.logout();
      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: 'Logout failed',
        error: message,
      };
    }
  },

  /**
   * Run full auth flow test
   */
  async runFullAuthTest(testEmail: string, testPassword: string): Promise<
    {
      step: string;
      success: boolean;
      message: string;
    }[]
  > {
    const results = [];

    // Test 1: Backend connectivity
    console.log('🧪 Testing backend connectivity...');
    const connTest = await this.testBackendConnection();
    results.push({
      step: 'Backend Connection',
      success: connTest.success,
      message: connTest.message,
    });

    if (!connTest.success) {
      console.error('❌ Backend not reachable. Stopping tests.');
      return results;
    }

    // Test 2: Registration
    console.log('🧪 Testing registration...');
    const testName = 'Test User';
    const testNewEmail = `test_${Date.now()}@example.com`;
    const regTest = await this.testRegistration(testName, testNewEmail, testPassword);
    results.push({
      step: 'Registration',
      success: regTest.success,
      message: regTest.message,
    });

    if (regTest.success) {
      console.log('✅ Registration successful');
    } else {
      console.error('❌ Registration failed:', regTest.error);
    }

    // Test 3: Login
    console.log('🧪 Testing login...');
    const loginTest = await this.testLogin(testEmail || testNewEmail, testPassword);
    results.push({
      step: 'Login',
      success: loginTest.success,
      message: loginTest.message,
    });

    if (loginTest.success) {
      console.log('✅ Login successful');
    } else {
      console.error('❌ Login failed:', loginTest.error);
    }

    // Test 4: Get Current User
    console.log('🧪 Testing get current user...');
    const userTest = await this.testGetUser();
    results.push({
      step: 'Get Current User',
      success: userTest.success,
      message: userTest.message,
    });

    if (userTest.success) {
      console.log('✅ Get user successful:', userTest.data);
    } else {
      console.error('❌ Get user failed:', userTest.error);
    }

    // Test 5: Logout
    console.log('🧪 Testing logout...');
    const logoutTest = await this.testLogout();
    results.push({
      step: 'Logout',
      success: logoutTest.success,
      message: logoutTest.message,
    });

    if (logoutTest.success) {
      console.log('✅ Logout successful');
    } else {
      console.error('❌ Logout failed:', logoutTest.error);
    }

    return results;
  },
};
