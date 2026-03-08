/**
 * Basic setup test to verify the React testing environment is working
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple test component
const TestComponent: React.FC = () => {
  return <div>TAU Community Test Component</div>;
};

describe('Frontend Setup Test', () => {
  it('should render React components', () => {
    render(<TestComponent />);
    expect(screen.getByText('TAU Community Test Component')).toBeInTheDocument();
  });

  it('should have environment variables available', () => {
    expect(process.env.VITE_API_BASE_URL).toBeDefined();
  });

  it('should be able to use TypeScript', () => {
    const testData: { name: string; version: string } = {
      name: 'TAU Community Frontend',
      version: '1.0.0',
    };
    
    expect(testData.name).toBe('TAU Community Frontend');
    expect(testData.version).toBe('1.0.0');
  });
});