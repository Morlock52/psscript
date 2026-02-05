import { Request, Response } from 'express';
import { Documentation } from '../models';
import Script from '../models/Script';
import { searchPowerShellDocs as _searchPowerShellDocs } from '../services/agentic/tools/PowerShellDocsSearch';
import axios from 'axios';
import aiService from '../utils/aiService';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

type AICrawlJobStatus = 'queued' | 'running' | 'completed' | 'error';

type AICrawlProgress = {
  pagesProcessed: number;
  totalPages: number;
  scriptsFound: number;
  scriptsSaved: number;
  currentUrl?: string;
  stage?: string;
};

type AICrawlJob = {
  id: string;
  status: AICrawlJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  request: {
    url: string;
    maxPages: number;
    depth: number;
  };
  progress: AICrawlProgress;
  result?: {
    data: any[];
    total: number;
    scriptsSaved: number;
    scriptsFound: number;
    message: string;
  };
  error?: string;
};

const aiCrawlJobs = new Map<string, AICrawlJob>();
const AI_CRAWL_JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

const cleanupAICrawlJobs = () => {
  const now = Date.now();
  for (const [id, job] of aiCrawlJobs.entries()) {
    const createdAt = Date.parse(job.createdAt);
    if (!Number.isNaN(createdAt) && now - createdAt > AI_CRAWL_JOB_TTL_MS) {
      aiCrawlJobs.delete(id);
    }
  }
};

const cleanupTimer = setInterval(cleanupAICrawlJobs, 10 * 60 * 1000);
cleanupTimer.unref?.();

/**
 * Documentation Controller
 *
 * Handles CRUD operations and search for PowerShell documentation.
 * Supports crawling from external sources and storing locally.
 */
export class DocumentationController {
  constructor() {
    // Express route handlers are passed as bare function references.
    // Bind `this` so helpers (like performAICrawl) are available.
    this.crawlWithAI = this.crawlWithAI.bind(this);
    this.startAICrawlJob = this.startAICrawlJob.bind(this);
    this.getAICrawlJobStatus = this.getAICrawlJobStatus.bind(this);
  }

  private async performAICrawl(opts: {
    url: string;
    maxPages: number;
    depth: number;
    onProgress?: (update: Partial<AICrawlProgress> & { message?: string }) => void;
  }) {
    const { url, maxPages, depth, onProgress } = opts;

    const crawledDocs: any[] = [];
    const visitedUrls = new Set<string>();
    let scriptsFoundSoFar = 0;
    let scriptsSavedSoFar = 0;

    const reportProgress = (update: Partial<AICrawlProgress> & { message?: string }) => {
      onProgress?.({
        totalPages: maxPages,
        ...update
      });
    };

    const timeoutAfter = (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      });

    const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
      return (await Promise.race([promise, timeoutAfter(ms)])) as T;
    };

    // Helper to fetch and parse a URL
    const fetchPage = async (pageUrl: string): Promise<{ html: string; status: number } | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await withTimeout(
          axios.get(pageUrl, {
            timeout: 15_000,
            signal: controller.signal,
            // Prefer IPv4 to avoid environments where IPv6 connect attempts hang.
            family: 4,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PSScriptCrawler/1.0; +https://psscript.app)'
            }
          }),
          20_000
        );
        return { html: response.data, status: response.status };
      } catch (error) {
        console.error(`Failed to fetch ${pageUrl}:`, error);
        return null;
      } finally {
        clearTimeout(timer);
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

    // Helper to generate title/summary/category (deterministic + fast)
    const generateAITitleAndSummary = async (
      content: string,
      pageUrl: string,
      _scripts: string[] = []
    ): Promise<{ title: string; summary: string; category: string; aiInsights: string[]; codeExample: string }> => {
      // Smart title extraction from URL and content
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
          const analysisResult = await withTimeout(aiService.analyzeScript(script, undefined, 'quick'), 60_000);

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

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'fetch',
        message: `Crawling: ${pageUrl}`
      });

      console.log(`Crawling: ${pageUrl}`);
      const pageData = await fetchPage(pageUrl);
      if (!pageData) return;

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'extract'
      });

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

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'summarize'
      });

      // Generate AI title and summary - now passes scripts for better summaries with examples
      const { title, summary, category, aiInsights, codeExample } = await generateAITitleAndSummary(textContent, pageUrl, extractedScripts);

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: extractedScripts.length > 0 ? 'analyze_scripts_start' : 'no_scripts'
      });

      const analyzedScripts = extractedScripts.length > 0
        ? await analyzeScripts(extractedScripts)
        : [];

      scriptsFoundSoFar += analyzedScripts.length;

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: analyzedScripts.length > 0 ? 'analyze_scripts' : 'scripts_none'
      });

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

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'save_scripts'
      });

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

      scriptsSavedSoFar += savedScriptIds.length;

      reportProgress({
        currentUrl: pageUrl,
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'doc_entry'
      });

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

      reportProgress({
        pagesProcessed: crawledDocs.length,
        scriptsFound: scriptsFoundSoFar,
        scriptsSaved: scriptsSavedSoFar,
        stage: 'page_done'
      });

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

    reportProgress({
      stage: 'db_upsert',
      message: 'Saving crawled documents to database...'
    });

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

    return {
      data: savedDocs,
      total: savedDocs.length,
      scriptsSaved: totalScriptsSaved,
      scriptsFound: totalScriptsFound,
      message: `AI-powered crawl complete: ${savedDocs.length} documents saved, ${totalScriptsSaved} scripts saved to library (${totalScriptsFound} found)`
    };
  }

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
          lastCrawled: await Documentation.max('crawledAt')
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
   * AI-powered crawl that extracts content, generates titles/summaries,
   * finds scripts, and analyzes them
   */
  async crawlWithAI(req: Request, res: Response) {
    try {
      const { url, maxPages = 10, depth = 1 } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }
      const result = await this.performAICrawl({
        url,
        maxPages,
        depth
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error in AI crawl:', error);
      res.status(500).json({
        success: false,
        error: 'AI-powered crawl failed'
      });
    }
  }

  /**
   * Starts an AI crawl job asynchronously and returns a jobId immediately.
   * The UI can poll /api/documentation/crawl/ai/status/:jobId for progress/results.
   */
  async startAICrawlJob(req: Request, res: Response) {
    try {
      const { url, maxPages = 10, depth = 1 } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      const jobId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const job: AICrawlJob = {
        id: jobId,
        status: 'queued',
        createdAt,
        request: {
          url,
          maxPages,
          depth
        },
        progress: {
          pagesProcessed: 0,
          totalPages: maxPages,
          scriptsFound: 0,
          scriptsSaved: 0,
          stage: 'queued'
        }
      };

      aiCrawlJobs.set(jobId, job);

      // Run in background (best-effort for development). If the backend restarts, jobs are lost.
      setImmediate(async () => {
        const runningJob = aiCrawlJobs.get(jobId);
        if (!runningJob) return;

        runningJob.status = 'running';
        runningJob.startedAt = new Date().toISOString();

        try {
          const result = await this.performAICrawl({
            url,
            maxPages,
            depth,
            onProgress: (update) => {
              const j = aiCrawlJobs.get(jobId);
              if (!j) return;
              if (typeof update.pagesProcessed === 'number') j.progress.pagesProcessed = update.pagesProcessed;
              if (typeof update.totalPages === 'number') j.progress.totalPages = update.totalPages;
              if (typeof update.scriptsFound === 'number') j.progress.scriptsFound = update.scriptsFound;
              if (typeof update.scriptsSaved === 'number') j.progress.scriptsSaved = update.scriptsSaved;
              if (typeof update.currentUrl === 'string') j.progress.currentUrl = update.currentUrl;
              if (typeof update.stage === 'string') j.progress.stage = update.stage;
              // message is currently only used client-side; store in result/message once completed.
            }
          });

          const completedJob = aiCrawlJobs.get(jobId);
          if (!completedJob) return;
          completedJob.status = 'completed';
          completedJob.finishedAt = new Date().toISOString();
          completedJob.result = result;
          // ensure progress matches final values
          completedJob.progress.pagesProcessed = result.total;
          completedJob.progress.totalPages = maxPages;
          completedJob.progress.scriptsFound = result.scriptsFound;
          completedJob.progress.scriptsSaved = result.scriptsSaved;
        } catch (err) {
          const failedJob = aiCrawlJobs.get(jobId);
          if (!failedJob) return;
          failedJob.status = 'error';
          failedJob.finishedAt = new Date().toISOString();
          failedJob.error = (err as any)?.message || 'AI crawl failed';
        }
      });

      return res.status(202).json({
        success: true,
        jobId
      });
    } catch (error) {
      console.error('Error starting AI crawl job:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to start AI crawl job'
      });
    }
  }

  /**
   * Get AI crawl job status (and result when completed).
   */
  async getAICrawlJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const job = aiCrawlJobs.get(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      return res.json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Error fetching AI crawl job status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch AI crawl job status'
      });
    }
  }
}

export const documentationController = new DocumentationController();
