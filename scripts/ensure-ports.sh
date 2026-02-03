#!/bin/bash
# Ensure standard ports are available and used correctly
# Frontend: 3090, Backend: 4000

FRONTEND_PORT=3090
BACKEND_PORT=4000

kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

check_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti :$port 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        local cmd=$(ps -p $pid -o comm= 2>/dev/null)
        echo "✓ Port $port ($name): $cmd (PID $pid)"
    else
        echo "✗ Port $port ($name): Not in use"
    fi
}

case "$1" in
    kill-frontend)
        echo "Killing any process on port $FRONTEND_PORT..."
        kill_port $FRONTEND_PORT
        echo "Port $FRONTEND_PORT is now free"
        ;;
    kill-backend)
        echo "Killing any process on port $BACKEND_PORT..."
        kill_port $BACKEND_PORT
        echo "Port $BACKEND_PORT is now free"
        ;;
    kill-all)
        echo "Killing processes on both ports..."
        kill_port $FRONTEND_PORT
        kill_port $BACKEND_PORT
        echo "Ports $FRONTEND_PORT and $BACKEND_PORT are now free"
        ;;
    status|*)
        echo "=== Port Status ==="
        check_port $FRONTEND_PORT "Frontend"
        check_port $BACKEND_PORT "Backend"
        ;;
esac
