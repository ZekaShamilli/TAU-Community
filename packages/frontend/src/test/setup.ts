import '@testing-library/jest-dom';

// Mock environment variables for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Set test environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:3001/api';
process.env.VITE_APP_NAME = 'TAU Community Test';
process.env.VITE_NODE_ENV = 'test';