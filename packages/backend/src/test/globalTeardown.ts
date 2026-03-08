export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Add cleanup logic here when needed
  // For now, just log that teardown is complete
  console.log('✅ Test environment cleanup complete');
}