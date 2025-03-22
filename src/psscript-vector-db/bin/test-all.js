#!/usr/bin/env node

/**
 * test-all.js
 * 
 * This script runs all tests for the psscript-vector-db module.
 * 
 * Usage:
 *   node test-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Get the directory of this script
const scriptDir = path.dirname(__filename);

console.log('=== Running All Tests for psscript-vector-db ===');

// Array of tests to run
const tests = [
  {
    name: 'Database Connection Test',
    command: 'node test-db.js',
    description: 'Tests the connection to the PostgreSQL database and pgvector extension'
  },
  {
    name: 'OpenAI API Test',
    command: 'node test-openai.js',
    description: 'Tests the connection to the OpenAI API for embeddings'
  },
  {
    name: 'crawl4ai Integration Test',
    command: './test-crawl4ai.sh',
    description: 'Tests the integration with crawl4ai for crawling PowerShell documentation'
  }
];

// Run each test
let passedTests = 0;
let failedTests = 0;

for (const test of tests) {
  console.log(`\n=== Running Test: ${test.name} ===`);
  console.log(`Description: ${test.description}`);
  console.log('-------------------------------------------');
  
  try {
    execSync(`cd ${scriptDir} && ${test.command}`, { stdio: 'inherit' });
    console.log(`\n✅ ${test.name} PASSED`);
    passedTests++;
  } catch (error) {
    console.error(`\n❌ ${test.name} FAILED`);
    console.error(`Error: ${error.message}`);
    failedTests++;
  }
}

// Print summary
console.log('\n=== Test Summary ===');
console.log(`Total Tests: ${tests.length}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

// Exit with appropriate code
if (failedTests > 0) {
  console.error('\n❌ Some tests failed. Please check the output above for details.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
