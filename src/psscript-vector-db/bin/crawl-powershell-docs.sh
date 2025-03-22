#!/bin/bash

# crawl-powershell-docs.sh
# This script makes the crawl4ai-integration.js file executable and runs it with the provided arguments.

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Make the crawl4ai-integration.js file executable
chmod +x "$SCRIPT_DIR/crawl4ai-integration.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if an URL is provided
if [ -z "$1" ]; then
    echo "Error: URL is required"
    echo "Usage: $0 <url> [options]"
    echo ""
    echo "Options:"
    echo "  --depth=<number>     Crawl depth (default: 2)"
    echo "  --max-pages=<number> Maximum pages to crawl (default: 10)"
    echo "  --external           Include external links (default: false)"
    echo "  --file-types=<types> Comma-separated list of file types to extract (default: ps1,psm1,psd1)"
    exit 1
fi

# Run the crawl4ai-integration.js script with all arguments
echo "Starting PowerShell documentation crawl..."
node "$SCRIPT_DIR/crawl4ai-integration.js" "$@"

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo "PowerShell documentation crawl completed successfully!"
else
    echo "Error: PowerShell documentation crawl failed."
    exit 1
fi
