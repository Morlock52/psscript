import express from 'express';
import axios from 'axios';

const router = express.Router();

const noStore = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

function toolsHttpBase(): string | null {
  return process.env.PWSH_TOOLS_HTTP_URL || null;
}

router.post('/lint', noStore, async (req, res) => {
  const base = toolsHttpBase();
  if (!base) return res.status(503).json({ message: 'pwsh-tools not configured' });
  try {
    const resp = await axios.post(`${base.replace(/\/$/, '')}/lint`, req.body, { timeout: 30_000 });
    return res.status(resp.status).json(resp.data);
  } catch (err: any) {
    const status = err?.response?.status || 502;
    return res.status(status).json({ message: 'pwsh-tools lint failed' });
  }
});

router.post('/format', noStore, async (req, res) => {
  const base = toolsHttpBase();
  if (!base) return res.status(503).json({ message: 'pwsh-tools not configured' });
  try {
    const resp = await axios.post(`${base.replace(/\/$/, '')}/format`, req.body, { timeout: 30_000 });
    return res.status(resp.status).json(resp.data);
  } catch (err: any) {
    const status = err?.response?.status || 502;
    return res.status(status).json({ message: 'pwsh-tools format failed' });
  }
});

export default router;
