#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CLI files to make executable
const cliFiles = [
  'src/cli/index.js',
  'src/cli/crawl.js',
  'src/cli/search.js',
  'src/cli/chat.js',
  'src/server.js'
];

// Add shebang line to CLI files if not already present
cliFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.startsWith('#!/usr/bin/env node')) {
      content = '#!/usr/bin/env node\n' + content;
      fs.writeFileSync(filePath, content);
      console.log(`Added shebang to ${file}`);
    }
    
    // Make file executable
    try {
      execSync(`chmod +x ${filePath}`);
      console.log(`Made ${file} executable`);
    } catch (error) {
      console.error(`Error making ${file} executable:`, error.message);
    }
  } else {
    console.warn(`File not found: ${file}`);
  }
});

console.log('CLI setup complete!');
