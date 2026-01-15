#!/bin/bash
# PSScript Server Recovery - Console Commands
# Execute these commands when you access your hosting provider console
# Server: 74.208.184.195 (ip74-208-184-195.pbiaas.com)
# Application: https://psscript.morloksmaze.com

echo "========================================================================"
echo "PSScript Server Recovery Script"
echo "========================================================================"
echo ""

# Step 1: Fix SSH Access
echo "Step 1: Restoring SSH Access..."
systemctl status sshd
systemctl start sshd
systemctl enable sshd
ufw allow 22/tcp
ufw reload
echo "✓ SSH service started and firewall configured"
echo ""

# Step 2: Verify Docker is Running
echo "Step 2: Checking Docker Status..."
systemctl status docker
docker ps -a
echo ""

# Step 3: Navigate to Project Directory
echo "Step 3: Navigating to Project Directory..."
cd /opt/psscript
pwd
echo ""

# Step 4: Restart Backend Service
echo "Step 4: Restarting Backend Service..."
docker compose restart backend
sleep 5
docker compose ps
echo ""

# Step 5: Check Backend Health
echo "Step 5: Testing Backend Health..."
curl -v http://localhost:4000/api/health
echo ""

# Step 6: Check All Service Logs
echo "Step 6: Checking Service Logs (last 20 lines)..."
echo "--- Backend Logs ---"
docker compose logs --tail=20 backend
echo ""
echo "--- PostgreSQL Logs ---"
docker compose logs --tail=20 postgres
echo ""
echo "--- Redis Logs ---"
docker compose logs --tail=20 redis
echo ""
echo "--- Cloudflared Logs ---"
docker compose logs --tail=20 cloudflared
echo ""

# Step 7: Test External Access
echo "Step 7: Testing External HTTPS Access..."
curl -I https://psscript.morloksmaze.com/api/health
echo ""

# Step 8: Final Status
echo "========================================================================"
echo "Recovery Complete - Final Status:"
echo "========================================================================"
echo "SSH Port 22: $(ss -tlnp | grep :22 && echo 'OPEN' || echo 'CLOSED')"
echo "Docker Running: $(systemctl is-active docker)"
echo "Backend Container: $(docker ps --filter name=backend --format '{{.Status}}')"
echo "PostgreSQL Container: $(docker ps --filter name=postgres --format '{{.Status}}')"
echo "Redis Container: $(docker ps --filter name=redis --format '{{.Status}}')"
echo ""
echo "Next Steps:"
echo "1. If SSH is open, try connecting from your local machine:"
echo "   ssh root@74.208.184.195"
echo ""
echo "2. If backend is healthy, test the application:"
echo "   https://psscript.morloksmaze.com"
echo ""
echo "3. If issues persist, check full logs:"
echo "   docker compose logs -f backend"
echo "========================================================================"
