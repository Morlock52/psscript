-- Create the documentation table expected by src/backend/src/models/Documentation.ts.
-- The app reads this table for documentation search, source/tag filters, and crawl imports.

CREATE TABLE IF NOT EXISTS documentation (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(2048) NOT NULL UNIQUE,
    content TEXT,
    summary TEXT,
    source VARCHAR(100) NOT NULL DEFAULT 'Microsoft Learn',
    content_type VARCHAR(50) NOT NULL DEFAULT 'article',
    category VARCHAR(100) DEFAULT 'General',
    tags JSONB DEFAULT '[]'::jsonb,
    extracted_commands JSONB DEFAULT '[]'::jsonb,
    extracted_functions JSONB DEFAULT '[]'::jsonb,
    extracted_modules JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    crawled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentation_url ON documentation(url);
CREATE INDEX IF NOT EXISTS idx_documentation_source ON documentation(source);
CREATE INDEX IF NOT EXISTS idx_documentation_content_type ON documentation(content_type);
CREATE INDEX IF NOT EXISTS idx_documentation_crawled_at ON documentation(crawled_at);
CREATE INDEX IF NOT EXISTS idx_documentation_tags ON documentation USING GIN(tags);

COMMENT ON TABLE documentation IS 'Stores crawled and imported PowerShell documentation for search and AI context.';
COMMENT ON COLUMN documentation.content IS 'Full extracted content from the page.';
COMMENT ON COLUMN documentation.summary IS 'AI-generated or extracted summary.';
COMMENT ON COLUMN documentation.source IS 'Source of documentation, such as Microsoft Learn, PowerShell Gallery, or GitHub.';
COMMENT ON COLUMN documentation.content_type IS 'Type of content: article, tutorial, reference, cmdlet, module, or example.';
COMMENT ON COLUMN documentation.category IS 'Category for organizing documentation.';
COMMENT ON COLUMN documentation.tags IS 'Tags for categorization and filtering.';
COMMENT ON COLUMN documentation.extracted_commands IS 'PowerShell commands/cmdlets extracted from content.';
COMMENT ON COLUMN documentation.extracted_functions IS 'PowerShell functions extracted from content.';
COMMENT ON COLUMN documentation.extracted_modules IS 'PowerShell modules referenced in content.';
COMMENT ON COLUMN documentation.metadata IS 'Additional metadata such as author, version, or last modified.';
