import express from 'express';
import { Op } from 'sequelize';
import CommandInsight from '../models/CommandInsight';
import CommandEnrichmentJob from '../models/CommandEnrichmentJob';
import { createCommandEnrichmentJob, runCommandEnrichmentJob } from '../services/commands/commandInsights';

const router = express.Router();

const noStore = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Start enrichment job (scans documentation.extracted_commands and populates command_insights)
router.post('/enrich', noStore, async (req, res, next) => {
  try {
    const request = (req.body && typeof req.body === 'object') ? req.body : {};
    const { job, alreadyRunning } = await createCommandEnrichmentJob(request);

    if (!alreadyRunning) {
      // Fire-and-forget background runner
      setImmediate(() => {
        runCommandEnrichmentJob(job.id).catch(() => {
          // Errors are recorded on job row; route should not crash the process.
        });
      });
    }

    return res.status(alreadyRunning ? 409 : 202).json({
      jobId: job.id,
      status: job.status,
      alreadyRunning
    });
  } catch (err) {
    next(err);
  }
});

// Get job status (polling; must NOT be cached)
router.get('/enrich/:jobId', noStore, async (req, res, next) => {
  try {
    const jobId = (req.params.jobId || '').trim();
    const job = await CommandEnrichmentJob.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ error: 'not_found', jobId });
    }
    return res.json({
      id: job.id,
      status: job.status,
      request: job.request,
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      currentCmdlet: job.currentCmdlet,
      cancelRequested: job.cancelRequested,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      updatedAt: job.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

// Cancel job
router.post('/enrich/:jobId/cancel', noStore, async (req, res, next) => {
  try {
    const jobId = (req.params.jobId || '').trim();
    const job = await CommandEnrichmentJob.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ error: 'not_found', jobId });
    }

    await CommandEnrichmentJob.update({ cancelRequested: true } as any, { where: { id: jobId } });
    const updated = await CommandEnrichmentJob.findByPk(jobId);
    return res.status(202).json({
      id: updated?.id,
      status: updated?.status,
      cancelRequested: updated?.cancelRequested
    });
  } catch (err) {
    next(err);
  }
});

// Fetch stored insights for a cmdlet
router.get('/:cmdlet', noStore, async (req, res, next) => {
  try {
    const cmdlet = (req.params.cmdlet || '').trim();
    if (!cmdlet) {
      return res.status(400).json({ error: 'cmdlet is required' });
    }

    const insight = await CommandInsight.findOne({
      where: { cmdletName: { [Op.iLike]: cmdlet } as any }
    });

    if (!insight) {
      return res.status(404).json({ error: 'not_found', cmdlet });
    }

    return res.json({
      id: insight.id,
      cmdletName: insight.cmdletName,
      description: insight.description,
      howToUse: insight.howToUse,
      keyParameters: insight.keyParameters,
      useCases: insight.useCases,
      examples: insight.examples,
      sampleOutput: insight.sampleOutput,
      flags: insight.flags,
      docsUrls: insight.docsUrls,
      sources: insight.sources,
      lastEnrichedAt: insight.lastEnrichedAt,
      updatedAt: insight.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

export default router;
