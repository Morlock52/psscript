import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const router = express.Router();

const noStore = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

const getGithubRepo = (): string => process.env.GITHUB_REPO || 'Morlock52/psscript';
const getGithubBranch = (): string => process.env.GITHUB_BRANCH || 'main';
const getGithubRawBase = (): string =>
  `https://raw.githubusercontent.com/${getGithubRepo()}/${getGithubBranch()}`;

const resolveExportsBaseDir = (): string => {
  // Optional override for tests or nonstandard deployments.
  if (process.env.DOCS_EXPORTS_PATH) return process.env.DOCS_EXPORTS_PATH;

  // Docker mounts `./docs:/docs` so exports are visible at /docs/exports.
  if (process.env.DOCKER_ENV === 'true') return '/docs/exports';

  // Local dev: repo-root/docs/exports relative to compiled backend path.
  return path.resolve(__dirname, '../../../docs/exports');
};

type ExportFileEntry = {
  filename: string;
  localUrl: string; // path-only, served by backend at /docs/exports/*
  githubRawUrl: string;
  bytes: number;
  modifiedAt: string;
};

async function listExportFiles(kind: 'pdf' | 'docx'): Promise<ExportFileEntry[]> {
  const baseDir = resolveExportsBaseDir();
  const dir = path.join(baseDir, kind);

  if (!fs.existsSync(dir)) return [];

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(name => name.toLowerCase().endsWith(`.${kind}`))
    .sort((a, b) => a.localeCompare(b));

  const out: ExportFileEntry[] = [];
  for (const filename of files) {
    const full = path.join(dir, filename);
    const stat = await fs.promises.stat(full);
    out.push({
      filename,
      localUrl: `/docs/exports/${kind}/${encodeURIComponent(filename)}`,
      githubRawUrl: `${getGithubRawBase()}/docs/exports/${kind}/${encodeURIComponent(filename)}`,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    });
  }
  return out;
}

// GET /api/docs/exports
router.get('/exports', noStore, async (_req, res, next) => {
  try {
    const [pdf, docx] = await Promise.all([listExportFiles('pdf'), listExportFiles('docx')]);
    res.json({
      repo: getGithubRepo(),
      branch: getGithubBranch(),
      pdf,
      docx
    });
  } catch (err) {
    next(err);
  }
});

async function readLocalReadme(): Promise<string | null> {
  const candidates: string[] = [];

  if (process.env.README_PATH) candidates.push(process.env.README_PATH);
  // Local dev compiled path -> repo root README
  candidates.push(path.resolve(__dirname, '../../../README.md'));
  // Docker plan: mount repo root at /repo:ro
  candidates.push('/repo/README.md');

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        const raw = await fs.promises.readFile(p, 'utf8');
        if (raw && raw.trim().length > 0) return raw;
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}

async function readGithubReadme(): Promise<string> {
  const url = `${getGithubRawBase()}/README.md`;
  const resp = await axios.get(url, { timeout: 15_000 });
  return String(resp.data || '');
}

// GET /api/docs/readme
router.get('/readme', noStore, async (_req, res, next) => {
  try {
    const local = await readLocalReadme();
    if (local) {
      return res.json({
        repo: getGithubRepo(),
        branch: getGithubBranch(),
        source: 'local',
        content: local
      });
    }

    const remote = await readGithubReadme();
    return res.json({
      repo: getGithubRepo(),
      branch: getGithubBranch(),
      source: 'github',
      content: remote
    });
  } catch (err) {
    next(err);
  }
});

export default router;

