import { Request, Response } from 'express';
import { Documentation } from '../models';
import Script from '../models/Script';
import { searchPowerShellDocs as _searchPowerShellDocs } from '../services/agentic/tools/PowerShellDocsSearch';
import axios from 'axios';
import aiService from '../utils/aiService';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { docCrawlJobService, type DocCrawlJobProgress } from '../services/DocCrawlJobService';

/**
 * Documentation Controller
 *
 * Handles CRUD operations and search for PowerShell documentation.
 * Supports crawling from external sources and storing locally.
 */
export class DocumentationController {
  /**
   * Get recent documentation entries
   */
  async getRecent(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const docs = await Documentation.findAll({
        order: [['crawled_at', 'DESC']],
        limit
      });

      res.json({
        success: true,
        data: docs,
        total: docs.length
      });
    } catch (error) {
      console.error('Error fetching recent documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch documentation'
      });
    }
  }

  /**
   * Search documentation
   */
  async search(req: Request, res: Response) {
    try {
      const {
        query,
        sources,
        tags,
        contentTypes,
        limit = 20,
        offset = 0,
        sortBy = 'date'
      } = req.query;

      const results = await Documentation.search({
        query: query as string,
        sources: sources ? (sources as string).split(',') : undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        contentTypes: contentTypes ? (contentTypes as string).split(',') : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        sortBy: sortBy as 'relevance' | 'date' | 'title'
      });

      res.json({
        success: true,
        data: results.items,
        total: results.total,
        limit: results.limit,
        offset: results.offset
      });
    } catch (error) {
      console.error('Error searching documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search documentation'
      });
    }
  }

  /**
   * Get available documentation sources
   */
  async getSources(req: Request, res: Response) {
    try {
      const sources = await Documentation.getSources();

      // Add default sources if none exist
      const defaultSources = ['Microsoft Learn', 'PowerShell Gallery', 'GitHub'];
      const allSources = [...new Set([...sources, ...defaultSources])];

      res.json({
        success: true,
        data: allSources
      });
    } catch (error) {
      console.error('Error fetching sources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sources'
      });
    }
  }

  /**
   * Get available tags
   */
  async getTags(req: Request, res: Response) {
    try {
      const tags = await Documentation.getTags();

      // Add default tags if none exist
      const defaultTags = [
        'cmdlet', 'module', 'function', 'script', 'tutorial',
        'reference', 'example', 'best-practices', 'security',
        'automation', 'active-directory', 'azure', 'aws'
      ];
      const allTags = [...new Set([...tags, ...defaultTags])];

      res.json({
        success: true,
        data: allTags.sort()
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tags'
      });
    }
  }

  /**
   * Get single documentation item by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const doc = await Documentation.findByPk(id);

      if (!doc) {
        return res.status(404).json({
          success: false,
          error: 'Documentation not found'
        });
      }

      res.json({
        success: true,
        data: doc
      });
    } catch (error) {
      console.error('Error fetching documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch documentation'
      });
    }
  }

  /**
   * Create or update documentation entry
   */
  async upsert(req: Request, res: Response) {
    try {
      const docData = req.body;

      if (!docData.url || !docData.title) {
        return res.status(400).json({
          success: false,
          error: 'URL and title are required'
        });
      }

      const [doc, created] = await Documentation.upsertDoc({
        ...docData,
        crawledAt: new Date()
      });

      res.json({
        success: true,
        data: doc,
        created
      });
    } catch (error) {
      console.error('Error upserting documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save documentation'
      });
    }
  }

  /**
   * Delete documentation entry
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const deleted = await Documentation.destroy({
        where: { id: parseInt(id) }
      });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Documentation not found'
        });
      }

      res.json({
        success: true,
        message: 'Documentation deleted'
      });
    } catch (error) {
      console.error('Error deleting documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete documentation'
      });
    }
  }

  /**
   * Crawl documentation from Microsoft Learn
   * Fetches documentation via API and stores in database
   */
  async crawlMSLearn(req: Request, res: Response) {
    try {
      const { query, maxResults = 20 } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }

      // Use the PowerShell docs search to find relevant pages
      const searchUrl = `https://learn.microsoft.com/api/search?search=${encodeURIComponent(query)}&locale=en-us&$filter=category eq 'Documentation' and products/any(p: p eq 'PowerShell')&$top=${maxResults}`;

      const response = await axios.get(searchUrl);

      if (!response.data || !response.data.results) {
        return res.json({
          success: true,
          data: [],
          message: 'No results found'
        });
      }

      const results = response.data.results;
      const savedDocs: any[] = [];

      // Process and save each result
      for (const result of results) {
        try {
          // Extract tags from the result
          const tags: string[] = [];
          if (result.title?.toLowerCase().includes('cmdlet')) tags.push('cmdlet');
          if (result.title?.toLowerCase().includes('module')) tags.push('module');
          if (result.title?.toLowerCase().includes('function')) tags.push('function');
          if (result.url?.includes('/reference/')) tags.push('reference');
          if (result.url?.includes('/how-to/')) tags.push('tutorial');

          // Determine content type
          let contentType = 'article';
          if (result.url?.includes('/reference/')) contentType = 'reference';
          if (result.url?.includes('/overview/')) contentType = 'overview';
          if (result.url?.includes('/how-to/')) contentType = 'tutorial';

          const [doc, created] = await Documentation.upsertDoc({
            title: result.title,
            url: result.url,
            content: result.description || '',
            summary: result.description,
            source: 'Microsoft Learn',
            contentType,
            tags,
            metadata: {
              lastModified: result.lastModifiedDateTime,
              breadcrumbs: result.breadcrumbs || []
            },
            crawledAt: new Date()
          });

          savedDocs.push({ doc, created });
        } catch (err) {
          console.error(`Error saving doc ${result.url}:`, err);
        }
      }

      res.json({
        success: true,
        data: savedDocs,
        total: savedDocs.length,
        message: `Crawled and saved ${savedDocs.length} documentation entries`
      });
    } catch (error) {
      console.error('Error crawling MS Learn:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to crawl documentation'
      });
    }
  }

  /**
   * Bulk import documentation
   */
  async bulkImport(req: Request, res: Response) {
    try {
      const { documents } = req.body;

      if (!Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Documents array is required'
        });
      }

      const results: any[] = [];

      for (const doc of documents) {
        try {
          const [savedDoc, created] = await Documentation.upsertDoc({
            ...doc,
            crawledAt: doc.crawledAt || new Date()
          });
          results.push({ doc: savedDoc, created });
        } catch (err) {
          console.error(`Error importing doc ${doc.url}:`, err);
          results.push({ url: doc.url, error: 'Failed to import' });
        }
      }

      res.json({
        success: true,
        data: results,
        imported: results.filter(r => r.doc).length,
        errors: results.filter(r => r.error).length
      });
    } catch (error) {
      console.error('Error bulk importing documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import documentation'
      });
    }
  }

  /**
   * Get documentation statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const total = await Documentation.count();
      const sources = await Documentation.getSources();
      const tags = await Documentation.getTags();

      // Get counts by source
      const sourceCounts: Record<string, number> = {};
      for (const source of sources) {
        sourceCounts[source] = await Documentation.count({
          where: { source }
        });
      }

      res.json({
        success: true,
        data: {
          total,
          sources: sourceCounts,
          tagsCount: tags.length,
          lastCrawled: await Documentation.max('crawled_at')
        }
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  }

  /**
   * Start an AI-powered crawl as an async job.
   *
   * Why: crawling + AI analysis can take minutes, and long HTTP requests often
   * get cut off by browsers/proxies (surfacing as a generic "Network Error").
   */
  async startCrawlWithAIJob(req: Request, res: Response) {
    try {
      // Backwards/forwards compatibility: UI/clients have historically used
      // url/startUrl and depth/maxDepth (and "linkDepth" in some docs).
      const body = (req.body || {}) as any;
      const url = body.url || body.startUrl;
      const maxPages = body.maxPages ?? 10;
      const depth = body.depth ?? body.maxDepth ?? body.linkDepth ?? 1;

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      const job = docCrawlJobService.createJob({ url, maxPages, depth });
      docCrawlJobService.updateJob(job.id, {
        status: 'running',
        startedAt: new Date().toISOString(),
        message: 'Starting crawl…',
      });

      setImmediate(() => {
        // Important: keep the backend process alive even if a crawl job fails.
        // Also: errors thrown before the promise is created (e.g., unbound `this`) must be caught.
        try {
          void this.executeCrawlWithAIJob(job.id).catch((err) => {
            console.error('Doc crawl job failed:', err);
            docCrawlJobService.updateJob(job.id, {
              status: 'error',
              finishedAt: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
              message: 'Crawl failed',
            });
          });
        } catch (err) {
          console.error('Doc crawl job threw synchronously:', err);
          docCrawlJobService.updateJob(job.id, {
            status: 'error',
            finishedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
            message: 'Crawl failed',
          });
        }
      });

      return res.status(202).json({
        success: true,
        data: { jobId: job.id },
        message: 'Crawl started',
      });
    } catch (error) {
      console.error('Error starting crawl job:', error);
      return res.status(500).json({ success: false, error: 'Failed to start crawl' });
    }
  }

  async getCrawlWithAIJobStatus(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = docCrawlJobService.getJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.json({ success: true, data: job });
  }

  async cancelCrawlWithAIJob(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = docCrawlJobService.cancelJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.json({ success: true, data: job, message: 'Cancel requested' });
  }

  private async executeCrawlWithAIJob(jobId: string): Promise<void> {
    const job = docCrawlJobService.getJob(jobId);
    if (!job) return;

    const isCanceled = () => Boolean(docCrawlJobService.getJob(jobId)?.canceled);
    const updateProgress = (progress: DocCrawlJobProgress, message: string) => {
      const current = docCrawlJobService.getJob(jobId);
      if (!current || current.status === 'canceled') return;
      docCrawlJobService.updateJob(jobId, { progress, message });
    };

    const pushProgressFromDocs = (message: string, crawledDocs: any[], pagesInFlight = 0) => {
      const scriptsFound = crawledDocs.reduce((sum, d) => sum + (d.metadata?.scriptsFound || 0), 0);
      const scriptsSaved = crawledDocs.reduce((sum, d) => sum + (d.metadata?.savedScriptIds?.length || 0), 0);
      updateProgress(
        {
          // `crawledDocs.length` only increases after we save each doc entry.
          // While a page is fetched/analyzed, reflect that as "in flight" so the UI doesn't look frozen.
          pagesProcessed: Math.max(crawledDocs.length, pagesInFlight),
          totalPages: job.config.maxPages,
          scriptsFound,
          scriptsSaved,
        },
        message
      );
    };

    try {
      const { url, maxPages, depth } = job.config;
      const crawledDocs: any[] = [];
      const visitedUrls = new Set<string>();

      // Helper to fetch and parse a URL
      const fetchPage = async (pageUrl: string): Promise<{ html: string; status: number } | null> => {
        try {
          const response = await axios.get(pageUrl, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PSScriptCrawler/1.0; +https://psscript.app)',
            },
          });
          return { html: response.data, status: response.status };
        } catch (error) {
          console.error(`Failed to fetch ${pageUrl}:`, error);
          return null;
        }
      };

      const extractScripts = (html: string): string[] => {
        const $ = cheerio.load(html);
        const scripts: string[] = [];

        $('pre code, code, .code-block, .powershell, [class*="language-powershell"], [class*="lang-ps"]').each((_, elem) => {
          const code = $(elem).text().trim();
          if (
            code &&
            (code.includes('Get-') ||
              code.includes('Set-') ||
              code.includes('New-') ||
              code.includes('Remove-') ||
              code.includes('$') ||
              code.includes('param(') ||
              code.includes('function ') ||
              code.includes('Write-Host') ||
              code.includes('Write-Output') ||
              code.includes('ForEach-Object') ||
              code.includes('Where-Object') ||
              code.match(/\|\s*(Select|Where|ForEach|Sort|Group)/))
          ) {
            if (code.length > 20 && code.length < 10000) scripts.push(code);
          }
        });

        return scripts;
      };

      const generateAITitleAndSummary = async (
        content: string,
        pageUrl: string,
        scripts: string[] = []
      ): Promise<{ title: string; summary: string; category: string; aiInsights: string[]; codeExample: string }> => {
        try {
          const scriptExamples = scripts.slice(0, 2).map((script, i) => {
            const snippet =
              script.length > 300
                ? script.substring(0, script.indexOf('\n', 250) > 0 ? script.indexOf('\n', 250) : 300) + '...'
                : script;
            return `Script ${i + 1}:\n\`\`\`powershell\n${snippet}\n\`\`\``;
          }).join('\n\n');

          const prompt = `Analyze this PowerShell documentation and create a comprehensive summary card.\n\n**Generate:**\n1. title (max 60 chars)\n2. summary (max 150 chars)\n3. aiInsights (3-4 bullet strings)\n4. codeExample (max 100 chars)\n5. category (one of the predefined categories)\n\n**Page Content:**\n${content.substring(0, 2500)}\n\n${scripts.length > 0 ? `**PowerShell Code Found:**\n${scriptExamples}` : ''}\n\n**Respond ONLY with valid JSON.**`;

          const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
          // Force a non-coordinator path in the AI service for this deterministic task.
          // The agent coordinator can be slow/blocked when no specialized agent is available.
          const chatResponse = await axios.post(
            `${AI_SERVICE_URL}/chat`,
            {
              messages: [{ role: 'user', content: prompt }],
              agent_type: 'assistant',
            },
            { timeout: 90000 }
          );

          if (chatResponse.data?.response) {
            let responseText = chatResponse.data.response;
            if (responseText.startsWith('"') && responseText.endsWith('"')) responseText = responseText.slice(1, -1);
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                title: parsed.title || 'Untitled Document',
                summary: parsed.summary || '',
                category: parsed.category || 'General',
                aiInsights: Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [],
                codeExample: parsed.codeExample || '',
              };
            }
          }
        } catch (error) {
          console.error('AI title/summary generation failed:', (error as any)?.message || error);
        }

        // Fallback
        const urlParts = pageUrl.split('/').filter(Boolean);
        const fallbackTitle = (urlParts[urlParts.length - 1] || 'Documentation Page').replace(/[-_]/g, ' ').slice(0, 60);
        return { title: fallbackTitle, summary: content.substring(0, 200), category: 'General', aiInsights: [], codeExample: '' };
      };

      const analyzeScripts = async (scripts: string[]): Promise<{ name: string; description: string; code: string }[]> => {
        const analyzed: { name: string; description: string; code: string }[] = [];
        for (const script of scripts.slice(0, 5)) {
          if (isCanceled()) break;
          try {
            const analysisResult = await aiService.analyzeScript(script, undefined, 'quick');
            if (analysisResult?.analysis) {
              analyzed.push({
                name: analysisResult.analysis.title || 'PowerShell Script',
                description: analysisResult.analysis.purpose || 'Script extracted from documentation',
                code: script,
              });
            }
          } catch (error) {
            console.error('Script analysis failed:', error);
            analyzed.push({ name: 'PowerShell Script', description: 'Script extracted from documentation', code: script });
          }
        }
        return analyzed;
      };

      const crawlPage = async (pageUrl: string, currentDepth: number) => {
        if (isCanceled()) return;
        if (visitedUrls.has(pageUrl) || crawledDocs.length >= maxPages) return;
        visitedUrls.add(pageUrl);

        pushProgressFromDocs(`Crawling: ${pageUrl}`, crawledDocs, Math.min(crawledDocs.length + 1, maxPages));
        const pageData = await fetchPage(pageUrl);
        if (!pageData) return;

        const $ = cheerio.load(pageData.html);
        $('script, style, nav, footer, header').remove();
        const textContent = $('article, main, .content, .documentation, body').first().text().replace(/\s+/g, ' ').trim();
        if (textContent.length < 100) return;

        // Treat "pagesProcessed" as "pages fetched and being processed", so the UI progress bar
        // doesn't appear frozen during long AI calls.
        updateProgress(
          {
            pagesProcessed: Math.min(crawledDocs.length + 1, maxPages),
            totalPages: maxPages,
            scriptsFound: crawledDocs.reduce((sum, d) => sum + (d.metadata?.scriptsFound || 0), 0),
            scriptsSaved: crawledDocs.reduce((sum, d) => sum + (d.metadata?.savedScriptIds?.length || 0), 0),
          },
          `Fetched page (${Math.min(crawledDocs.length + 1, maxPages)}/${maxPages}). Preparing analysis…`
        );

        const extractedScripts = extractScripts(pageData.html);
        pushProgressFromDocs(`Analyzing page with AI: ${pageUrl}`, crawledDocs, Math.min(crawledDocs.length + 1, maxPages));
        const { title, summary, category, aiInsights, codeExample } = await generateAITitleAndSummary(textContent, pageUrl, extractedScripts);
        const analyzedScripts = extractedScripts.length > 0 ? await analyzeScripts(extractedScripts) : [];

        const commandPattern = /\b(Get|Set|New|Remove|Start|Stop|Add|Clear|Copy|Move|Rename|Test|Import|Export|Invoke|Register|Unregister|Update|Write|Read)-[A-Z][a-zA-Z]+\b/g;
        const extractedCommands = [...new Set(textContent.match(commandPattern) || [])];

        const modulePattern = /\b(Microsoft\.[A-Z][a-zA-Z.]+|PSReadLine|Pester|PSScriptAnalyzer|Az\.[A-Z][a-zA-Z]+)\b/g;
        const extractedModules = [...new Set(textContent.match(modulePattern) || [])];

        let source = 'Web';
        if (pageUrl.includes('microsoft.com')) source = 'Microsoft Learn';
        else if (pageUrl.includes('github.com')) source = 'GitHub';
        else if (pageUrl.includes('powershellgallery.com')) source = 'PowerShell Gallery';

        const tags: string[] = [];
        if (extractedCommands.length > 0) tags.push('cmdlet');
        if (textContent.toLowerCase().includes('module')) tags.push('module');
        if (textContent.toLowerCase().includes('function')) tags.push('function');
        if (textContent.toLowerCase().includes('tutorial')) tags.push('tutorial');
        if (textContent.toLowerCase().includes('script')) tags.push('script');
        if (analyzedScripts.length > 0) tags.push('has-scripts');

        const savedScriptIds: number[] = [];
        for (const analyzedScript of analyzedScripts) {
          if (isCanceled()) break;
          try {
            const fileHash = crypto.createHash('md5').update(analyzedScript.code).digest('hex');
            const existingScript = await Script.findOne({ where: { fileHash } });
            if (existingScript) {
              savedScriptIds.push(existingScript.id);
              continue;
            }
            const newScript = await Script.create({
              title: analyzedScript.name.substring(0, 100),
              description: `${analyzedScript.description}\n\nSource: ${pageUrl}`,
              content: analyzedScript.code,
              userId: 1,
              isPublic: true,
              version: 1,
              executionCount: 0,
              fileHash,
            });
            savedScriptIds.push(newScript.id);
          } catch (scriptError) {
            console.error(`Error saving script ${analyzedScript.name}:`, scriptError);
          }
        }

        const docEntry = {
          title,
          url: pageUrl,
          content: textContent.substring(0, 10000),
          summary,
          source,
          contentType: extractedScripts.length > 0 ? 'example' : 'article',
          category,
          tags: [...new Set(tags)],
          extractedCommands,
          extractedFunctions: analyzedScripts.map((s) => s.name),
          extractedModules,
          metadata: {
            scriptsFound: analyzedScripts.length,
            scripts: analyzedScripts.map((s) => ({ name: s.name, description: s.description, code: s.code })),
            savedScriptIds,
            crawledDepth: currentDepth,
            aiInsights,
            codeExample,
          },
          crawledAt: new Date().toISOString(),
        };

        crawledDocs.push(docEntry);
        pushProgressFromDocs(`Saved: ${title}`, crawledDocs);

        if (currentDepth < depth && crawledDocs.length < maxPages && !isCanceled()) {
          const links: string[] = [];
          $('a[href]').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              try {
                const fullUrl = new URL(href, pageUrl).href;
                const baseUrl = new URL(pageUrl);
                const linkUrl = new URL(fullUrl);
                if (linkUrl.hostname === baseUrl.hostname && !visitedUrls.has(fullUrl)) links.push(fullUrl);
              } catch {
                // skip
              }
            }
          });

          for (const link of links.slice(0, 3)) {
            if (crawledDocs.length >= maxPages || isCanceled()) break;
            await crawlPage(link, currentDepth + 1);
          }
        }
      };

      await crawlPage(url, 0);

      // Save crawled docs to DB
      let totalDocsSaved = 0;
      for (const doc of crawledDocs) {
        if (isCanceled()) break;
        try {
          await Documentation.upsertDoc({ ...doc, crawledAt: new Date() });
          totalDocsSaved += 1;
        } catch (err) {
          console.error(`Error saving doc ${doc.url}:`, err);
        }
      }

      const scriptsSaved = crawledDocs.reduce((sum, d) => sum + (d.metadata?.savedScriptIds?.length || 0), 0);
      const scriptsFound = crawledDocs.reduce((sum, d) => sum + (d.metadata?.scriptsFound || 0), 0);

      if (isCanceled()) {
        docCrawlJobService.updateJob(jobId, {
          status: 'canceled',
          finishedAt: new Date().toISOString(),
          message: 'Canceled',
        });
        return;
      }

      docCrawlJobService.updateJob(jobId, {
        status: 'completed',
        finishedAt: new Date().toISOString(),
        message: 'Completed',
        result: { totalDocsSaved, scriptsFound, scriptsSaved },
        progress: {
          pagesProcessed: crawledDocs.length,
          totalPages: maxPages,
          scriptsFound,
          scriptsSaved,
        },
      });
    } catch (error: any) {
      if (isCanceled()) {
        docCrawlJobService.updateJob(jobId, {
          status: 'canceled',
          finishedAt: new Date().toISOString(),
          message: 'Canceled',
        });
        return;
      }
      console.error('Error in AI crawl job:', error);
      docCrawlJobService.updateJob(jobId, {
        status: 'error',
        finishedAt: new Date().toISOString(),
        message: 'Failed',
        error: error?.message || String(error),
      });
    }
  }

  /**
   * AI-powered crawl that extracts content, generates titles/summaries,
   * finds scripts, and analyzes them
   */
  async crawlWithAI(req: Request, res: Response) {
    try {
      // Crawls can run for several minutes; avoid socket timeouts mid-request.
      // server.timeout is already relaxed in development, but keep this defensive per-route.
      req.setTimeout?.(10 * 60 * 1000);
      res.setTimeout?.(10 * 60 * 1000);

      const { url, maxPages = 10, depth = 1 } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      const crawledDocs: any[] = [];
      const visitedUrls = new Set<string>();

      // Helper to fetch and parse a URL
      const fetchPage = async (pageUrl: string): Promise<{ html: string; status: number } | null> => {
        try {
          const response = await axios.get(pageUrl, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PSScriptCrawler/1.0; +https://psscript.app)'
            }
          });
          return { html: response.data, status: response.status };
        } catch (error) {
          console.error(`Failed to fetch ${pageUrl}:`, error);
          return null;
        }
      };

      // Helper to extract PowerShell scripts from HTML
      const extractScripts = (html: string): string[] => {
        const $ = cheerio.load(html);
        const scripts: string[] = [];

        // Look for code blocks with PowerShell content
        $('pre code, code, .code-block, .powershell, [class*="language-powershell"], [class*="lang-ps"]').each((_, elem) => {
          const code = $(elem).text().trim();
          // Check if it looks like PowerShell (contains common cmdlets or PS syntax)
          if (code && (
            code.includes('Get-') ||
            code.includes('Set-') ||
            code.includes('New-') ||
            code.includes('Remove-') ||
            code.includes('$') ||
            code.includes('param(') ||
            code.includes('function ') ||
            code.includes('Write-Host') ||
            code.includes('Write-Output') ||
            code.includes('ForEach-Object') ||
            code.includes('Where-Object') ||
            code.match(/\|\s*(Select|Where|ForEach|Sort|Group)/)
          )) {
            if (code.length > 20 && code.length < 10000) {
              scripts.push(code);
            }
          }
        });

        return scripts;
      };

      // Helper to use AI for title and summary generation
      const generateAITitleAndSummary = async (content: string, pageUrl: string, scripts: string[] = []): Promise<{ title: string; summary: string; category: string; aiInsights: string[]; codeExample: string }> => {
        try {
          // Build script examples section for the prompt
          const scriptExamples = scripts.slice(0, 2).map((script, i) => {
            // Get a meaningful snippet of each script (first 300 chars or up to a logical break)
            const snippet = script.length > 300
              ? script.substring(0, script.indexOf('\n', 250) > 0 ? script.indexOf('\n', 250) : 300) + '...'
              : script;
            return `Script ${i + 1}:\n\`\`\`powershell\n${snippet}\n\`\`\``;
          }).join('\n\n');

          // Use AI to analyze the content with enhanced prompt
          const prompt = `Analyze this PowerShell documentation and create a comprehensive summary card.

**Generate:**
1. **title** (max 60 chars): Clear, descriptive title for the content
2. **summary** (max 150 chars): One-line overview of what this covers
3. **aiInsights** (array of 3-4 strings): Key learning points as bullet items, each 50-80 chars. Focus on:
   - Main cmdlets or functions covered
   - Key use cases or scenarios
   - Important parameters or options
   - Best practices mentioned
4. **codeExample** (max 100 chars): One short PowerShell example from the page, or empty if none
5. **category**: One of: Process Management, File System, Service Management, Network, Security, Module Management, Data Conversion, Pipeline, Output, Web Requests, Active Directory, Azure, AWS, General

**Page Content:**
${content.substring(0, 2500)}

${scripts.length > 0 ? `**PowerShell Code Found:**\n${scriptExamples}` : ''}

**Respond ONLY with valid JSON:**
{
  "title": "Getting Started with Get-Process",
  "summary": "Learn to monitor and manage Windows processes using PowerShell cmdlets.",
  "aiInsights": [
    "Use Get-Process to list all running processes",
    "Filter by name with -Name parameter",
    "Pipe to Stop-Process for termination",
    "Check CPU usage with CPU property"
  ],
  "codeExample": "Get-Process | Where-Object {$_.CPU -gt 100}",
  "category": "Process Management"
}`;

          // Call AI service chat endpoint directly
          const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
          const chatResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
            messages: [{ role: 'user', content: prompt }]
          }, { timeout: 30000 });

          if (chatResponse.data?.response) {
            try {
              // Clean up the response - remove quotes if wrapped
              let responseText = chatResponse.data.response;
              if (responseText.startsWith('"') && responseText.endsWith('"')) {
                responseText = responseText.slice(1, -1);
              }

              // Try to parse JSON from the response
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  title: parsed.title || 'Untitled Document',
                  summary: parsed.summary || '',
                  category: parsed.category || 'General',
                  aiInsights: Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [],
                  codeExample: parsed.codeExample || ''
                };
              }
            } catch (_parseError) {
              console.log('JSON parse failed, using text response');
              // If JSON parsing fails, extract from text
              return {
                title: content.substring(0, 60).replace(/\n/g, ' ').trim() || 'Untitled Document',
                summary: chatResponse.data.response.substring(0, 200),
                category: 'General',
                aiInsights: [],
                codeExample: ''
              };
            }
          }
        } catch (error) {
          console.error('AI title/summary generation failed:', (error as any)?.message || error);
        }

        // Fallback: Smart title extraction from URL and content
        const urlParts = pageUrl.split('/').filter(Boolean);
        let fallbackTitle = urlParts[urlParts.length - 1]?.replace(/-/g, ' ').replace(/_/g, ' ') || '';

        // Try to extract title from content (look for heading patterns)
        const headingMatch = content.match(/^#\s+(.+)|^(.+?)\n=+|<h1[^>]*>([^<]+)/m);
        if (headingMatch) {
          fallbackTitle = (headingMatch[1] || headingMatch[2] || headingMatch[3]).trim();
        }

        // Clean up title
        fallbackTitle = fallbackTitle
          .replace(/\s+/g, ' ')
          .replace(/[|•·]/g, ' - ')
          .trim()
          .substring(0, 60);

        if (!fallbackTitle || fallbackTitle.length < 3) {
          fallbackTitle = 'Documentation Page';
        }

        // Title case the fallback
        fallbackTitle = fallbackTitle
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        // Try to detect category from content keywords
        let category = 'General';
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('get-process') || lowerContent.includes('process management')) category = 'Process Management';
        else if (lowerContent.includes('file system') || lowerContent.includes('get-childitem')) category = 'File System';
        else if (lowerContent.includes('service') || lowerContent.includes('get-service')) category = 'Service Management';
        else if (lowerContent.includes('network') || lowerContent.includes('test-connection')) category = 'Network';
        else if (lowerContent.includes('security') || lowerContent.includes('execution policy')) category = 'Security';
        else if (lowerContent.includes('module') || lowerContent.includes('import-module')) category = 'Module Management';
        else if (lowerContent.includes('json') || lowerContent.includes('convert')) category = 'Data Conversion';
        else if (lowerContent.includes('pipeline') || lowerContent.includes('foreach-object')) category = 'Pipeline';

        // Generate smart summary from first meaningful paragraph
        let summary = content
          .replace(/Table of contents.*?Focus mode/gi, '')
          .replace(/Exit editor mode.*?Ask Learn/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 250);

        // Try to get first complete sentence
        const sentenceEnd = summary.search(/[.!?]\s/);
        if (sentenceEnd > 50) {
          summary = summary.substring(0, sentenceEnd + 1);
        }

        return {
          title: fallbackTitle,
          summary: summary || 'PowerShell documentation page.',
          category,
          aiInsights: [],
          codeExample: ''
        };
      };

      // Helper to analyze extracted scripts with AI
      const analyzeScripts = async (scripts: string[]): Promise<{ name: string; description: string; code: string }[]> => {
        const analyzedScripts: { name: string; description: string; code: string }[] = [];

        for (const script of scripts.slice(0, 5)) { // Limit to 5 scripts per page
          try {
            const analysisResult = await aiService.analyzeScript(script, undefined, 'quick');

            if (analysisResult?.analysis) {
              // Generate a name based on purpose
              let name = 'PowerShell Script';
              const purpose = analysisResult.analysis.purpose || '';

              if (purpose.toLowerCase().includes('process')) name = 'Process Manager Script';
              else if (purpose.toLowerCase().includes('file')) name = 'File Operations Script';
              else if (purpose.toLowerCase().includes('service')) name = 'Service Manager Script';
              else if (purpose.toLowerCase().includes('network')) name = 'Network Utility Script';
              else if (purpose.toLowerCase().includes('user')) name = 'User Management Script';
              else if (purpose.toLowerCase().includes('security')) name = 'Security Script';
              else if (script.includes('function ')) {
                const funcMatch = script.match(/function\s+(\w+)/);
                if (funcMatch) name = `${funcMatch[1]} Function`;
              }

              analyzedScripts.push({
                name,
                description: purpose,
                code: script
              });
            }
          } catch (error) {
            console.error('Script analysis failed:', error);
            analyzedScripts.push({
              name: 'PowerShell Script',
              description: 'Script extracted from documentation',
              code: script
            });
          }
        }

        return analyzedScripts;
      };

      // Crawl the initial URL
      const crawlPage = async (pageUrl: string, currentDepth: number) => {
        if (visitedUrls.has(pageUrl) || crawledDocs.length >= maxPages) return;
        visitedUrls.add(pageUrl);

        console.log(`Crawling: ${pageUrl}`);
        const pageData = await fetchPage(pageUrl);
        if (!pageData) return;

        const $ = cheerio.load(pageData.html);

        // Extract text content
        $('script, style, nav, footer, header').remove();
        const textContent = $('article, main, .content, .documentation, body').first().text()
          .replace(/\s+/g, ' ')
          .trim();

        // Skip if too little content
        if (textContent.length < 100) return;

        // Extract scripts FIRST so we can include them in the summary
        const extractedScripts = extractScripts(pageData.html);

        // Generate AI title and summary - now passes scripts for better summaries with examples
        const { title, summary, category, aiInsights, codeExample } = await generateAITitleAndSummary(textContent, pageUrl, extractedScripts);
        const analyzedScripts = extractedScripts.length > 0
          ? await analyzeScripts(extractedScripts)
          : [];

        // Extract commands mentioned in the content
        const commandPattern = /\b(Get|Set|New|Remove|Start|Stop|Add|Clear|Copy|Move|Rename|Test|Import|Export|Invoke|Register|Unregister|Update|Write|Read)-[A-Z][a-zA-Z]+\b/g;
        const extractedCommands = [...new Set(textContent.match(commandPattern) || [])];

        // Extract module names
        const modulePattern = /\b(Microsoft\.[A-Z][a-zA-Z.]+|PSReadLine|Pester|PSScriptAnalyzer|Az\.[A-Z][a-zA-Z]+)\b/g;
        const extractedModules = [...new Set(textContent.match(modulePattern) || [])];

        // Determine source from URL
        let source = 'Web';
        if (pageUrl.includes('microsoft.com')) source = 'Microsoft Learn';
        else if (pageUrl.includes('github.com')) source = 'GitHub';
        else if (pageUrl.includes('powershellgallery.com')) source = 'PowerShell Gallery';

        // Generate tags based on content
        const tags: string[] = [];
        if (extractedCommands.length > 0) tags.push('cmdlet');
        if (textContent.toLowerCase().includes('module')) tags.push('module');
        if (textContent.toLowerCase().includes('function')) tags.push('function');
        if (textContent.toLowerCase().includes('tutorial')) tags.push('tutorial');
        if (textContent.toLowerCase().includes('script')) tags.push('script');
        if (analyzedScripts.length > 0) tags.push('has-scripts');

        // Save extracted scripts to Script table
        const savedScriptIds: number[] = [];
        for (const analyzedScript of analyzedScripts) {
          try {
            // Generate file hash for deduplication
            const fileHash = crypto.createHash('md5').update(analyzedScript.code).digest('hex');

            // Check if script with same hash already exists
            const existingScript = await Script.findOne({ where: { fileHash } });
            if (existingScript) {
              savedScriptIds.push(existingScript.id);
              console.log(`Script already exists with hash ${fileHash}, skipping`);
              continue;
            }

            // Create new script
            const newScript = await Script.create({
              title: analyzedScript.name.substring(0, 100),
              description: `${analyzedScript.description}\n\nSource: ${pageUrl}`,
              content: analyzedScript.code,
              userId: 1, // Default system user
              isPublic: true,
              version: 1,
              executionCount: 0,
              fileHash
            });
            savedScriptIds.push(newScript.id);
            console.log(`Saved script: ${analyzedScript.name} with ID ${newScript.id}`);
          } catch (scriptError) {
            console.error(`Error saving script ${analyzedScript.name}:`, scriptError);
          }
        }

        // Create document entry - now includes full script code in metadata
        const docEntry = {
          title,
          url: pageUrl,
          content: textContent.substring(0, 10000),
          summary,
          source,
          contentType: extractedScripts.length > 0 ? 'example' : 'article',
          category,
          tags: [...new Set(tags)],
          extractedCommands,
          extractedFunctions: analyzedScripts.map(s => s.name),
          extractedModules,
          metadata: {
            scriptsFound: analyzedScripts.length,
            scripts: analyzedScripts.map(s => ({
              name: s.name,
              description: s.description,
              code: s.code  // Now includes the actual script code!
            })),
            savedScriptIds,  // Reference to saved Script records
            crawledDepth: currentDepth,
            // AI-generated insights for card display
            aiInsights: aiInsights,  // Array of key learning points
            codeExample: codeExample  // Short code snippet
          },
          crawledAt: new Date().toISOString()
        };

        crawledDocs.push(docEntry);

        // If we should go deeper, find links to other pages
        if (currentDepth < depth && crawledDocs.length < maxPages) {
          const links: string[] = [];
          $('a[href]').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              try {
                const fullUrl = new URL(href, pageUrl).href;
                // Only follow links from the same domain
                const baseUrl = new URL(pageUrl);
                const linkUrl = new URL(fullUrl);
                if (linkUrl.hostname === baseUrl.hostname && !visitedUrls.has(fullUrl)) {
                  links.push(fullUrl);
                }
              } catch {
                // Invalid URL, skip
              }
            }
          });

          // Crawl linked pages (limit to a few per page)
          for (const link of links.slice(0, 3)) {
            if (crawledDocs.length >= maxPages) break;
            await crawlPage(link, currentDepth + 1);
          }
        }
      };

      // Start crawling
      await crawlPage(url, 0);

      // Save all crawled docs to database
      const savedDocs: any[] = [];
      for (const doc of crawledDocs) {
        try {
          const [savedDoc, created] = await Documentation.upsertDoc({
            ...doc,
            crawledAt: new Date()
          });
          savedDocs.push({ doc: savedDoc, created });
        } catch (err) {
          console.error(`Error saving doc ${doc.url}:`, err);
        }
      }

      // Count total scripts saved
      const totalScriptsSaved = crawledDocs.reduce((sum, d) => sum + (d.metadata?.savedScriptIds?.length || 0), 0);
      const totalScriptsFound = crawledDocs.reduce((sum, d) => sum + (d.metadata?.scriptsFound || 0), 0);

      res.json({
        success: true,
        data: savedDocs,
        total: savedDocs.length,
        scriptsSaved: totalScriptsSaved,
        scriptsFound: totalScriptsFound,
        message: `AI-powered crawl complete: ${savedDocs.length} documents saved, ${totalScriptsSaved} scripts saved to library (${totalScriptsFound} found)`
      });
    } catch (error) {
      console.error('Error in AI crawl:', error);
      res.status(500).json({
        success: false,
        error: 'AI-powered crawl failed'
      });
    }
  }
}

export const documentationController = new DocumentationController();
