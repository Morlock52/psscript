import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.resolve(root, 'src/frontend/dist');
const indexPath = path.join(distDir, 'index.html');

function budgetKb(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function sizeKb(file) {
  return fs.statSync(file).size / 1024;
}

if (!fs.existsSync(indexPath)) {
  console.error(`Missing frontend build output: ${indexPath}`);
  process.exit(1);
}

const maxTotalKb = budgetKb('FRONTEND_BUNDLE_MAX_TOTAL_KB', 10_240);
const maxInitialJsKb = budgetKb('FRONTEND_BUNDLE_MAX_INITIAL_JS_KB', 700);
const maxLazyJsKb = budgetKb('FRONTEND_BUNDLE_MAX_LAZY_JS_KB', 900);
const maxMonacoKb = budgetKb('FRONTEND_BUNDLE_MAX_MONACO_KB', 2_500);

const files = walkFiles(distDir);
const totalKb = files.reduce((sum, file) => sum + sizeKb(file), 0);
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const initialScripts = Array.from(indexHtml.matchAll(/src="([^"]+\.js)"/g)).map((match) => match[1]);
const failures = [];

if (totalKb > maxTotalKb) {
  failures.push(`total dist ${totalKb.toFixed(1)}KB exceeds ${maxTotalKb}KB`);
}

for (const src of initialScripts) {
  const file = path.join(distDir, src.replace(/^\//, ''));
  if (!fs.existsSync(file)) continue;
  const kb = sizeKb(file);
  if (kb > maxInitialJsKb) {
    failures.push(`initial JS ${src} is ${kb.toFixed(1)}KB, exceeds ${maxInitialJsKb}KB`);
  }
}

for (const file of files.filter((candidate) => candidate.endsWith('.js'))) {
  const rel = path.relative(distDir, file);
  const kb = sizeKb(file);
  if (rel.includes('vendor-monaco')) {
    if (kb > maxMonacoKb) {
      failures.push(`Monaco chunk ${rel} is ${kb.toFixed(1)}KB, exceeds ${maxMonacoKb}KB`);
    }
    continue;
  }
  if (!initialScripts.some((src) => rel === src.replace(/^\//, '')) && kb > maxLazyJsKb) {
    failures.push(`lazy JS ${rel} is ${kb.toFixed(1)}KB, exceeds ${maxLazyJsKb}KB`);
  }
}

const summary = {
  totalKb: Number(totalKb.toFixed(1)),
  initialScripts,
  budgetsKb: {
    total: maxTotalKb,
    initialJs: maxInitialJsKb,
    lazyJs: maxLazyJsKb,
    monaco: maxMonacoKb,
  },
};

if (failures.length) {
  console.error(JSON.stringify({ ok: false, ...summary, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
