#!/bin/bash

echo "Restarting all services with fixes for script deletion and upload issues..."

# Restart backend
echo "Restarting backend server..."
./restart-backend.sh &

# Wait a moment for backend to start
sleep 5

# Restart frontend
echo "Restarting frontend server..."
./restart-frontend.sh &

echo "All services restarted. The application should now handle script deletion and uploads correctly."
echo "You can now test the fixes by trying to delete a script or upload a new one."
