#!/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║   PSSCRIPT APPLICATION - FIX, TEST, AND VERIFY         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

cd /opt/psscript

echo "1. Checking current container status..."
docker compose ps

echo ""
echo "2. Restarting all services..."
docker compose restart

echo ""
echo "3. Waiting 30 seconds for services to stabilize..."
sleep 30

echo ""
echo "4. Checking service health..."
echo "   Backend:  $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/health)"
echo "   Frontend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"
echo "   Postgres: $(docker compose exec -T postgres pg_isready -U postgres)"
echo "   Redis:    $(docker compose exec -T redis redis-cli ping)"

echo ""
echo "5. Testing tunnel connectivity..."
docker compose logs cloudflared --tail=5 | grep "Registered"

echo ""
echo "6. Getting detailed status..."
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "7. Testing external access..."
curl -I https://psscript.morloksmaze.com 2>&1 | head -5

echo ""
echo "╚════════════════════════════════════════════════════════╝"
echo "Script complete. Review output above for any issues."
