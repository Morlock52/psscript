# 🚨 SERVER RECOVERY & DEPLOYMENT COMPLETION PLAN

## ✅ CURRENT STATUS

### WHAT'S WORKING:
- ✅ **Cloudflare Tunnel**: ACTIVE (HTTP/2 302 response)
- ✅ **SSL Certificate**: VALID (Google Trust Services, verify code: 0)
- ✅ **Application**: Accessible at https://psscript.morloksmaze.com
- ✅ **DNS**: Resolving correctly (172.67.143.172, 104.21.27.235)
- ✅ **Docker Containers**: Running (confirmed by active tunnel)

### WHAT'S NOT WORKING:
- ❌ **SSH Port 22**: Closed/Filtered - Cannot access server remotely
- ⚠️ **Direct Port Access**: Blocked (likely firewall)

---

## 📋 STEP-BY-STEP RECOVERY PLAN

### PHASE 1: RESTORE SSH ACCESS (REQUIRED FIRST)

#### Step 1.1: Access Hosting Provider Console
**Where**: Your hosting provider dashboard (DigitalOcean/AWS/Vultr/Linode/etc.)

**Actions**:
1. Log into your hosting provider account
2. Navigate to your server: 74.208.184.195
3. Look for "Console Access" or "VNC Access" or "Web Console"
4. Click to open web-based terminal

#### Step 1.2: Check SSH Service Status
**In the console, run**:
```bash
systemctl status sshd
```

**If SSH is down**:
```bash
systemctl start sshd
systemctl enable sshd
```

#### Step 1.3: Check Firewall Rules
```bash
# Check if firewall is blocking SSH
ufw status
iptables -L -n | grep 22

# If firewall is active and blocking:
ufw allow 22/tcp
ufw reload

# OR for iptables:
iptables -I INPUT -p tcp --dport 22 -j ACCEPT
iptables-save
```

#### Step 1.4: Verify Server isn't Overloaded
```bash
# Check system load
uptime
top -bn1 | head -20

# Check Docker processes
docker ps

# If system is overloaded, identify and stop problem containers:
docker stats --no-stream
```

#### Step 1.5: Test SSH from Console
```bash
# From the console, test localhost SSH:
ssh localhost

# If that works, the problem is firewall
# If that fails, SSH daemon needs fixing
```

---

### PHASE 2: VERIFY ALL SERVICES (Once SSH Works)

#### Step 2.1: Connect via SSH
```bash
ssh root@74.208.184.195
# Password: xyyCbL6G
```

#### Step 2.2: Navigate to Application
```bash
cd /opt/psscript
```

#### Step 2.3: Check All Container Status
```bash
docker compose ps
```

**Expected output**: 8 containers (frontend, backend, postgres, redis, ai-service, cloudflared, pgadmin, redis-commander)

#### Step 2.4: Check Container Health
```bash
# Backend health
curl http://localhost:4000/api/health

# Frontend status
curl -I http://localhost:3000

# Database
docker compose exec postgres pg_isready -U postgres

# Redis
docker compose exec redis redis-cli ping
```

#### Step 2.5: Check Cloudflared Tunnel
```bash
docker compose logs cloudflared --tail=20
```

**Look for**: "Registered tunnel connection" messages (should see 4)

---

### PHASE 3: FIX ANY ISSUES

#### Step 3.1: If Frontend Not Running
```bash
# Check frontend logs
docker compose logs frontend --tail=50

# If stuck building, restart with clean build
docker compose stop frontend
docker compose build --no-cache frontend
docker compose up -d frontend

# Wait 2 minutes, then check
sleep 120
curl -I http://localhost:3000
```

#### Step 3.2: If Backend Issues
```bash
# Check backend logs
docker compose logs backend --tail=50

# Restart backend
docker compose restart backend

# Wait and test
sleep 15
curl http://localhost:4000/api/health
```

#### Step 3.3: If Tunnel Issues
```bash
# Restart cloudflared
docker compose restart cloudflared

# Wait for reconnection
sleep 20

# Check connections
docker compose logs cloudflared | grep "Registered tunnel connection"
```

#### Step 3.4: Restart All Services (if needed)
```bash
# Nuclear option - restart everything
docker compose down
docker compose up -d

# Wait for all services to start
sleep 60

# Check status
docker compose ps
```

---

### PHASE 4: COMPREHENSIVE TESTING

#### Step 4.1: Test Backend API
```bash
# Health check
curl -v http://localhost:4000/api/health

# Should return JSON with "status":"ok", "database":"connected", "redis":"connected"
```

#### Step 4.2: Test Frontend
```bash
# Check if frontend is serving
curl -I http://localhost:3000

# Should return HTTP 200 or see Vite dev server
```

#### Step 4.3: Test Database Connection
```bash
docker compose exec postgres psql -U postgres -d psscript -c "SELECT version();"
```

#### Step 4.4: Test Redis
```bash
docker compose exec redis redis-cli INFO | grep uptime
```

#### Step 4.5: Test Cloudflare Tunnel
```bash
# From your local machine (not server):
curl -I https://psscript.morloksmaze.com

# Should return HTTP/2 302 (Cloudflare Access) or HTTP/2 200
```

#### Step 4.6: Verify SSL Certificate
```bash
# From your local machine:
echo | openssl s_client -servername psscript.morloksmaze.com -connect psscript.morloksmaze.com:443 2>/dev/null | openssl x509 -noout -text | grep -E "Issuer:|Subject:|Not After"
```

---

### PHASE 5: FINAL VERIFICATION

#### Step 5.1: Run Comprehensive Status Check
```bash
cd /opt/psscript

echo "=== All Services ==="
docker compose ps

echo ""
echo "=== Backend Health ==="
curl -s http://localhost:4000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:4000/api/health

echo ""
echo "=== Frontend Status ==="
curl -I http://localhost:3000 | head -5

echo ""
echo "=== Database Status ==="
docker compose exec postgres pg_isready

echo ""
echo "=== Redis Status ==="
docker compose exec redis redis-cli ping

echo ""
echo "=== Tunnel Connections ==="
docker compose logs cloudflared | grep "Registered tunnel connection" | tail -4

echo ""
echo "=== System Resources ==="
free -h
df -h /

echo ""
echo "=== External Access Test ==="
curl -I https://psscript.morloksmaze.com | head -5
```

#### Step 5.2: Access Application
**Visit**: https://psscript.morloksmaze.com

**Expected**:
1. Cloudflare Access login page
2. After authentication, psscript application

#### Step 5.3: Verify SSL
**In browser**:
1. Visit https://psscript.morloksmaze.com
2. Click padlock icon in address bar
3. Verify certificate is valid
4. Check certificate details (Google Trust Services)

---

## 🎯 QUICK REFERENCE COMMANDS

### Emergency Service Restart
```bash
cd /opt/psscript && docker compose restart
```

### Check Logs
```bash
cd /opt/psscript
docker compose logs -f [service-name]
# Services: frontend, backend, postgres, redis, cloudflared, ai-service
```

### Rebuild Frontend
```bash
cd /opt/psscript
docker compose stop frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Fix Tunnel
```bash
cd /opt/psscript
docker compose restart cloudflared
sleep 20
docker compose logs cloudflared --tail=20
```

---

## ✅ SUCCESS CRITERIA

### All These Must Be TRUE:
- [ ] SSH accessible on port 22
- [ ] All 8 Docker containers running
- [ ] Backend returns healthy status
- [ ] Frontend serves content
- [ ] Database accepting connections
- [ ] Redis responding to PING
- [ ] Cloudflared shows 4 registered connections
- [ ] https://psscript.morloksmaze.com accessible
- [ ] SSL certificate valid (verify code: 0)
- [ ] Can authenticate through Cloudflare Access
- [ ] Application loads after authentication

---

## 📞 SUPPORT INFORMATION

**Server**: 74.208.184.195
**Application**: /opt/psscript/
**Tunnel URL**: https://psscript.morloksmaze.com
**Tunnel ID**: de34187a-1d92-4d21-a99f-504533e2acbd
**Account**: 6c9501c689c2e137190d50fba627b7ff

**Current Known Status**:
- Tunnel: ✅ Working
- SSL: ✅ Valid
- SSH: ❌ Blocked (needs firewall fix)
- Containers: ✅ Running (confirmed by tunnel activity)
