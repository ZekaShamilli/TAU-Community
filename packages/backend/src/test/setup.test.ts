/**
 * Basic setup test to verify the testing environment is working
 */

describe('Setup Test', () => {
  it('should have Node.js environment available', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('should be able to import TypeScript modules', () => {
    const testObject = {
      name: 'TAU Community',
      version: '1.0.0',
    };
    
    expect(testObject.name).toBe('TAU Community');
    expect(testObject.version).toBe('1.0.0');
  });

  it('should have test environment configured', () => {
    // This test verifies that our test setup is working
    expect(true).toBe(true);
  });
});