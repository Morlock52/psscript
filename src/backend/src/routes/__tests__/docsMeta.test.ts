import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import docsMetaRouter from '../docsMeta';
import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';

function makeApp() {
  const app = express();
  app.use('/api/docs', docsMetaRouter);
  // Basic error handler for router failures in tests
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: String(err?.message || err || 'error') });
  });
  return app;
}

describe('docsMeta routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('GET /api/docs/exports lists files from DOCS_EXPORTS_PATH and builds correct URLs', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psscript-docs-exports-'));
    const pdfDir = path.join(tmp, 'pdf');
    const docxDir = path.join(tmp, 'docx');
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.mkdirSync(docxDir, { recursive: true });

    fs.writeFileSync(path.join(pdfDir, 'B.pdf'), 'b');
    fs.writeFileSync(path.join(pdfDir, 'A.pdf'), 'a');
    fs.writeFileSync(path.join(docxDir, 'Z.docx'), 'z');

    process.env.DOCS_EXPORTS_PATH = tmp;
    process.env.GITHUB_REPO = 'Morlock52/psscript';
    process.env.GITHUB_BRANCH = 'main';

    const app = makeApp();
    const resp = await request(app).get('/api/docs/exports').expect(200);

    expect(resp.body).toHaveProperty('repo', 'Morlock52/psscript');
    expect(resp.body).toHaveProperty('branch', 'main');

    expect(Array.isArray(resp.body.pdf)).toBe(true);
    expect(resp.body.pdf.map((x: any) => x.filename)).toEqual(['A.pdf', 'B.pdf']);
    expect(resp.body.pdf[0]).toMatchObject({
      filename: 'A.pdf',
      localUrl: '/docs/exports/pdf/A.pdf',
      githubRawUrl: 'https://raw.githubusercontent.com/Morlock52/psscript/main/docs/exports/pdf/A.pdf',
    });

    expect(Array.isArray(resp.body.docx)).toBe(true);
    expect(resp.body.docx.map((x: any) => x.filename)).toEqual(['Z.docx']);
    expect(resp.body.docx[0]).toMatchObject({
      filename: 'Z.docx',
      localUrl: '/docs/exports/docx/Z.docx',
      githubRawUrl: 'https://raw.githubusercontent.com/Morlock52/psscript/main/docs/exports/docx/Z.docx',
    });
  });

  test('GET /api/docs/readme returns README content from README_PATH', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psscript-readme-'));
    const readmePath = path.join(tmp, 'README.md');
    fs.writeFileSync(readmePath, '# Hello\n\nReadme test\n');

    process.env.README_PATH = readmePath;
    process.env.GITHUB_REPO = 'Morlock52/psscript';
    process.env.GITHUB_BRANCH = 'main';

    const app = makeApp();
    const resp = await request(app).get('/api/docs/readme').expect(200);

    expect(resp.body).toHaveProperty('source', 'local');
    expect(String(resp.body.content)).toContain('Readme test');
    expect(resp.body).toHaveProperty('repo', 'Morlock52/psscript');
    expect(resp.body).toHaveProperty('branch', 'main');
  });
});
