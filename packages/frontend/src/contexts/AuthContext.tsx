import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getToken, clearTokens } from '../lib/api';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string; totpCode?: string } | { user: User; tokens: any }) => Promise<{ requiresTwoFactor?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  canAccessClub: (clubId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!getToken();

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          await refreshUser();
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          clearTokens();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: { email: string; password: string; totpCode?: string } | { user: User; tokens: any }) => {
    try {
      // Check if it's Google OAuth login (has user and tokens)
      if ('user' in credentials && 'tokens' in credentials) {
        setUser(credentials.user);
        return {};
      }
      
      // Regular email/password login
      const { email, password, totpCode } = credentials as { email: string; password: string; totpCode?: string };
      const response = await authService.login({ email, password, totpCode });
      
      if (response.requiresTwoFactor) {
        return { requiresTwoFactor: true };
      }

      setUser(response.user);
      return {};
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      clearTokens();
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      clearTokens();
      throw error;
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const canAccessClub = (clubId: string): boolean => {
    if (!user) return false;
    
    // Super Admin can access all clubs
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Club President can only access their own club
    if (user.role === UserRole.CLUB_PRESIDENT) {
      return user.clubId === clubId;
    }
    
    // Students can view public club information
    if (user.role === UserRole.STUDENT) return true;
    
    return false;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
    hasRole,
    hasAnyRole,
    canAccessClub,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Custom hooks for specific roles
export const useIsSuperAdmin = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole(UserRole.SUPER_ADMIN);
};

export const useIsClubPresident = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole(UserRole.CLUB_PRESIDENT);
};

export const useIsStudent = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole(UserRole.STUDENT);
};

export const useCanAccessClub = (clubId: string): boolean => {
  const { canAccessClub } = useAuth();
  return canAccessClub(clubId);
};