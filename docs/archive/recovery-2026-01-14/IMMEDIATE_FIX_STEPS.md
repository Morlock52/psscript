# IMMEDIATE FIX STEPS - PSScript Backend Recovery

**Status:** SSH Port 22 is blocked - Cannot access server remotely  
**Critical:** Backend API service not responding (Error 1033)  
**Action Required:** Access via hosting provider console

---

## Option 1: Access Via Hosting Provider Console (RECOMMENDED)

### Step 1: Log into your hosting provider's control panel

Your server: **74.208.184.195**

Common hosting providers and their console access:

- **DigitalOcean:** Droplets → Select your droplet → "Console" button (top right)
- **Linode:** Linodes → Select your instance → "Launch LISH Console"
- **Vultr:** Instances → Select instance → View Console (screen icon)
- **AWS EC2:** EC2 Dashboard → Instances → Select instance → "Connect" → "EC2 Instance Connect"
- **Hetzner:** Cloud Console → Servers → Select server → "Console" button
- **OVH:** Manager → Servers → Select server → "KVM/IPMI" or "Serial Console"

### Step 2: Once in the console, run these commands

```bash
# 1. Check if SSH service is running
systemctl status sshd

# If not running, start it:
systemctl start sshd
systemctl enable sshd

# 2. Check firewall status
ufw status

# If SSH is blocked, allow it:
ufw allow 22/tcp
ufw reload

# 3. Check if server is overloaded
top -bn1 | head -20
free -h
df -h

# 4. Navigate to project directory
cd /opt/psscript

# 5. Check Docker container status
docker ps -a

# 6. Check backend logs
docker logs backend --tail 50

# 7. Restart backend service
docker compose restart backend

# Wait 30 seconds
sleep 30

# 8. Verify backend health
curl http://localhost:4000/api/health

# 9. Check if backend is now responding
curl https://psscript.morloksmaze.com/api/health

# 10. If still not working, restart all services
docker compose restart

# 11. Monitor logs
docker compose logs -f backend
```

---

## Option 2: If You Have VNC/Console Access

Some providers offer VNC or web-based console access:

1. Access the console through your provider's dashboard
2. Login with: **root** / **xyyCbL6G**
3. Follow the same commands as Option 1, Step 2

---

## Option 3: Check Hosting Provider Firewall

Some hosting providers have network-level firewalls:

1. Log into your hosting provider dashboard
2. Look for "Firewall" or "Security Groups" or "Network" settings
3. Check if port 22 (SSH) is allowed
4. Add rule to allow TCP port 22 from your IP address
5. Try SSH connection again

---

## Expected Backend Health Response

When the backend is working correctly, you should see:

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-01-14T15:30:00.000Z"
}
```

---

## Common Backend Issues and Fixes

### Issue 1: Backend Container Not Running

```bash
# Check container status
docker ps -a | grep backend

# If status is "Exited", check logs for errors
docker logs backend --tail 100

# Restart it
docker compose up -d backend
```

### Issue 2: Backend Started But Crashing

```bash
# Watch logs in real-time
docker logs backend --follow

# Common errors:
# - "EADDRINUSE" → Port conflict, restart: docker compose restart backend
# - "ECONNREFUSED postgres" → Database not ready, restart both:
docker compose restart postgres backend
# - "Cannot find module" → Rebuild: docker compose build --no-cache backend
```

### Issue 3: Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs postgres --tail 50

# Restart database and backend
docker compose restart postgres
sleep 15
docker compose restart backend
```

### Issue 4: Out of Memory/Resources

```bash
# Check system resources
free -h
df -h
docker stats --no-stream

# If memory is full, restart Docker
systemctl restart docker
cd /opt/psscript
docker compose up -d
```

---

## After Fixing - Verification Checklist

- [ ] SSH connection works: `ssh root@74.208.184.195`
- [ ] All containers running: `docker ps` shows 8 containers "Up"
- [ ] Backend health OK: `curl http://localhost:4000/api/health` returns 200
- [ ] API via tunnel OK: `curl https://psscript.morloksmaze.com/api/health` returns 200
- [ ] Frontend loads: Visit https://psscript.morloksmaze.com in browser
- [ ] Authentication works: Complete Cloudflare Access login
- [ ] Application functional: Test core features

---

## If You Cannot Access Console

If you cannot access the hosting provider console:

1. **Contact hosting provider support** and ask them to:
   - Check if SSH service (sshd) is running
   - Enable port 22 in firewall rules
   - Check if server is experiencing high load
   - Reboot the server if necessary

2. **Provide them with:**
   - Server IP: 74.208.184.195
   - Issue: Cannot connect via SSH (port 22 timeout)
   - Request: Check firewall rules and SSH service status

---

## Alternative: Use Cloudflare Tunnel for SSH (Advanced)

If you want SSH access through the Cloudflare Tunnel:

1. Modify `/opt/psscript/cloudflared/config.yml` to add SSH access:
```yaml
tunnel: de34187a-1d92-4d21-a99f-504533e2acbd
credentials-file: /etc/cloudflared/de34187a-1d92-4d21-a99f-504533e2acbd.json

ingress:
  - hostname: ssh.morloksmaze.com
    service: ssh://localhost:22
  - hostname: psscript.morloksmaze.com
    path: /api/*
    service: http://backend:4000
  - hostname: psscript.morloksmaze.com
    service: http://frontend:3000
  - service: http_status:404
```

2. Add DNS record for ssh.morloksmaze.com pointing to tunnel
3. Install cloudflared on your local machine
4. Connect: `cloudflared access ssh --hostname ssh.morloksmaze.com`

*Note: This requires console access to modify the config initially*

---

## Quick Reference Commands

```bash
# One-liner to check and fix everything
cd /opt/psscript && docker compose ps && docker compose restart backend && sleep 30 && curl http://localhost:4000/api/health

# Emergency full restart
cd /opt/psscript && docker compose down && docker compose up -d && docker compose logs -f

# Check what's wrong
docker compose ps && docker logs backend --tail 20 && docker logs cloudflared --tail 20
```

---

**Created:** January 14, 2026  
**Priority:** CRITICAL - Blocks all other fixes  
**Estimated Time:** 10-15 minutes once console access is obtained
