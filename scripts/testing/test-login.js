/**
 * Test Login Functionality
 */

const axios = require('axios');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config();

const API_URL = process.env.BACKEND_URL || 'https://127.0.0.1:4000';
const credentials = {
  email: process.env.TEST_LOGIN_EMAIL || 'admin@example.com',
  password: process.env.TEST_LOGIN_PASSWORD || 'admin123'
};

const axiosOptions = API_URL.startsWith('https://')
  ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  : {};

async function testLogin() {
  try {
    console.log('Testing login with configured credentials...');
    console.log(`API URL: ${API_URL}`);
    console.log(`Email: ${credentials.email}`);

    const response = await axios.post(`${API_URL}/api/auth/login`, credentials, axiosOptions);

    if (response.data) {
      console.log('\nLogin successful!');
      console.log('User details:');
      if (response.data.user) {
        console.log(`- ID: ${response.data.user.id}`);
        console.log(`- Username: ${response.data.user.username}`);
        console.log(`- Email: ${response.data.user.email}`);
        console.log(`- Role: ${response.data.user.role}`);
        console.log(`- Last login: ${response.data.user.last_login_at || 'First login'}`);
      }

      console.log('\nAuthentication tokens:');
      if (response.data.token) {
        console.log(`- Access token: ${response.data.token.substring(0, 20)}...`);
      }
      if (response.data.refreshToken) {
        console.log(`- Refresh token: ${response.data.refreshToken.substring(0, 20)}...`);
      }

      return true;
    }

    console.error('Login failed with unexpected response format:', response.data);
    return false;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return false;
  }
}

async function testGetUserInfo(token) {
  try {
    console.log('\nTesting authenticated user info endpoint...');

    const response = await axios.get(`${API_URL}/api/auth/me`, {
      ...axiosOptions,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.data) {
      console.log('User info retrieved successfully!');
      console.log(`- Username: ${response.data.user?.username || 'Unknown'}`);
      console.log(`- Email: ${response.data.user?.email || 'Unknown'}`);
      console.log(`- Role: ${response.data.user?.role || 'Unknown'}`);
      return true;
    }

    console.error('Get user info failed with unexpected response format:', response.data);
    return false;
  } catch (error) {
    console.error('Get user info failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log('=== Login Functionality Tests ===\n');

  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('\nTests failed.');
    console.log('If local frontend auth bypass is enabled, disable it before using this script to validate real login.');
    process.exit(1);
  }

  const loginResponse = await axios.post(`${API_URL}/api/auth/login`, credentials, axiosOptions);
  const token = loginResponse.data.token;
  const userInfoSuccess = await testGetUserInfo(token);

  console.log('\n=== Test Summary ===');
  console.log(`- Login Test: ${loginSuccess ? 'PASSED' : 'FAILED'}`);
  console.log(`- Get User Info Test: ${userInfoSuccess ? 'PASSED' : 'FAILED'}`);
  console.log(`- API URL: ${API_URL}`);
  console.log(`- Email: ${credentials.email}`);
}

runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
