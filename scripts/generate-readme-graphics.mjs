import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const graphicsDir = path.join(root, 'docs/graphics');

fs.mkdirSync(graphicsDir, { recursive: true });

const palette = {
  bg: '#07111f',
  panel: '#0f1b2d',
  panel2: '#111f33',
  text: '#eef6ff',
  muted: '#9eb2c8',
  line: '#36526e',
  blue: '#69b7ff',
  teal: '#3ed6c2',
  green: '#75d481',
  amber: '#f2c65d',
  red: '#ff837a',
  violet: '#a9a5ff',
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

function text(x, y, value, size = 18, weight = 600, fill = palette.text, anchor = 'start') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function wrapText(x, y, lines, size = 14, fill = palette.muted) {
  return lines.map((line, index) => text(x, y + index * (size + 7), line, size, 500, fill)).join('\n');
}

function card(x, y, w, h, title, lines, color, icon) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${palette.panel}" stroke="${color}" stroke-width="1.6"/>
    <rect x="${x + 18}" y="${y + 18}" width="42" height="42" rx="12" fill="${color}" opacity="0.16"/>
    ${text(x + 39, y + 46, icon, 20, 700, color, 'middle')}
    ${text(x + 74, y + 38, title, 18, 750)}
    ${wrapText(x + 74, y + 63, lines, 13, palette.muted)}
  `;
}

function arrow(x1, y1, x2, y2, color = palette.line) {
  return `<path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" stroke="${color}" stroke-width="2.4" fill="none" marker-end="url(#arrow)"/>`;
}

function shell(width, height, title, subtitle, body) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.16} ${height * 0.08}) rotate(52) scale(${width * 0.5} ${height * 0.42})">
          <stop stop-color="${palette.blue}" stop-opacity="0.28"/>
          <stop offset="1" stop-color="${palette.blue}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.9} ${height * 0.18}) rotate(135) scale(${width * 0.42} ${height * 0.48})">
          <stop stop-color="${palette.teal}" stop-opacity="0.20"/>
          <stop offset="1" stop-color="${palette.teal}" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000814" flood-opacity="0.32"/>
        </filter>
        <marker id="arrow" markerWidth="12" markerHeight="12" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L9,4 z" fill="${palette.line}"/>
        </marker>
      </defs>
      <rect width="${width}" height="${height}" rx="30" fill="${palette.bg}"/>
      <rect width="${width}" height="${height}" rx="30" fill="url(#glowA)"/>
      <rect width="${width}" height="${height}" rx="30" fill="url(#glowB)"/>
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="24" fill="#0a1424" stroke="#1d334a" filter="url(#shadow)"/>
      ${text(60, 74, title, 30, 850)}
      ${text(60, 102, subtitle, 15, 500, palette.muted)}
      ${body}
    </svg>
  `;
}

const banner = shell(1400, 420, 'PSScript', 'PowerShell script management, AI analysis, and governed hosted access', `
  <rect x="60" y="135" width="600" height="160" rx="24" fill="${palette.panel2}" stroke="#27425e"/>
  ${text(95, 180, 'Analyze scripts before they', 30, 850)}
  ${text(95, 216, 'become operational risk', 30, 850)}
  ${wrapText(95, 252, ['Upload, deduplicate, version, review, and search PowerShell assets from one workspace.', 'Hosted mode runs on Netlify Functions and Supabase with Google OAuth approval gates.'], 16)}
  <g transform="translate(760 128)">
    ${card(0, 0, 250, 96, 'Script Library', ['hash dedupe', 'versions + tags'], palette.blue, '$')}
    ${card(286, 0, 250, 96, 'AI Review', ['security score', 'quality guidance'], palette.teal, 'AI')}
    ${card(0, 126, 250, 96, 'Supabase', ['Auth + Postgres', 'approval profiles'], palette.green, 'DB')}
    ${card(286, 126, 250, 96, 'Netlify', ['SPA + functions', 'same-origin API'], palette.amber, 'N')}
    ${arrow(250, 48, 286, 48)}
    ${arrow(125, 96, 125, 126)}
    ${arrow(411, 96, 411, 126)}
  </g>
`);

const architecture = shell(1400, 760, 'Current Architecture', 'Local development and hosted production share the same React experience while using different execution boundaries.', `
  ${text(82, 164, 'User Experience', 18, 800, palette.blue)}
  ${card(70, 185, 280, 112, 'React + Vite UI', ['Dashboard, scripts, AI chat', 'Google OAuth callback'], palette.blue, 'UI')}
  ${arrow(350, 240, 450, 240)}
  ${card(450, 130, 300, 112, 'Local Express API', ['dev auth, script CRUD', 'AI orchestration proxy'], palette.violet, 'API')}
  ${card(450, 295, 300, 112, 'Netlify Functions', ['hosted /api/* surface', 'static analysis only'], palette.amber, 'Fn')}
  ${arrow(750, 185, 850, 185)}
  ${arrow(750, 350, 850, 350)}
  ${card(850, 130, 300, 112, 'FastAPI AI Service', ['LangGraph workflows', 'guardrails + routing'], palette.teal, 'AI')}
  ${card(850, 295, 300, 112, 'Supabase Platform', ['Auth, profiles, Postgres', 'pgvector embeddings'], palette.green, 'SB')}
  ${arrow(1000, 242, 1000, 295)}
  <rect x="70" y="480" width="1260" height="170" rx="22" fill="${palette.panel2}" stroke="#25405c"/>
  ${text(100, 525, 'Hosted access rule', 22, 850)}
  ${wrapText(100, 560, ['Supabase Auth proves identity. Netlify Functions create the local app profile in app_profiles.', 'New Google accounts default to disabled until an enabled admin approves them.'], 16)}
  ${card(850, 505, 210, 95, 'Approved', ['full app routes'], palette.green, '✓')}
  ${card(1090, 505, 210, 95, 'Pending', ['status page only'], palette.amber, '!')}
`);

const authFlow = shell(1400, 650, 'Google OAuth Approval Flow', 'First Google sign-in creates a local PSScript account, then waits for admin approval.', `
  ${card(70, 170, 245, 108, '1. Google Sign-In', ['Supabase OAuth session', '/auth/callback'], palette.blue, 'G')}
  ${arrow(315, 224, 405, 224)}
  ${card(405, 170, 250, 108, '2. Profile Upsert', ['app_profiles row', 'provider = google'], palette.green, 'DB')}
  ${arrow(655, 224, 745, 224)}
  ${card(745, 170, 250, 108, '3. Disabled Default', ['is_enabled = false', '403 for app APIs'], palette.amber, '!')}
  ${arrow(995, 224, 1085, 224)}
  ${card(1085, 170, 245, 108, '4. Admin Enables', ['checkbox approval', 'last-admin guard'], palette.teal, '✓')}
  <rect x="190" y="380" width="1020" height="125" rx="24" fill="${palette.panel2}" stroke="#2b4765"/>
  ${text(230, 430, 'Pending users can only see /pending-approval', 25, 850)}
  ${wrapText(230, 466, ['The browser keeps enough session state to refresh approval status.', 'Netlify Functions block protected data routes with account_pending_approval.'], 16)}
`);

const requestFlow = shell(1400, 700, 'Request Flow', 'Script content moves through validation, persistence, AI review, and team-visible results.', `
  ${card(75, 175, 250, 110, 'Upload / Create', ['PowerShell content', 'metadata + tags'], palette.blue, '$')}
  ${arrow(325, 230, 415, 230)}
  ${card(415, 175, 250, 110, 'API Guardrails', ['auth + payload checks', 'SHA-256 dedupe'], palette.violet, 'API')}
  ${arrow(665, 230, 755, 230)}
  ${card(755, 175, 250, 110, 'Postgres + pgvector', ['scripts, versions', 'analysis, embeddings'], palette.green, 'DB')}
  ${arrow(1005, 230, 1095, 230)}
  ${card(1095, 175, 230, 110, 'AI Providers', ['OpenAI primary', 'Anthropic fallback'], palette.teal, 'AI')}
  <rect x="105" y="405" width="1190" height="120" rx="24" fill="${palette.panel2}" stroke="#2b4765"/>
  ${text(145, 456, 'Results shown back in the app', 26, 850)}
  ${wrapText(145, 493, ['Security score, quality score, management summary, beginner explanation, remediation guidance, search results, and analytics are persisted for repeated review.'], 16)}
`);

const files = {
  'banner.svg': banner,
  'architecture.svg': architecture,
  'google-oauth-approval-flow.svg': authFlow,
  'request-flow.svg': requestFlow,
};

for (const [fileName, svg] of Object.entries(files)) {
  const svgPath = path.join(graphicsDir, fileName);
  const pngPath = path.join(graphicsDir, fileName.replace(/\.svg$/, '.png'));
  fs.writeFileSync(svgPath, svg.trim() + '\n');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(pngPath);
  console.log(path.relative(root, svgPath));
  console.log(path.relative(root, pngPath));
}
