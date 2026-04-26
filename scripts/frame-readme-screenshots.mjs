import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'docs/screenshots');
const outputDir = path.join(sourceDir, 'readme');

const screenshots = [
  ['login.png', 'Login'],
  ['dashboard.png', 'Dashboard'],
  ['scripts.png', 'Script Library'],
  ['upload.png', 'Upload Flow'],
  ['analysis.png', 'AI Analysis'],
  ['script-detail.png', 'Script Detail'],
  ['documentation.png', 'Documentation'],
  ['chat.png', 'AI Chat'],
  ['analytics.png', 'Analytics'],
  ['agentic-assistant.png', 'Agentic Assistant'],
  ['agent-orchestration.png', 'Agent Orchestration'],
  ['ui-components.png', 'UI Components'],
  ['settings.png', 'Settings'],
  ['settings-profile.png', 'Settings Profile'],
  ['data-maintenance.png', 'Data Maintenance'],
];

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

async function frameScreenshot(fileName, title) {
  const sourcePath = path.join(sourceDir, fileName);
  const outputPath = path.join(outputDir, fileName);
  const screenshot = await sharp(sourcePath)
    .resize({ width: 1240, withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const meta = await sharp(screenshot).metadata();

  const pad = 44;
  const chromeHeight = 54;
  const frameRadius = 26;
  const shotWidth = meta.width;
  const shotHeight = meta.height;
  const width = shotWidth + pad * 2;
  const height = shotHeight + chromeHeight + pad * 2;
  const escapedTitle = escapeXml(title);

  const baseSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.28"/>
        </filter>
        <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="1" stop-color="#1f2937"/>
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="${frameRadius}" fill="#0b1220" filter="url(#shadow)"/>
      <rect x="${pad}" y="${pad}" width="${shotWidth}" height="${shotHeight + chromeHeight}" rx="18" fill="#111827"/>
      <path d="M ${pad + 18} ${pad} H ${pad + shotWidth - 18} A 18 18 0 0 1 ${pad + shotWidth} ${pad + 18} V ${pad + chromeHeight} H ${pad} V ${pad + 18} A 18 18 0 0 1 ${pad + 18} ${pad} Z" fill="url(#chrome)"/>
      <circle cx="${pad + 28}" cy="${pad + 27}" r="6" fill="#ef4444"/>
      <circle cx="${pad + 49}" cy="${pad + 27}" r="6" fill="#f59e0b"/>
      <circle cx="${pad + 70}" cy="${pad + 27}" r="6" fill="#22c55e"/>
      <rect x="${pad + 104}" y="${pad + 14}" width="${Math.min(360, shotWidth - 208)}" height="26" rx="13" fill="#020617" opacity="0.45"/>
      <text x="${pad + 124}" y="${pad + 32}" fill="#cbd5e1" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="600">${escapedTitle}</text>
      <rect x="${pad}" y="${pad + chromeHeight}" width="${shotWidth}" height="${shotHeight}" fill="#0f172a"/>
    </svg>
  `);

  const overlaySvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pad}" y="${pad}" width="${shotWidth}" height="${shotHeight + chromeHeight}" rx="18" fill="none" stroke="#334155" stroke-width="1.5"/>
      <line x1="${pad}" y1="${pad + chromeHeight}" x2="${pad + shotWidth}" y2="${pad + chromeHeight}" stroke="#334155" stroke-width="1"/>
    </svg>
  `);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: baseSvg, top: 0, left: 0 },
      { input: screenshot, top: pad + chromeHeight, left: pad },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  console.log(path.relative(root, outputPath));
}

fs.mkdirSync(outputDir, { recursive: true });

for (const [fileName, title] of screenshots) {
  await frameScreenshot(fileName, title);
}
