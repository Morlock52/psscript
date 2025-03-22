# PowerShell Script Vector Database

This module provides a vector database for PowerShell scripts and documentation, enabling semantic search and AI-powered analysis.

## Features

- Store and index PowerShell scripts with vector embeddings
- Crawl and index PowerShell documentation from Microsoft Learn and other sources
- Perform semantic search across scripts and documentation
- Categorize scripts and documentation automatically
- Analyze scripts for quality, security, and best practices

## Getting Started

### Prerequisites

- Node.js 16+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key (for embeddings)

### Installation

1. Set up environment variables in `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/psscript
OPENAI_API_KEY=your_openai_api_key
```

2. Install dependencies:

```bash
npm install
```

3. Initialize the database:

```bash
npm run init-db
```

## Using crawl4ai for PowerShell Documentation

This project integrates with [crawl4ai](https://github.com/unclecode/crawl4ai) to crawl and index PowerShell documentation from various sources.

### Crawling PowerShell Documentation

Use the provided script to crawl PowerShell documentation:

```bash
./bin/crawl-powershell-docs.sh <url> [options]
```

For example, to crawl Microsoft Learn PowerShell documentation:

```bash
./bin/crawl-powershell-docs.sh https://learn.microsoft.com/en-us/powershell/ --depth=3 --max-pages=50
```

### Options

- `--depth=<number>`: Crawl depth (default: 2)
- `--max-pages=<number>`: Maximum pages to crawl (default: 10)
- `--external`: Include external links (default: false)
- `--file-types=<types>`: Comma-separated list of file types to extract (default: ps1,psm1,psd1)

### How It Works

1. The script uses crawl4ai to crawl the specified URL and extract content
2. Content is processed and stored in the database with vector embeddings
3. Tags are automatically extracted from the content
4. The indexed content is available for semantic search in the application

## API

### Search API

Search for PowerShell scripts and documentation:

```
GET /api/search?q=your search query&limit=10
```

Parameters:
- `q`: Search query
- `limit`: Maximum number of results (default: 10)
- `offset`: Pagination offset (default: 0)
- `sources`: Filter by sources (comma-separated)
- `tags`: Filter by tags (comma-separated)

### Documentation API

Get recent documentation:

```
GET /api/documentation/recent?limit=10
```

Search documentation:

```
GET /api/documentation/search?query=your search query&limit=10
```

Get available sources:

```
GET /api/documentation/sources
```

Get available tags:

```
GET /api/documentation/tags
```

## Integration with crawl4ai

The integration with crawl4ai provides several benefits:

1. **Intelligent Content Extraction**: crawl4ai uses AI to identify and extract relevant code blocks and documentation from web pages.

2. **Semantic Understanding**: The extracted content is processed with vector embeddings to enable semantic search.

3. **Automatic Tagging**: Tags are automatically extracted from the content to improve searchability.

4. **Incremental Updates**: The system can be configured to periodically crawl for new content and update the database.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
