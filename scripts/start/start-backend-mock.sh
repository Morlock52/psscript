#!/bin/bash

echo "start-backend-mock.sh is deprecated. Backend runtime mock-service mode has been removed."
echo "Starting the normal backend development server instead..."

DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/start-backend.sh"
