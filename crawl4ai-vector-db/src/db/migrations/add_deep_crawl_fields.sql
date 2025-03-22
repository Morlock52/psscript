-- Migration to add deep crawling support fields to web_pages table

-- Add new columns for deep crawling support
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS parent_url VARCHAR(2048);
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS crawl_strategy VARCHAR(20);
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS relevance_score FLOAT;
ALTER TABLE web_pages ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT TRUE;

-- Add comments to the new columns
COMMENT ON COLUMN web_pages.parent_url IS 'URL of the parent page that linked to this page';
COMMENT ON COLUMN web_pages.parent_id IS 'ID of the parent page that linked to this page';
COMMENT ON COLUMN web_pages.depth IS 'Depth level in the crawl tree (0 for root pages)';
COMMENT ON COLUMN web_pages.crawl_strategy IS 'Strategy used for crawling (BFS, DFS, BESTFIRST)';
COMMENT ON COLUMN web_pages.relevance_score IS 'Relevance score for this page (used in BESTFIRST strategy)';
COMMENT ON COLUMN web_pages.is_processed IS 'Whether the page has been processed (chunked and embedded)';

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_web_pages_parent_id ON web_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_web_pages_depth ON web_pages(depth);
CREATE INDEX IF NOT EXISTS idx_web_pages_crawl_strategy ON web_pages(crawl_strategy);

-- Add foreign key constraint for parent_id
ALTER TABLE web_pages 
ADD CONSTRAINT IF NOT EXISTS fk_web_pages_parent_id 
FOREIGN KEY (parent_id) 
REFERENCES web_pages(id) 
ON DELETE SET NULL;
