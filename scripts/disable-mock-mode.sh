#!/bin/bash

echo "disable-mock-mode.sh is deprecated. Backend runtime mock-service mode has already been removed."
echo "Starting the normal backend development server instead..."

DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/start/start-backend.sh"
