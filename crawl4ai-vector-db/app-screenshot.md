# Crawl4AI Vector Database - Application Interface

## Main Dashboard

```
+------------------------------------------------------+
|                 Crawl4AI Vector Database             |
+------------------------------------------------------+
| [Crawl] [Search] [Chat] [Settings]                   |
+------------------------------------------------------+
|                                                      |
|  Welcome to Crawl4AI Vector Database                 |
|                                                      |
|  This application allows you to:                     |
|                                                      |
|  - Crawl websites and store content in a vector DB   |
|  - Search for content using semantic similarity      |
|  - Chat with your data using AI                      |
|                                                      |
|  Get started by clicking on one of the options above |
|                                                      |
+------------------------------------------------------+
|  Status: Connected to Database | OpenAI API: Active  |
+------------------------------------------------------+
```

## Crawl Interface

```
+------------------------------------------------------+
|                 Crawl4AI Vector Database             |
+------------------------------------------------------+
| [Crawl] [Search] [Chat] [Settings]                   |
+------------------------------------------------------+
|                                                      |
|  Crawl a Website                                     |
|                                                      |
|  URL: [https://example.com                      ]    |
|                                                      |
|  Depth: [2]  Max Pages: [100]                        |
|                                                      |
|  [ ] Follow external links                           |
|  [x] Extract text content                            |
|  [x] Generate embeddings                             |
|                                                      |
|  [Start Crawling]                                    |
|                                                      |
+------------------------------------------------------+
|  Status: Ready to crawl                              |
+------------------------------------------------------+
```

## Search Interface

```
+------------------------------------------------------+
|                 Crawl4AI Vector Database             |
+------------------------------------------------------+
| [Crawl] [Search] [Chat] [Settings]                   |
+------------------------------------------------------+
|                                                      |
|  Search Content                                      |
|                                                      |
|  [What is vector search?                        ]    |
|                                                      |
|  [Search]                                            |
|                                                      |
|  Results:                                            |
|                                                      |
|  1. Vector Search Explained - example.com            |
|     Vector search is a technique that allows you to  |
|     find similar items based on their vector...      |
|                                                      |
|  2. Introduction to Embeddings - example.com         |
|     Embeddings are vector representations of data... |
|                                                      |
|  3. Semantic Search with pgvector - example.com      |
|     PostgreSQL's pgvector extension enables...       |
|                                                      |
+------------------------------------------------------+
|  Status: 3 results found                             |
+------------------------------------------------------+
```

## Chat Interface

```
+------------------------------------------------------+
|                 Crawl4AI Vector Database             |
+------------------------------------------------------+
| [Crawl] [Search] [Chat] [Settings]                   |
+------------------------------------------------------+
|                                                      |
|  Chat with Your Data                                 |
|                                                      |
|  +--------------------------------------------------+|
|  | You: How does vector search work?               ||
|  |                                                 ||
|  | AI: Vector search works by converting text into ||
|  | numerical vectors using embedding models. These ||
|  | vectors capture semantic meaning, allowing      ||
|  | similar concepts to have similar vector         ||
|  | representations.                                ||
|  |                                                 ||
|  | When you search, your query is also converted   ||
|  | to a vector, and the system finds content with  ||
|  | vectors most similar to your query vector.      ||
|  |                                                 ||
|  | Source: example.com/vector-search-explained     ||
|  |                                                 ||
|  +--------------------------------------------------+|
|                                                      |
|  [Ask a question...                            ]     |
|                                                      |
+------------------------------------------------------+
|  Status: Chat active                                 |
+------------------------------------------------------+
```

## Settings Interface

```
+------------------------------------------------------+
|                 Crawl4AI Vector Database             |
+------------------------------------------------------+
| [Crawl] [Search] [Chat] [Settings]                   |
+------------------------------------------------------+
|                                                      |
|  Settings                                            |
|                                                      |
|  Database Configuration:                             |
|  Host: [localhost                               ]    |
|  Port: [5432      ]                                  |
|  Name: [crawl4ai_vector                         ]    |
|  User: [postgres  ]                                  |
|  Password: [********                            ]    |
|                                                      |
|  OpenAI Configuration:                               |
|  API Key: [sk-***********************************]   |
|  Embedding Model: [text-embedding-ada-002       ]    |
|  LLM Model: [gpt-4                              ]    |
|                                                      |
|  [Save Settings]                                     |
|                                                      |
+------------------------------------------------------+
|  Status: Settings loaded                             |
+------------------------------------------------------+
