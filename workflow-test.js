/**
 * Workflow Test Script
 * Tests complete user workflows for the TAU Community system
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3002/api';

async function testStudentWorkflow() {
  console.log('👨‍🎓 Testing Student Workflow...\n');

  try {
    // 1. Student visits homepage and sees clubs
    console.log('1. Student browses available clubs...');
    const clubsResponse = await axios.get(`${API_BASE_URL}/clubs`);
    const clubs = clubsResponse.data.data;
    console.log(`   Found ${clubs.length} active clubs`);
    clubs.forEach(club => {
      console.log(`   - ${club.name}: ${club.description}`);
    });

    // 2. Student views upcoming activities
    console.log('\n2. Student checks upcoming activities...');
    const activitiesResponse = await axios.get(`${API_BASE_URL}/activities/upcoming`);
    const activities = activitiesResponse.data.data;
    console.log(`   Found ${activities.length} upcoming activities`);
    activities.forEach(activity => {
      console.log(`   - ${activity.title} by ${activity.club.name} at ${activity.location}`);
    });

    // 3. Student selects a club to learn more
    console.log('\n3. Student explores Computer Science Club...');
    const clubResponse = await axios.get(`${API_BASE_URL}/clubs/slug/computer-science-club`);
    const club = clubResponse.data.data;
    console.log(`   Club: ${club.name}`);
    console.log(`   Description: ${club.description}`);
    console.log(`   URL: /kulup/${club.urlSlug}`);

    // 4. Student views club activities
    console.log('\n4. Student views club activities...');
    const clubActivitiesResponse = await axios.get(`${API_BASE_URL}/activities/club/${club.id}`);
    const clubActivities = clubActivitiesResponse.data.data;
    console.log(`   Found ${clubActivities.length} activities for this club`);
    clubActivities.forEach(activity => {
      console.log(`   - ${activity.title}: ${activity.description}`);
    });

    // 5. Student submits application
    console.log('\n5. Student submits application...');
    const applicationData = {
      clubId: club.id,
      studentName: 'Alice Johnson',
      studentEmail: 'alice.johnson@student.tau.edu',
      motivation: 'I am passionate about computer science and want to contribute to the club by sharing my knowledge in web development and participating in coding workshops.'
    };

    const applicationResponse = await axios.post(`${API_BASE_URL}/applications`, applicationData);
    console.log(`   Application submitted successfully!`);
    console.log(`   Application ID: ${applicationResponse.data.data.id}`);
    console.log(`   Status: ${applicationResponse.data.data.status}`);

    console.log('\n✅ Student workflow completed successfully!\n');
    return true;

  } catch (error) {
    console.log(`❌ Student workflow failed: ${error.message}\n`);
    return false;
  }
}

async function testClubPresidentWorkflow() {
  console.log('👨‍💼 Testing Club President Workflow...\n');

  try {
    // 1. Club President logs in
    console.log('1. Club President logs in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'president@cs-club.tau.edu',
      password: 'securePassword123'
    });
    console.log(`   Login successful for: ${loginResponse.data.data.user.firstName} ${loginResponse.data.data.user.lastName}`);

    // 2. Club President views their club
    console.log('\n2. Club President views their club...');
    const clubResponse = await axios.get(`${API_BASE_URL}/clubs/slug/computer-science-club`);
    const club = clubResponse.data.data;
    console.log(`   Managing club: ${club.name}`);

    // 3. Club President views applications
    console.log('\n3. Club President reviews applications...');
    const applicationsResponse = await axios.get(`${API_BASE_URL}/applications`);
    const applications = applicationsResponse.data.data;
    const pendingApplications = applications.filter(app => app.status === 'PENDING');
    console.log(`   Found ${pendingApplications.length} pending applications`);
    pendingApplications.forEach(app => {
      console.log(`   - ${app.studentName} (${app.studentEmail}): ${app.motivation.substring(0, 50)}...`);
    });

    // 4. Club President views club activities
    console.log('\n4. Club President manages activities...');
    const activitiesResponse = await axios.get(`${API_BASE_URL}/activities/club/${club.id}`);
    const activities = activitiesResponse.data.data;
    console.log(`   Managing ${activities.length} activities`);
    activities.forEach(activity => {
      console.log(`   - ${activity.title} (${activity.status})`);
    });

    console.log('\n✅ Club President workflow completed successfully!\n');
    return true;

  } catch (error) {
    console.log(`❌ Club President workflow failed: ${error.message}\n`);
    return false;
  }
}

async function testSuperAdminWorkflow() {
  console.log('👨‍💻 Testing Super Admin Workflow...\n');

  try {
    // 1. Super Admin logs in
    console.log('1. Super Admin logs in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@tau.edu',
      password: 'superSecurePassword123'
    });
    console.log(`   Login successful for Super Admin`);

    // 2. Super Admin views all clubs
    console.log('\n2. Super Admin oversees all clubs...');
    const clubsResponse = await axios.get(`${API_BASE_URL}/clubs`);
    const clubs = clubsResponse.data.data;
    console.log(`   Overseeing ${clubs.length} clubs system-wide`);
    clubs.forEach(club => {
      console.log(`   - ${club.name} (${club.isActive ? 'Active' : 'Inactive'})`);
    });

    // 3. Super Admin views all activities
    console.log('\n3. Super Admin monitors all activities...');
    const activitiesResponse = await axios.get(`${API_BASE_URL}/activities`);
    const activities = activitiesResponse.data.data;
    console.log(`   Monitoring ${activities.length} activities across all clubs`);
    activities.forEach(activity => {
      console.log(`   - ${activity.title} by ${activity.club.name} (${activity.status})`);
    });

    // 4. Super Admin views all applications
    console.log('\n4. Super Admin reviews system-wide applications...');
    const applicationsResponse = await axios.get(`${API_BASE_URL}/applications`);
    const applications = applicationsResponse.data.data;
    console.log(`   Reviewing ${applications.length} applications system-wide`);
    
    const statusCounts = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} applications`);
    });

    console.log('\n✅ Super Admin workflow completed successfully!\n');
    return true;

  } catch (error) {
    console.log(`❌ Super Admin workflow failed: ${error.message}\n`);
    return false;
  }
}

async function testDynamicClubRouting() {
  console.log('🔗 Testing Dynamic Club URL Routing...\n');

  try {
    const clubs = ['computer-science-club', 'photography-club'];
    
    for (const clubSlug of clubs) {
      console.log(`Testing route: /kulup/${clubSlug}`);
      const response = await axios.get(`${API_BASE_URL}/clubs/slug/${clubSlug}`);
      const club = response.data.data;
      console.log(`   ✅ ${club.name} accessible at /kulup/${club.urlSlug}`);
    }

    // Test invalid club
    try {
      await axios.get(`${API_BASE_URL}/clubs/slug/non-existent-club`);
      console.log('   ❌ Should have returned 404 for non-existent club');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('   ✅ Correctly returns 404 for non-existent club');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Dynamic club routing working correctly!\n');
    return true;

  } catch (error) {
    console.log(`❌ Dynamic routing test failed: ${error.message}\n`);
    return false;
  }
}

async function runAllWorkflowTests() {
  console.log('🚀 Starting TAU Community Workflow Tests...\n');
  console.log('=' .repeat(60) + '\n');

  const tests = [
    { name: 'Student Workflow', test: testStudentWorkflow },
    { name: 'Club President Workflow', test: testClubPresidentWorkflow },
    { name: 'Super Admin Workflow', test: testSuperAdminWorkflow },
    { name: 'Dynamic Club Routing', test: testDynamicClubRouting }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log('=' .repeat(60));
    const result = await test.test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('=' .repeat(60));
  console.log('📊 Workflow Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All workflow tests passed! The TAU Community system supports all user roles and workflows correctly.');
  } else {
    console.log('\n⚠️  Some workflow tests failed. Please check the implementation.');
  }
}

// Run the workflow tests
runAllWorkflowTests().catch(console.error);