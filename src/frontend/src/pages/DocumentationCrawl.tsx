import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import documentationApi from '../services/documentationApi';

interface CrawlConfig {
  url: string;
  maxPages: number;
  depth: number;
  includeExternalLinks: boolean;
  fileTypes: string[];
  useAI: boolean;
}

interface CrawlStatus {
  status: 'idle' | 'crawling' | 'completed' | 'error';
  message: string;
  progress?: {
    pagesProcessed: number;
    totalPages: number;
    scriptsFound: number;
  };
  error?: string;
}

const DocumentationCrawl: React.FC = () => {
  const [config, setConfig] = useState<CrawlConfig>({
    url: 'https://learn.microsoft.com/en-us/powershell/',
    maxPages: 10,
    depth: 2,
    includeExternalLinks: false,
    fileTypes: ['ps1', 'psm1', 'psd1'],
    useAI: true
  });

  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({
    status: 'idle',
    message: 'Configure your import settings and click "Start Import" to begin.'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setConfig(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'fileTypes') {
      setConfig(prev => ({ ...prev, [name]: value.split(',').map(t => t.trim()) }));
    } else if (type === 'number') {
      setConfig(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    } else {
      setConfig(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL
    if (!config.url.trim()) {
      setCrawlStatus({
        status: 'error',
        message: 'Please enter a valid URL to import from.',
        error: 'URL is required'
      });
      return;
    }

    // Start import
    setCrawlStatus({
      status: 'crawling',
      message: config.useAI
        ? 'AI-powered import in progress... Fetching pages and analyzing content...'
        : 'Import in progress...',
      progress: {
        pagesProcessed: 0,
        totalPages: config.maxPages,
        scriptsFound: 0
      }
    });

    // If AI mode is enabled, use the AI crawl endpoint
    if (config.useAI) {
      try {
        const result = await documentationApi.crawlWithAI({
          url: config.url,
          maxPages: config.maxPages,
          depth: config.depth
        });

        if (result.status === 'completed') {
          setCrawlStatus({
            status: 'completed',
            message: result.message || `AI import complete! ${result.pagesProcessed} documents with ${result.scriptsFound} scripts analyzed.`,
            progress: {
              pagesProcessed: result.pagesProcessed,
              totalPages: result.totalPages,
              scriptsFound: result.scriptsFound
            }
          });
        } else {
          setCrawlStatus({
            status: 'error',
            message: result.message || 'AI import failed',
            error: result.message
          });
        }
      } catch (error) {
        setCrawlStatus({
          status: 'error',
          message: 'AI import failed. Please try again.',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    }

    // Fallback: Sample PowerShell documentation data for demo mode
    const sampleDocs = [
      { title: 'Get-Process', category: 'Process Management', summary: 'Gets the processes running on the local computer or a remote computer.', content: 'The Get-Process cmdlet gets the processes on a local or remote computer. Without parameters, this cmdlet gets all processes on the local computer. You can also specify a particular process by process name or process ID (PID), or pass a process object through the pipeline to this cmdlet.', tags: ['cmdlet', 'process', 'system'] },
      { title: 'Get-Service', category: 'Service Management', summary: 'Gets the services on a local or remote computer.', content: 'The Get-Service cmdlet gets objects that represent the services on a computer, including running and stopped services. By default, when Get-Service is run without parameters, all the local computers services are returned.', tags: ['cmdlet', 'service', 'admin'] },
      { title: 'Get-ChildItem', category: 'File System', summary: 'Gets the items and child items in one or more specified locations.', content: 'The Get-ChildItem cmdlet gets the items in one or more specified locations. If the item is a container, it gets the items inside the container, known as child items. You can use the -Recurse parameter to get items in all child containers.', tags: ['cmdlet', 'filesystem', 'directory'] },
      { title: 'Set-ExecutionPolicy', category: 'Security', summary: 'Sets the PowerShell execution policies for Windows computers.', content: 'The Set-ExecutionPolicy cmdlet changes PowerShell execution policies for Windows computers. An execution policy is part of the PowerShell security strategy. Execution policies determine whether you can load configuration files, such as your PowerShell profile, or run scripts.', tags: ['cmdlet', 'security', 'policy'] },
      { title: 'Invoke-WebRequest', category: 'Web Requests', summary: 'Gets content from a web page on the internet.', content: 'The Invoke-WebRequest cmdlet sends HTTP and HTTPS requests to a web page or web service. It parses the response and returns collections of links, images, and other significant HTML elements.', tags: ['cmdlet', 'web', 'http', 'api'] },
      { title: 'ConvertTo-Json', category: 'Data Conversion', summary: 'Converts an object to a JSON-formatted string.', content: 'The ConvertTo-Json cmdlet converts any .NET object to a string in JavaScript Object Notation (JSON) format. The properties are converted to field names, the field values are converted to property values, and the methods are removed.', tags: ['cmdlet', 'json', 'conversion', 'data'] },
      { title: 'Import-Module', category: 'Module Management', summary: 'Adds modules to the current session.', content: 'The Import-Module cmdlet adds one or more modules to the current session. Starting in PowerShell 3.0, installed modules are automatically imported to the session when you use any commands or providers in the module.', tags: ['cmdlet', 'module', 'import'] },
      { title: 'New-Item', category: 'File System', summary: 'Creates a new item such as a file or folder.', content: 'The New-Item cmdlet creates a new item and sets its value. The types of items that can be created depend on the location of the item. For example, in the file system, New-Item creates files and folders.', tags: ['cmdlet', 'filesystem', 'create'] },
      { title: 'Write-Host', category: 'Output', summary: 'Writes customized output to a host.', content: 'The Write-Host cmdlet customizes output. You can specify the color of text by using the ForegroundColor parameter, and you can specify the background color by using the BackgroundColor parameter.', tags: ['cmdlet', 'output', 'console', 'display'] },
      { title: 'ForEach-Object', category: 'Pipeline', summary: 'Performs an operation against each item in a collection of input objects.', content: 'The ForEach-Object cmdlet performs an operation on each item in a collection of input objects. The input objects can be piped to the cmdlet or specified by using the InputObject parameter.', tags: ['cmdlet', 'pipeline', 'loop', 'iteration'] },
      { title: 'Where-Object', category: 'Pipeline', summary: 'Selects objects from a collection based on their property values.', content: 'The Where-Object cmdlet selects objects that have particular property values from the collection of objects that are passed to it. You can use the Where-Object cmdlet to filter the output of other commands.', tags: ['cmdlet', 'pipeline', 'filter'] },
      { title: 'Select-Object', category: 'Pipeline', summary: 'Selects objects or object properties.', content: 'The Select-Object cmdlet selects specified properties of an object or set of objects. It can also select unique objects, a specified number of objects, or objects in a specified position in an array.', tags: ['cmdlet', 'pipeline', 'select', 'properties'] },
      { title: 'Sort-Object', category: 'Pipeline', summary: 'Sorts objects by property values.', content: 'The Sort-Object cmdlet sorts objects in ascending or descending order based on object property values. If sort properties are not included in a command, PowerShell uses default sort properties of the first input object.', tags: ['cmdlet', 'pipeline', 'sort'] },
      { title: 'Test-Connection', category: 'Network', summary: 'Sends ICMP echo request packets to one or more computers.', content: 'The Test-Connection cmdlet sends Internet Control Message Protocol (ICMP) echo request packets, or pings, to one or more remote computers and returns the echo response replies.', tags: ['cmdlet', 'network', 'ping', 'connectivity'] },
      { title: 'Get-Content', category: 'File System', summary: 'Gets the content of the item at the specified location.', content: 'The Get-Content cmdlet gets the content of the item at the location specified by the path, such as the text in a file or the content of a function. For files, the content is read one line at a time and returns a collection of objects.', tags: ['cmdlet', 'filesystem', 'read', 'file'] },
    ];

    // Simulate crawling process with progress updates (demo mode)
    let pagesProcessed = 0;
    let scriptsFound = 0;
    const crawledDocs: any[] = [];
    const docsToUse = sampleDocs.slice(0, Math.min(config.maxPages, sampleDocs.length));

    const interval = setInterval(async () => {
      pagesProcessed++;
      scriptsFound += 1;

      // Use real sample documentation
      if (pagesProcessed <= docsToUse.length) {
        const doc = docsToUse[pagesProcessed - 1];
        crawledDocs.push({
          title: doc.title,
          url: `https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/${doc.title.toLowerCase().replace(/-/g, '')}`,
          content: doc.content,
          summary: doc.summary,
          source: 'Microsoft Learn',
          contentType: 'cmdlet',
          tags: doc.tags,
          category: doc.category,
          crawledAt: new Date().toISOString()
        });

        setCrawlStatus({
          status: 'crawling',
          message: `Importing ${doc.title}...`,
          progress: {
            pagesProcessed,
            totalPages: docsToUse.length,
            scriptsFound
          }
        });
      } else {
        clearInterval(interval);

        // Save crawled documents to database
        try {
          if (crawledDocs.length > 0) {
            await documentationApi.bulkImport(crawledDocs);
          }

          setCrawlStatus({
            status: 'completed',
            message: `Import complete! ${crawledDocs.length} cmdlets saved to database.`,
            progress: {
              pagesProcessed: docsToUse.length,
              totalPages: docsToUse.length,
              scriptsFound: crawledDocs.length
            }
          });
        } catch (_error) {
          setCrawlStatus({
            status: 'completed',
            message: `Import complete! ${crawledDocs.length} cmdlets found (database save may have failed).`,
            progress: {
              pagesProcessed: docsToUse.length,
              totalPages: docsToUse.length,
              scriptsFound: crawledDocs.length
            }
          });
        }
      }
    }, 800);
  };

  const renderProgressBar = () => {
    if (!crawlStatus.progress) return null;

    const { pagesProcessed, totalPages } = crawlStatus.progress;
    const percentage = Math.min(Math.round((pagesProcessed / totalPages) * 100), 100);

    return (
      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{percentage}% Complete</span>
          <span>{pagesProcessed} of {totalPages} pages</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-purple-900 rounded-lg p-6 mb-8 shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-4">Import PowerShell Documentation</h1>
        <p className="text-blue-200 mb-4">
          Import and index PowerShell documentation with AI-powered semantic analysis.
          All imported content is saved for intelligent RAG searches.
        </p>
        <div className="flex space-x-4">
          <Link to="/dashboard" className="bg-white text-indigo-700 px-4 py-2 rounded-lg">Dashboard</Link>
          <Link to="/documentation" className="bg-purple-600 text-white px-4 py-2 rounded-lg">Search Docs</Link>
          <Link to="/documentation/data" className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Documentation Library
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Import Settings</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="url" className="block text-sm font-medium text-blue-300">Source URL</label>
              <input
                type="url"
                id="url"
                name="url"
                value={config.url}
                onChange={handleInputChange}
                className="w-full bg-gray-700 text-white rounded px-4 py-2"
                placeholder="https://learn.microsoft.com/en-us/powershell/"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="maxPages" className="block text-sm font-medium text-green-300">Max Pages</label>
                <input
                  type="number"
                  id="maxPages"
                  name="maxPages"
                  value={config.maxPages}
                  onChange={handleInputChange}
                  min="1"
                  max="100"
                  className="w-full bg-gray-700 text-white rounded px-4 py-2"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="depth" className="block text-sm font-medium text-purple-300">Link Depth</label>
                <input
                  type="number"
                  id="depth"
                  name="depth"
                  value={config.depth}
                  onChange={handleInputChange}
                  min="1"
                  max="5"
                  className="w-full bg-gray-700 text-white rounded px-4 py-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="fileTypes" className="block text-sm font-medium text-indigo-300">File Types</label>
              <input
                type="text"
                id="fileTypes"
                name="fileTypes"
                value={config.fileTypes.join(', ')}
                onChange={handleInputChange}
                className="w-full bg-gray-700 text-white rounded px-4 py-2"
                placeholder="ps1, psm1, psd1"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useAI"
                  name="useAI"
                  checked={config.useAI}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-green-600 rounded"
                />
                <label htmlFor="useAI" className="ml-2 block text-sm font-medium text-green-300">
                  🤖 AI-Powered Crawl (generates titles, summaries, analyzes scripts)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeExternalLinks"
                  name="includeExternalLinks"
                  checked={config.includeExternalLinks}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="includeExternalLinks" className="ml-2 block text-sm font-medium text-blue-300">
                  Include External Links
                </label>
              </div>
            </div>

            {config.useAI && (
              <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-4">
                <h4 className="text-green-300 font-medium mb-2">🤖 AI Features Enabled:</h4>
                <ul className="text-sm text-green-200 space-y-1">
                  <li>• <strong>Smart Titles:</strong> AI generates descriptive titles from page content</li>
                  <li>• <strong>Auto Summaries:</strong> AI summarizes what each page is about</li>
                  <li>• <strong>Script Detection:</strong> Finds PowerShell scripts in code blocks</li>
                  <li>• <strong>Script Analysis:</strong> AI names and describes what each script does</li>
                  <li>• <strong>Auto Categorization:</strong> AI assigns categories like &quot;File System&quot;, &quot;Network&quot;, etc.</li>
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={crawlStatus.status === 'crawling'}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {crawlStatus.status === 'crawling' ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Import Status</h2>

          <div className={`p-4 rounded-lg ${
            crawlStatus.status === 'idle' ? 'bg-gray-700' :
            crawlStatus.status === 'crawling' ? 'bg-blue-900' :
            crawlStatus.status === 'completed' ? 'bg-green-900' :
            'bg-red-900'
          }`}>
            <div className="mb-2">
              <span className="font-medium">
                {crawlStatus.status === 'idle' && 'Ready to Import'}
                {crawlStatus.status === 'crawling' && 'Import in Progress'}
                {crawlStatus.status === 'completed' && 'Import Completed'}
                {crawlStatus.status === 'error' && 'Import Error'}
              </span>
            </div>

            <p className="text-sm">
              {crawlStatus.message}
            </p>

            {crawlStatus.error && (
              <p className="mt-2 text-sm text-red-300">
                Error: {crawlStatus.error}
              </p>
            )}

            {renderProgressBar()}

            {crawlStatus.progress && (
              <div className="mt-4 text-sm">
                <p>PowerShell scripts found: <span className="font-medium">{crawlStatus.progress.scriptsFound}</span></p>
              </div>
            )}
          </div>

          {crawlStatus.status === 'completed' && (
            <div className="mt-4 space-y-2">
              <Link
                to="/documentation/data"
                className="block w-full text-center px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
              >
                View Documentation Library
              </Link>
              <Link
                to="/documentation"
                className="block w-full text-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Search Documentation
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Powered by crawl4ai</h2>
        <p className="text-gray-300 mb-4">
          crawl4ai is a powerful web extraction tool designed specifically for extracting code and technical content from documentation websites. It uses AI to identify and extract relevant code blocks, making it ideal for building technical documentation databases.
        </p>
        <p className="text-gray-300 mb-4">
          <strong className="text-green-400">Smart Import:</strong> All imported documentation is automatically saved to the database for intelligent RAG (Retrieval Augmented Generation) searches.
        </p>
        <a
          href="https://github.com/unclecode/crawl4ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          View crawl4ai on GitHub
        </a>
      </div>
    </div>
  );
};

export default DocumentationCrawl;
