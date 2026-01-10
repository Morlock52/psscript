# PSScript E2E Testing with Playwright

Comprehensive end-to-end tests for the PSScript platform following 2026 best practices.

## Test Structure

```
tests/
├── e2e/                          # End-to-end test suites
│   ├── health-checks.spec.ts    # Service health and availability
│   ├── authentication.spec.ts   # User auth flows
│   ├── script-management.spec.ts # Script upload and analysis
│   ├── ai-analytics.spec.ts     # AI analytics endpoints
│   └── ai-agents.spec.ts        # LangGraph agent system
└── fixtures/                     # Test data and files
```

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test Suite
```bash
npx playwright test tests/e2e/health-checks.spec.ts
npx playwright test tests/e2e/authentication.spec.ts
npx playwright test tests/e2e/script-management.spec.ts
npx playwright test tests/e2e/ai-analytics.spec.ts
npx playwright test tests/e2e/ai-agents.spec.ts
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Run Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug Tests
```bash
npx playwright test --debug
```

## Test Coverage

### 1. Health Checks (`health-checks.spec.ts`)
- Frontend accessibility
- Backend health endpoint
- AI service health endpoint
- Database connectivity
- Redis connectivity
- API endpoint availability

### 2. Authentication (`authentication.spec.ts`)
- Login page display
- Invalid login validation
- Registration flow
- Session persistence
- Protected route access
- Public route access

### 3. Script Management (`script-management.spec.ts`)
- Script upload button display
- File selection and upload
- File type validation
- AI analysis triggering
- Security issue detection
- Script list view
- Search functionality

### 4. AI Analytics (`ai-analytics.spec.ts`)
- Summary endpoint
- Budget alerts endpoint
- Full analytics endpoint
- Token usage tracking
- Analytics dashboard display
- Cost metrics display
- Token usage metrics
- Performance metrics
- Budget alert system
- Configurable thresholds

### 5. AI Agents (`ai-agents.spec.ts`)
- Agent coordinator availability
- Agent listing
- Archived agent verification
- LangGraph workflow execution
- State management and checkpointing
- Multi-step workflows
- Agent performance testing
- Parallel execution
- Memory and context persistence
- Error handling

## Best Practices Implemented

### Semantic Selectors (2026 Standards)
Tests use semantic selectors for better maintainability:
- `getByRole()` - Preferred for interactive elements
- `getByLabel()` - For form inputs
- `getByPlaceholder()` - For inputs without labels
- `getByText()` - For content-based selection

Example:
```typescript
const loginButton = page.getByRole('button', { name: /login|sign in/i });
const emailInput = page.getByLabel(/email|username/i);
```

### Test Isolation
- Fresh browser context for each test
- Cookie/session clearing before each test
- Independent test execution (no shared state)

### Error Handling
- Graceful handling of auth requirements
- Flexible status code expectations
- Timeout configurations
- Screenshot and video on failure

### Performance Monitoring
- Response time tracking
- Latency measurements
- Parallel execution testing

## Configuration

The `playwright.config.ts` at the project root configures:

- **Test Directory**: `./tests/e2e`
- **Parallel Execution**: Enabled
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile Testing**: Pixel 5, iPhone 12
- **Services**:
  - Frontend: http://localhost:3000
  - Backend: http://localhost:4000
  - AI Service: http://localhost:8000

## Environment Variables

Set these for authenticated tests:

```bash
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="testpassword123"
```

## CI/CD Integration

Tests are configured for CI environments:
- Retry failed tests twice on CI
- Single worker on CI (sequential execution)
- JSON and HTML reports generated
- Screenshots and videos on failure

## Viewing Test Reports

After running tests:

```bash
npx playwright show-report test-results/playwright-report
```

## Debugging Failed Tests

1. **Run with trace viewer**:
   ```bash
   npx playwright test --trace on
   npx playwright show-trace trace.zip
   ```

2. **Use debug mode**:
   ```bash
   npx playwright test --debug
   ```

3. **Check screenshots**:
   Screenshots saved to `test-results/` on failure

4. **Check videos**:
   Videos saved to `test-results/` on failure

## Adding New Tests

Follow the 2026 best practices:

1. Use semantic selectors
2. Implement proper test isolation
3. Handle authentication gracefully
4. Add appropriate timeouts
5. Document test purpose
6. Group related tests in `describe` blocks

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ context }) => {
    // Setup: clear cookies, etc.
    await context.clearCookies();
  });

  test('Should do something', async ({ page }) => {
    await page.goto('/');

    const element = page.getByRole('button', { name: /action/i });
    await expect(element).toBeVisible();
  });
});
```

## Maintenance

- Update selectors when UI changes
- Keep test data in `fixtures/` directory
- Review failed tests before marking as flaky
- Update timeouts based on service performance
- Keep tests fast (< 30s per test ideal)

## Known Issues

- Some tests require authentication (use TEST_USER_* env vars)
- AI analysis tests may take longer due to API calls
- Service startup may require additional time on first run

## Support

For issues or questions:
1. Check Playwright documentation: https://playwright.dev
2. Review test output and screenshots
3. Enable debug mode for detailed execution
