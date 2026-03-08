/**
 * Integration Test Script
 * Tests the end-to-end functionality of the TAU KAYS system
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3002/api';

async function runIntegrationTests() {
  console.log('🚀 Starting TAU KAYS Integration Tests...\n');

  const tests = [
    {
      name: 'Health Check',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/../health`);
        return response.status === 200 && response.data.status === 'OK';
      }
    },
    {
      name: 'API Info',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}`);
        return response.status === 200 && response.data.message === 'TAU KAYS API Server';
      }
    },
    {
      name: 'Auth Health Check',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/auth/health`);
        return response.status === 200 && response.data.service === 'Authentication Service';
      }
    },
    {
      name: 'Mock Login',
      test: async () => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          email: 'test@example.com',
          password: 'password123'
        });
        return response.status === 200 && response.data.success === true;
      }
    },
    {
      name: 'Get Current User',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/auth/me`);
        return response.status === 200 && response.data.success === true;
      }
    },
    {
      name: 'List Clubs',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/clubs`);
        return response.status === 200 && response.data.success === true && Array.isArray(response.data.data);
      }
    },
    {
      name: 'Get Club by Slug',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/clubs/slug/computer-science-club`);
        return response.status === 200 && response.data.success === true && response.data.data.name === 'Computer Science Club';
      }
    },
    {
      name: 'List Activities',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/activities`);
        return response.status === 200 && response.data.success === true && Array.isArray(response.data.data);
      }
    },
    {
      name: 'Get Upcoming Activities',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/activities/upcoming`);
        return response.status === 200 && response.data.success === true && Array.isArray(response.data.data);
      }
    },
    {
      name: 'Get Club Activities',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/activities/club/1`);
        return response.status === 200 && response.data.success === true && Array.isArray(response.data.data);
      }
    },
    {
      name: 'List Applications',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/applications`);
        return response.status === 200 && response.data.success === true && Array.isArray(response.data.data);
      }
    },
    {
      name: 'Submit Application',
      test: async () => {
        const response = await axios.post(`${API_BASE_URL}/applications`, {
          clubId: '1',
          studentName: 'Integration Test Student',
          studentEmail: 'integration@test.com',
          motivation: 'Testing the application submission functionality.'
        });
        return response.status === 201 && response.data.success === true;
      }
    },
    {
      name: 'Integration Test Endpoint',
      test: async () => {
        const response = await axios.get(`${API_BASE_URL}/test/integration`);
        return response.status === 200 && response.data.success === true;
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.test();
      if (result) {
        console.log(`✅ ${test.name}: PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: FAILED (assertion failed)`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED (${error.message})`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All integration tests passed! The TAU KAYS system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the backend services.');
  }
}

// Run the tests
runIntegrationTests().catch(console.error);