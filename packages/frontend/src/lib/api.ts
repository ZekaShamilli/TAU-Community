import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-toastify';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api';

// Token management
const TOKEN_KEY = 'tau_kays_token';
const REFRESH_TOKEN_KEY = 'tau_kays_refresh_token';

export const getToken = (): string | null => {
  // Try new key first
  let token = localStorage.getItem(TOKEN_KEY);
  
  // Fallback to old key for backward compatibility
  if (!token) {
    token = localStorage.getItem('token');
    // If found in old key, migrate to new key
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem('token');
    }
  }
  
  return token;
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (token: string, refreshToken: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Enhanced error handling
interface ApiErrorDetails {
  field?: string;
  message: string;
  code?: string;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetails[];
    timestamp: string;
    requestId?: string;
  };
}

class ApiErrorClass extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ApiErrorDetails[];
  public readonly requestId?: string;
  public readonly timestamp: string;

  constructor(response: AxiosResponse<ApiErrorResponse>) {
    const errorData = response.data.error;
    super(errorData.message);
    
    this.name = 'ApiError';
    this.code = errorData.code;
    this.statusCode = response.status;
    this.details = errorData.details;
    this.requestId = errorData.requestId;
    this.timestamp = errorData.timestamp;
  }

  public getFieldErrors(): Record<string, string> {
    if (!this.details) return {};
    
    return this.details.reduce((acc, detail) => {
      if (detail.field) {
        acc[detail.field] = detail.message;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  public hasFieldErrors(): boolean {
    return this.details?.some(detail => detail.field) || false;
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout for better UX
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and request ID
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    console.log('🔑 Token from localStorage:', token ? token.substring(0, 50) + '...' : 'NO TOKEN');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Authorization header set');
    } else {
      console.log('❌ No token or headers available');
    }
    
    // Add request ID for tracking
    if (config.headers) {
      config.headers['X-Request-ID'] = Math.random().toString(36).substring(2, 15);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh and error handling
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle network errors
    if (!error.response) {
      toast.error('Network error. Please check your connection and try again.');
      return Promise.reject(new Error('Network error'));
    }

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          setTokens(accessToken, newRefreshToken);
          
          processQueue(null, accessToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          
          return apiClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          clearTokens();
          
          // Redirect to login
          window.location.href = '/login';
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token, redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Create ApiError for structured error responses
    if (error.response?.data?.error) {
      const apiError = new ApiErrorClass(error.response);
      
      // Don't show toast for validation errors (handled by forms)
      if (!apiError.hasFieldErrors()) {
        showErrorToast(apiError);
      }
      
      return Promise.reject(apiError);
    }

    // Handle other HTTP errors
    const statusCode = error.response?.status;
    let errorMessage = 'An unexpected error occurred';

    switch (statusCode) {
      case 400:
        errorMessage = 'Invalid request. Please check your input.';
        break;
      case 403:
        errorMessage = 'You do not have permission to perform this action.';
        break;
      case 404:
        errorMessage = 'The requested resource was not found.';
        break;
      case 409:
        errorMessage = 'This resource already exists or conflicts with existing data.';
        break;
      case 422:
        errorMessage = 'The request could not be processed due to business rules.';
        break;
      case 429:
        errorMessage = 'Too many requests. Please wait a moment and try again.';
        break;
      case 500:
        errorMessage = 'Server error. Please try again later.';
        break;
      case 502:
      case 503:
      case 504:
        errorMessage = 'Service temporarily unavailable. Please try again later.';
        break;
    }

    toast.error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
);

// Enhanced error toast display
const showErrorToast = (error: ApiErrorClass) => {
  const message = error.message || 'An unexpected error occurred';
  
  // Show different toast types based on error code
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      toast.warning(message, { autoClose: 8000 });
      break;
    case 'INSUFFICIENT_PERMISSIONS':
    case 'RESOURCE_ACCESS_DENIED':
      toast.error(message, { autoClose: false });
      break;
    case 'VALIDATION_ERROR':
    case 'BUSINESS_RULE_VIOLATION':
      toast.warning(message);
      break;
    default:
      toast.error(message);
  }
};

export default apiClient;

// API response types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Export ApiError for use in components
export { ApiErrorClass as ApiError };