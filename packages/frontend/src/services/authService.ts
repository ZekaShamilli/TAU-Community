import apiClient, { setTokens, clearTokens } from '../lib/api';
import { LoginRequest, LoginResponse, RefreshTokenRequest, User } from '../types';

export const authService = {
  async signUp(userData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/signup', userData);
    return response.data;
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', credentials);
    
    // Handle backend response format: { success: true, data: { tokens, user } }
    const data = response.data.data || response.data;
    
    if (data.tokens) {
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        user: data.user,
        requiresTwoFactor: false
      };
    }
    
    // Handle error cases
    if (response.data.error?.requiresTOTP) {
      return {
        requiresTwoFactor: true
      };
    }
    
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await apiClient.post('/auth/logout-all');
    } finally {
      clearTokens();
    }
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', { refreshToken });
    
    if (response.data.accessToken && response.data.refreshToken) {
      setTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return response.data.data?.user || response.data.data || response.data;
  },

  async generateTotpSecret(): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const response = await apiClient.post('/auth/totp/generate');
    return response.data;
  },

  async enableTotp(totpCode: string): Promise<{ backupCodes: string[] }> {
    const response = await apiClient.post('/auth/totp/enable', { totpCode });
    return response.data;
  },

  async disableTotp(totpCode: string): Promise<void> {
    await apiClient.post('/auth/totp/disable', { totpCode });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/password/reset-request', { email });
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/password/reset-confirm', { token, newPassword });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/password/change', { currentPassword, newPassword });
  },

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await apiClient.get('/auth/health');
    return response.data;
  },

  async googleSignIn(credential: string): Promise<any> {
    const response = await apiClient.post('/auth/google', { credential });
    
    // Handle backend response format: { success: true, data: { tokens, user } }
    const data = response.data.data || response.data;
    
    if (data.tokens) {
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return {
        success: true,
        data: {
          user: data.user,
          tokens: data.tokens,
        },
      };
    }
    
    return response.data;
  },

  async sendVerificationCode(email: string): Promise<void> {
    await apiClient.post('/auth/send-verification-code', { email });
  },

  async verifyEmail(email: string, code: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { email, code });
  }
};