# Crawl4AI Vector Database

A vector database integration for [crawl4ai](https://github.com/unclecode/crawl4ai) that enables semantic search and chat capabilities over crawled web content.

## Features

- **Web Crawling**: Crawl websites and store content in a PostgreSQL database with pgvector
- **Deep Crawling**: Recursively crawl websites using BFS, DFS, or BestFirst strategies
- **Browser Profiles**: Create and manage persistent browser profiles for authenticated crawling
- **Vector Embeddings**: Generate embeddings for web content using OpenAI or HuggingFace models
- **Semantic Search**: Search for content using vector similarity
- **Chat Interface**: Chat with the vector database using OpenAI's language models
- **REST API**: Access all functionality through a REST API
- **CLI Tools**: Command-line tools for crawling, searching, and chatting

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key or HuggingFace API key

## Installation

### Option 1: Local Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/crawl4ai-vector-db.git
cd crawl4ai-vector-db
```

2. Install dependencies:

```bash
npm install
```

3. Run the all-in-one setup script:

```bash
npm run setup-all
```

This will:
- Make all scripts executable
- Configure your environment
- Initialize the database

4. Run the deep crawl migration:

```bash
./bin/run-deep-crawl-migration.sh
```

5. Start the server:

```bash
# Production mode
npm run start-prod

# Development mode with hot reloading
npm run start-dev
```

Alternatively, you can run the setup steps individually:

```bash
# Make scripts executable
npm run make-executable
npm run make-shell-executable

# Configure your environment
npm run setup

# Initialize the database
npm run init-db
```

### Option 2: Docker Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/crawl4ai-vector-db.git
cd crawl4ai-vector-db
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Edit the `.env` file and set your API keys:

```
OPENAI_API_KEY=your-openai-api-key
# Or use HuggingFace
# EMBEDDING_PROVIDER=huggingface
# HUGGINGFACE_API_KEY=your-huggingface-api-key
```

4. Start the application with Docker Compose:

```bash
# Production mode
npm run docker-start

# Development mode with hot reloading
npm run docker-dev
```

This will start both the application and a PostgreSQL database with pgvector extension installed. The development mode mounts your local files into the container for hot reloading.

## CLI Usage

### Crawl a website

```bash
# Crawl a single URL
npm run crawl url https://example.com

# Crawl with deep crawling enabled
npm run crawl url https://example.com --deep --strategy bfs --max-pages 20

# Use a browser profile for authenticated crawling
npm run crawl url https://example.com --profile my-profile

# Crawl multiple URLs from a file
npm run crawl file urls.txt

# Crawl a website recursively (deep crawling)
npm run crawl site https://example.com --strategy bfs --max-pages 50
```

### Manage browser profiles

```bash
# Create a new browser profile
npm run crawl profile create my-profile

# List all browser profiles
npm run crawl profile list

# Delete a browser profile
npm run crawl profile delete my-profile
```

### Search the vector database

```bash
# Search for content similar to a query
npm run search query "What is vector search?"

# Search with keyword filtering
npm run search keywords "vector database" "postgresql pgvector"
```

### Chat with the vector database

```bash
# Start a new chat session
npm run chat start

# List all conversations
npm run chat list

# View a conversation
npm run chat view <conversation-id>

# Delete a conversation
npm run chat delete <conversation-id>
```

## API Endpoints

### Webpages

- `GET /api/webpages`: Get all webpages
- `GET /api/webpages/:id`: Get a webpage by ID
- `POST /api/webpages`: Crawl and store a new webpage
- `PUT /api/webpages/:id/recrawl`: Recrawl and update a webpage
- `DELETE /api/webpages/:id`: Delete a webpage
- `POST /api/webpages/batch`: Crawl and store multiple webpages
- `GET /api/webpages/:id/children`: Get child pages of a webpage (for deep crawling)

### Search

- `POST /api/search`: Search for content similar to a query
- `POST /api/search/keywords`: Search for content with keyword filtering
- `GET /api/search/related/:chunkId`: Get related content chunks

### Chat

- `POST /api/chat/conversations`: Create a new conversation
- `GET /api/chat/conversations`: Get all conversations
- `GET /api/chat/conversations/:id`: Get a conversation by ID with messages
- `DELETE /api/chat/conversations/:id`: Delete a conversation
- `POST /api/chat/conversations/:id/messages`: Send a message in a conversation
- `GET /api/chat/messages/:id/citations`: Get citations for a message

## Architecture

The project is structured as follows:

- `src/models`: Database models using Sequelize
- `src/services`: Business logic services
- `src/routes`: API routes
- `src/cli`: Command-line tools
- `src/config`: Configuration files
- `src/db/migrations`: Database migration files

## Development

To start the server in development mode with hot reloading:

```bash
npm run start-dev
```

This script will:
1. Check if the `.env` file exists and create it if needed
2. Verify that the API keys are set
3. Start the server with nodemon for hot reloading

## Recent Improvements

- Added support for crawl4ai v0.5.0 features
- Implemented deep crawling with BFS, DFS, and BestFirst strategies
- Added browser profile management for authenticated crawling
- Improved chunking strategies for better semantic search
- Added support for HuggingFace embedding models
- Enhanced CLI interface with more options and better error handling

## License

MIT
