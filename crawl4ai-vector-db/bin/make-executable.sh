#!/bin/bash

# Make all CLI tools executable
chmod +x src/cli/index.js
chmod +x src/cli/crawl.js
chmod +x src/cli/search.js
chmod +x src/cli/chat.js
chmod +x src/server.js
chmod +x bin/setup.js
chmod +x bin/init-db.js
chmod +x bin/test-db.js
chmod +x bin/test-openai.js
chmod +x bin/test-crawl4ai.js
chmod +x bin/test-all.js
chmod +x bin/setup-cli.js

echo "All CLI tools are now executable!"
