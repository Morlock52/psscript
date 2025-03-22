#!/usr/bin/env node
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

// Define test scripts
const tests = [
  { name: 'Database Connection', script: 'test-db.js' },
  { name: 'OpenAI API', script: 'test-openai.js' },
  { name: 'Crawl4AI Library', script: 'test-crawl4ai.js' },
  { name: 'Deep Crawling Features', script: 'test-deep-crawl.js', optional: true }
];

// Run all tests
async function runAllTests() {
  console.log(chalk.blue('Running all tests...\n'));

  let allPassed = true;
  let optionalFailed = false;

  for (const test of tests) {
    console.log(chalk.yellow(`\n=== Testing ${test.name} ${test.optional ? '(Optional)' : ''} ===\n`));

    try {
      execSync(`node ${path.join(__dirname, test.script)}`, { stdio: 'inherit' });
      console.log(chalk.green(`\n✅ ${test.name} test passed!\n`));
    } catch (error) {
      console.error(chalk.red(`\n❌ ${test.name} test failed!\n`));
      if (test.optional) {
        optionalFailed = true;
        console.log(chalk.yellow(`Note: ${test.name} is an optional test and won't affect the overall result.`));
      } else {
        allPassed = false;
      }
    }
  }

  console.log(chalk.blue('\n=== Test Summary ===\n'));

  if (allPassed) {
    console.log(chalk.green('✅ All required tests passed! The system is ready to use.'));
    if (optionalFailed) {
      console.log(chalk.yellow('⚠️ Some optional tests failed. This won\'t prevent the system from working, but some features might not be available.'));
    }
  } else {
    console.log(chalk.red('❌ Some required tests failed. Please check the output above for details.'));
    process.exit(1);
  }
}

// Run the tests
runAllTests();
