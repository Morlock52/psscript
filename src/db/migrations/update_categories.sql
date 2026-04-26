-- Migration to update categories with optimized categories for PowerShell scripts.
-- This is intentionally non-destructive: do not TRUNCATE categories because that
-- cascades into scripts and their dependent records.

CREATE TEMP TABLE desired_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL
);

INSERT INTO desired_categories (id, name, description)
VALUES
  (1, 'System Administration', 'Scripts for managing Windows/Linux systems, including system configuration, maintenance, and monitoring.'),
  (2, 'Security & Compliance', 'Scripts for security auditing, hardening, compliance checks, vulnerability scanning, and implementing security best practices.'),
  (3, 'Automation & DevOps', 'Scripts that automate repetitive tasks, create workflows, CI/CD pipelines, and streamline IT processes.'),
  (4, 'Cloud Management', 'Scripts for managing resources on Azure, AWS, GCP, and other cloud platforms, including provisioning and configuration.'),
  (5, 'Network Management', 'Scripts for network configuration, monitoring, troubleshooting, and management of network devices and services.'),
  (6, 'Data Management', 'Scripts for database operations, data processing, ETL (Extract, Transform, Load), and data analysis tasks.'),
  (7, 'Active Directory', 'Scripts for managing Active Directory, user accounts, groups, permissions, and domain services.'),
  (8, 'Monitoring & Diagnostics', 'Scripts for system monitoring, logging, diagnostics, performance analysis, and alerting.'),
  (9, 'Backup & Recovery', 'Scripts for data backup, disaster recovery, system restore, and business continuity operations.'),
  (10, 'Utilities & Helpers', 'General-purpose utility scripts, helper functions, and reusable modules for various administrative tasks.');

UPDATE scripts s
SET category_id = d.id
FROM categories c
JOIN desired_categories d ON d.name = c.name
WHERE c.id <> d.id
  AND s.category_id = c.id;

DELETE FROM categories c
USING desired_categories d
WHERE c.name = d.name
  AND c.id <> d.id;

INSERT INTO categories (id, name, description, created_at, updated_at)
SELECT id, name, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM desired_categories
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

UPDATE scripts
SET category_id = 10
WHERE category_id IS NOT NULL
  AND category_id NOT IN (SELECT id FROM categories);

SELECT setval(
    'categories_id_seq',
    COALESCE((SELECT MAX(id) FROM categories), 1),
    (SELECT MAX(id) IS NOT NULL FROM categories)
);
