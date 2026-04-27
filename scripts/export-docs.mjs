import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const htmlDir = path.join(root, 'docs', 'exports', 'html');
const pdfDir = path.join(root, 'docs', 'exports', 'pdf');

if (!fs.existsSync(htmlDir)) {
  console.error('HTML exports not found. Run scripts/export-docs.py first.');
  process.exit(1);
}

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const inputFiles = process.argv.slice(2);
const htmlFiles = inputFiles.length
  ? inputFiles
  : fs.readdirSync(htmlDir).filter((file) => file.endsWith('.html'));

const toFileUrl = (filePath) => `file://${filePath}`;

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const file of htmlFiles) {
    const htmlPath = path.isAbsolute(file) ? file : path.join(htmlDir, file);
    const baseName = path.basename(htmlPath, '.html');
    const pdfPath = path.join(pdfDir, `${baseName}.pdf`);

    await page.goto(toFileUrl(htmlPath), { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-family: Segoe UI, Arial, sans-serif; font-size: 8px; color: #64748b; width: 100%; padding: 0 16mm;">PSScript analysis report</div>',
      footerTemplate: '<div style="font-family: Segoe UI, Arial, sans-serif; font-size: 8px; color: #64748b; width: 100%; padding: 0 16mm; display: flex; justify-content: space-between;"><span></span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
      margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' }
    });

    console.log(`Exported ${pdfPath}`);
  }

  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
