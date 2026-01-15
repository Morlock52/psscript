# API Service Fix Guide - Error 1033 Resolution

**Issue:** Backend API service not responding through Cloudflare Tunnel  
**Error:** Cloudflare Error 1033 - Argo Tunnel cannot reach origin  
**Impact:** All API endpoints (/api/*) are non-functional  
**Status:** Requires SSH access to diagnose and fix

---

## Understanding Error 1033

Error 1033 specifically means that the Cloudflare Tunnel (cloudflared container) cannot establish a connection to the backend service. This is different from:
- **Error 522:** Connection timed out (origin server not responding)
- **Error 530:** Origin DNS error
- **Error 502:** Bad gateway (origin returned invalid response)

Error 1033 indicates the tunnel daemon is running but cannot reach the backend service internally.

---

## Diagnostic Steps (Requires SSH Access)

### Step 1: Check Docker Container Status

```bash
cd /opt/psscript
docker ps -a
```

**What to look for:**
- Is the `backend` container running? (Status should be "Up")
- Is the `cloudflared` container running?
- Are there any containers in "Restarting" or "Exited" state?
- Check the "Created" time - did backend restart recently?

**Expected output:**
```
CONTAINER ID   IMAGE                    STATUS        PORTS                    NAMES
abc123...      psscript-backend         Up 2 hours    0.0.0.0:4000->4000/tcp   backend
def456...      cloudflare/cloudflared   Up 2 hours                             cloudflared
...
```

### Step 2: Check Backend Logs

```bash
# View last 100 lines of backend logs
docker logs backend --tail 100

# Follow logs in real-time
docker logs backend --follow
```

**Common error patterns to look for:**

1. **Port binding error:**
   ```
   Error: listen EADDRINUSE: address already in use :::4000
   ```
   Fix: Another service is using port 4000. Stop conflicting service or change port.

2. **Database connection error:**
   ```
   Error: connect ECONNREFUSED postgres:5432
   Connection pool exhausted
   ```
   Fix: Check PostgreSQL container status, verify environment variables.

3. **Missing environment variables:**
   ```
   Error: DATABASE_URL is not defined
   ```
   Fix: Check .env file and docker-compose.yml environment section.

4. **Node.js crash:**
   ```
   TypeError: Cannot read property 'X' of undefined
   FATAL ERROR: ... Out of memory
   ```
   Fix: Fix application code or increase container memory limits.

5. **Module not found:**
   ```
   Error: Cannot find module 'express'
   ```
   Fix: Rebuild container with proper npm install.

### Step 3: Check Cloudflared Logs

```bash
# View cloudflared logs
docker logs cloudflared --tail 50

# Look for connection registration
docker logs cloudflared | grep "Registered"
```

**What to look for:**

✅ **Good - Tunnel working:**
```
Registered tunnel connection
Connection registered connIndex=0
Connection registered connIndex=1
Connection registered connIndex=2
Connection registered connIndex=3
```

❌ **Bad - Connection issues:**
```
Failed to connect to origin: dial tcp 172.18.0.3:4000: connect: connection refused
ERR failed to accept incoming stream requests error="timeout: no recent network activity"
Unable to reach the origin service
```

### Step 4: Test Backend Health Directly

```bash
# Test from within backend container
docker exec backend curl -v http://localhost:4000/api/health

# Test from another container via Docker network
docker exec cloudflared curl -v http://backend:4000/api/health
```

**Expected response:**
```json
{"status":"healthy","database":"connected","redis":"connected","timestamp":"2026-01-14T15:00:00.000Z"}
```

**If this fails:** Backend is not listening on port 4000 or crashed.

### Step 5: Check Docker Network

```bash
# Inspect the Docker network
docker network inspect psscript_default

# Look for backend and cloudflared in the "Containers" section
```

**What to verify:**
- Both `backend` and `cloudflared` containers are in the same network
- Backend has an IP address assigned
- No network conflicts or duplicate IPs

### Step 6: Check Container Resources

```bash
# Check container resource usage
docker stats --no-stream

# Check server resources
top -bn1 | head -20
df -h
free -h
```

**Red flags:**
- CPU usage at 100% for extended period
- Memory usage at max (OOM killer may have killed backend)
- Disk usage at 100%
- High I/O wait times

---

## Fix Procedures

### Fix 1: Restart Backend Service

```bash
cd /opt/psscript

# Restart just the backend
docker compose restart backend

# Wait 30 seconds
sleep 30

# Check if it started
docker logs backend --tail 20
curl -v http://localhost:4000/api/health
```

### Fix 2: Rebuild Backend Container

If configuration or dependencies changed:

```bash
cd /opt/psscript

# Stop backend
docker compose stop backend

# Rebuild with no cache
docker compose build --no-cache backend

# Start backend
docker compose up -d backend

# Monitor startup
docker logs backend --follow
```

### Fix 3: Restart All Services

If multiple services are affected:

```bash
cd /opt/psscript

# Restart all containers
docker compose restart

# Wait for startup
sleep 60

# Check all containers
docker compose ps

# Test backend
curl -v http://localhost:4000/api/health

# Test via tunnel
curl -v https://psscript.morloksmaze.com/api/health
```

### Fix 4: Full Redeployment

If restart doesn't work:

```bash
cd /opt/psscript

# Stop all containers
docker compose down

# Optional: Remove volumes if database reset is needed
# docker compose down -v

# Pull latest images
docker compose pull

# Rebuild custom images
docker compose build --no-cache

# Start everything
docker compose up -d

# Monitor all logs
docker compose logs -f
```

### Fix 5: Fix Port Conflicts

If port 4000 is in use:

```bash
# Check what's using port 4000
sudo lsof -i :4000
sudo netstat -tulpn | grep 4000

# Kill the conflicting process (if not needed)
sudo kill <PID>

# Or change backend port in docker-compose.yml
# Then restart: docker compose up -d backend
```

### Fix 6: Fix Database Connection

If backend can't connect to PostgreSQL:

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs postgres --tail 50

# Restart PostgreSQL
docker compose restart postgres

# Wait and restart backend
sleep 15
docker compose restart backend

# Test database connection
docker exec backend npm run db:test
```

### Fix 7: Fix Environment Variables

If environment variables are missing:

```bash
cd /opt/psscript

# Check .env file exists
ls -la .env

# Verify it has required variables
cat .env | grep -E 'DATABASE_URL|REDIS_URL|API_KEY'

# If missing, create/update .env file
nano .env

# Restart backend to pick up changes
docker compose restart backend
```

---

## Verification Steps

After applying any fix, verify the solution:

### 1. Check Container Status
```bash
docker ps
# Backend should show "Up" status
```

### 2. Check Backend Health
```bash
curl -v http://localhost:4000/api/health
# Should return 200 OK with JSON response
```

### 3. Check Cloudflared Logs
```bash
docker logs cloudflared --tail 20 | grep -E "Registered|Error"
# Should show "Registered" connections, no errors
```

### 4. Test via Tunnel
```bash
curl -v https://psscript.morloksmaze.com/api/health
# Should return 200 OK, NOT Error 1033
```

### 5. Test Full Application
- Visit https://psscript.morloksmaze.com in browser
- Complete authentication
- Verify application loads and functions
- Check browser console for API errors

---

## Preventive Measures

### Add Health Checks to docker-compose.yml

```yaml
services:
  backend:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
```

### Add Logging Configuration

```yaml
services:
  backend:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitor Container Status

Create a monitoring script `/opt/psscript/monitor.sh`:

```bash
#!/bin/bash
# Check if backend is healthy
if ! docker exec backend curl -sf http://localhost:4000/api/health > /dev/null; then
    echo "Backend unhealthy, restarting..."
    docker compose restart backend
    
    # Send alert (configure email/webhook)
    # mail -s "Backend restarted" admin@example.com
fi
```

Add to crontab to run every 5 minutes:
```bash
crontab -e
# Add: */5 * * * * /opt/psscript/monitor.sh >> /var/log/psscript-monitor.log 2>&1
```

---

## Emergency Contacts & Resources

### Hosting Provider Console Access
- Provider: [Your Hosting Provider]
- Console URL: [URL]
- Login: [Credentials location]

### Key Files Location
- Docker Compose: `/opt/psscript/docker-compose.yml`
- Environment: `/opt/psscript/.env`
- Cloudflared Config: `/opt/psscript/cloudflared/config.yml`
- Backend Source: `/opt/psscript/src/backend/`

### Useful Commands Cheat Sheet
```bash
# Quick status check
docker compose ps && docker compose logs --tail 10

# Restart everything
docker compose restart && sleep 60 && curl localhost:4000/api/health

# View all logs
docker compose logs -f

# Check resource usage
docker stats

# Force rebuild
docker compose down && docker compose build --no-cache && docker compose up -d
```

---

## Escalation Path

If fixes don't work:

1. **Check server status via hosting provider console**
   - Verify server is not overloaded
   - Check for disk space issues
   - Review system logs

2. **Consider fresh deployment**
   - Document current state
   - Backup database: `docker exec postgres pg_dump -U postgres > backup.sql`
   - Stop and remove: `docker compose down -v`
   - Redeploy from scratch

3. **Contact support**
   - Provide logs from: backend, cloudflared, postgres
   - Include docker-compose.yml and config files
   - Share error messages and what fixes were attempted

---

**Created:** January 14, 2026  
**Last Updated:** January 14, 2026  
**Version:** 1.0
