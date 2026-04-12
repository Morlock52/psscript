CREATE TABLE IF NOT EXISTS ai_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    latency INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON ai_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint ON ai_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON ai_metrics(model);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON ai_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON ai_metrics(success);
