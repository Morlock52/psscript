# PSScript Test Results

This directory contains test results, logs, and diagnostic information for troubleshooting the PSScript application.

## Directory Structure

- `/logs` - General application logs
  - `combined.log` - All application logs
  - `error.log` - Error-level logs only
  - `debug.log` - Debug-level logs for detailed analysis

- `/db-tests` - Database connectivity test results
  - `redis-test.log` - Redis connectivity test logs
  - `postgres-test.log` - PostgreSQL connectivity test logs

## Running Tests

### Redis Connectivity Test

```bash
cd src/backend
node test-redis.js
```

### Database Connectivity Test

```bash
cd src/backend
node test-db.js
```

## Log Rotation

The logs in this directory are not automatically rotated. For long-term deployments, consider implementing a log rotation solution or periodically cleaning up old logs.

## Analyzing Logs

When troubleshooting connectivity issues:

1. Check the appropriate test log file first for connection errors
2. Look for error patterns or specific error codes
3. Verify network configuration and firewall settings
4. Ensure the database services are running correctly

Common Redis connection issues:
- Connection refused (port not open or service not running)
- Authentication failures
- Timeout issues

Common PostgreSQL connection issues:
- Connection refused
- Authentication failures
- Database does not exist
- Role/user does not exist