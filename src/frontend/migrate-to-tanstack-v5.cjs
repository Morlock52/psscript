#!/usr/bin/env node

/**
 * TanStack Query v5 Migration Script
 *
 * This script automates the migration from react-query to @tanstack/react-query v5
 *
 * Key changes:
 * 1. Update imports from 'react-query' to '@tanstack/react-query'
 * 2. Replace isLoading with isPending
 * 3. Replace cacheTime with gcTime
 * 4. Convert useQuery to object syntax (manual review needed)
 * 5. Convert useMutation to object syntax (manual review needed)
 */

const fs = require('fs');
const path = require('path');

// Files to migrate
const filesToMigrate = [
  'src/pages/ScriptAnalysis.tsx',
  'src/pages/ScriptUpload.tsx',
  'src/pages/ScriptManagement.tsx',
  'src/pages/Search.tsx',
  'src/pages/ScriptDetail.tsx',
  'src/pages/Analytics.tsx',
  'src/pages/ManageFiles.tsx',
];

function migrateFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changes = [];

  // 1. Update imports
  if (content.includes("from 'react-query'")) {
    content = content.replace(/from 'react-query'/g, "from '@tanstack/react-query'");
    changes.push('Updated imports to @tanstack/react-query');
  }

  // 2. Replace isLoading with isPending (but keep isFetching)
  // Be careful with destructuring
  const isLoadingPattern = /isLoading:\s*(\w+)/g;
  if (content.match(isLoadingPattern)) {
    content = content.replace(isLoadingPattern, 'isPending: $1');
    changes.push('Replaced isLoading: with isPending:');
  }

  // Simple isLoading variable names
  if (content.match(/\bisLoading\b/g)) {
    // Only replace in specific contexts to avoid false positives
    content = content.replace(/const\s*{\s*([^}]*)\bisLoading\b([^}]*)\s*}\s*=/g, (match, before, after) => {
      return match.replace(/\bisLoading\b/, 'isPending');
    });
    content = content.replace(/\bisLoadingScripts\b/g, 'isPendingScripts');
    content = content.replace(/\bisLoadingCategories\b/g, 'isPendingCategories');
    content = content.replace(/\bisLoadingStats\b/g, 'isPendingStats');
    content = content.replace(/\bisLoadingActivity\b/g, 'isPendingActivity');
    content = content.replace(/\bisLoadingSecurityMetrics\b/g, 'isPendingSecurityMetrics');
    content = content.replace(/\bisLoadingTrendData\b/g, 'isPendingTrendData');
    changes.push('Replaced isLoading variables with isPending');
  }

  // 3. Replace cacheTime with gcTime
  if (content.includes('cacheTime:')) {
    content = content.replace(/cacheTime:/g, 'gcTime:');
    changes.push('Replaced cacheTime with gcTime');
  }

  if (changes.length > 0) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ ${filePath}`);
    changes.forEach(change => console.log(`   - ${change}`));
  } else {
    console.log(`⏭️  ${filePath} - No changes needed`);
  }
}

console.log('🚀 Starting TanStack Query v5 Migration\n');

filesToMigrate.forEach(file => {
  migrateFile(file);
  console.log('');
});

console.log('✨ Migration complete!');
console.log('\n⚠️  Manual review required for:');
console.log('   1. useQuery conversion to object syntax');
console.log('   2. useMutation conversion to object syntax');
console.log('   3. onSuccess/onError callback migration');
console.log('   4. Verify all isPending replacements are correct');
console.log('\nSee TANSTACK-QUERY-V5-MIGRATION.md for details\n');
