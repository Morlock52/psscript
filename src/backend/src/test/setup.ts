/**
 * Jest Test Setup
 * Runs before all tests to configure the test environment
 */
import { jest, afterEach, afterAll } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Add any global cleanup here
});
