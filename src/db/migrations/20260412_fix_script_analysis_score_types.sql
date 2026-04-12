ALTER TABLE script_analysis
    ALTER COLUMN security_score TYPE DOUBLE PRECISION USING security_score::double precision,
    ALTER COLUMN quality_score TYPE DOUBLE PRECISION USING quality_score::double precision,
    ALTER COLUMN risk_score TYPE DOUBLE PRECISION USING risk_score::double precision;
