import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the API client
jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

// Mock the services
jest.mock('../services/authService', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../services/clubService', () => ({
  clubService: {
    getClubs: jest.fn(() => Promise.resolve({ data: [], pagination: {} })),
    getClubBySlug: jest.fn(),
  },
}));

jest.mock('../services/activityService', () => ({
  activityService: {
    getUpcomingActivities: jest.fn(() => Promise.resolve([])),
    getClubActivities: jest.fn(() => Promise.resolve([])),
  },
}));

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <AuthProvider>
            {children}
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('renders homepage by default', async () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Discover Student Clubs')).toBeInTheDocument();
    });
  });

  test('renders login page when navigating to /login', async () => {
    // Mock window.location
    delete (window as any).location;
    window.location = { ...window.location, pathname: '/login' };

    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    // The login form should be rendered
    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });
  });

  test('handles dynamic club routes', async () => {
    // Mock the club service to return a club
    const mockClub = {
      id: '1',
      name: 'Test Club',
      description: 'A test club',
      urlSlug: 'test-club',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { clubService } = require('../services/clubService');
    clubService.getClubBySlug.mockResolvedValue(mockClub);

    // Mock window.location for club page
    delete (window as any).location;
    window.location = { ...window.location, pathname: '/kulup/test-club' };

    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Club')).toBeInTheDocument();
    });
  });

  test('renders 404 page for unknown routes', async () => {
    // Mock window.location for unknown route
    delete (window as any).location;
    window.location = { ...window.location, pathname: '/unknown-route' };

    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    });
  });
});

describe('Route Utilities', () => {
  test('generates correct club URLs', () => {
    const { getClubUrl } = require('../utils/routes');
    expect(getClubUrl('test-club')).toBe('/kulup/test-club');
  });

  test('extracts club slug from URL', () => {
    const { extractClubSlug } = require('../utils/routes');
    expect(extractClubSlug('/kulup/test-club')).toBe('test-club');
    expect(extractClubSlug('/kulup/another-club')).toBe('another-club');
    expect(extractClubSlug('/other-path')).toBeNull();
  });

  test('validates club slug format', () => {
    const { isValidClubSlug } = require('../utils/routes');
    expect(isValidClubSlug('test-club')).toBe(true);
    expect(isValidClubSlug('test123')).toBe(true);
    expect(isValidClubSlug('test-club-123')).toBe(true);
    expect(isValidClubSlug('Test Club')).toBe(false); // spaces not allowed
    expect(isValidClubSlug('test_club')).toBe(false); // underscores not allowed
    expect(isValidClubSlug('a')).toBe(false); // too short
  });

  test('generates club slug from name', () => {
    const { generateClubSlug } = require('../utils/routes');
    expect(generateClubSlug('Test Club')).toBe('test-club');
    expect(generateClubSlug('Computer Science Club')).toBe('computer-science-club');
    expect(generateClubSlug('Müzik Kulübü')).toBe('muzik-kulubu'); // Turkish characters
    expect(generateClubSlug('Art & Design Club')).toBe('art-design-club');
  });

  test('identifies club pages correctly', () => {
    const { isClubPage } = require('../utils/routes');
    expect(isClubPage('/kulup/test-club')).toBe(true);
    expect(isClubPage('/kulup/another-club')).toBe(true);
    expect(isClubPage('/admin')).toBe(false);
    expect(isClubPage('/')).toBe(false);
  });

  test('returns correct dashboard URLs for user roles', () => {
    const { getDashboardUrl } = require('../utils/routes');
    expect(getDashboardUrl('SUPER_ADMIN')).toBe('/admin');
    expect(getDashboardUrl('CLUB_PRESIDENT')).toBe('/club-dashboard');
    expect(getDashboardUrl('STUDENT')).toBe('/');
    expect(getDashboardUrl('UNKNOWN')).toBe('/');
  });
});