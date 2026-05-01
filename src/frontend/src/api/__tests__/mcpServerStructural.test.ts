import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkspaceFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), '..', '..', ...parts), 'utf8');
}

describe('PSScript MCP server structure', () => {
  const source = readWorkspaceFile('netlify/functions/mcp.ts');

  it('exposes a remote Streamable HTTP MCP endpoint and metadata routes', () => {
    expect(source).toContain("'/mcp'");
    expect(source).toContain("'/.well-known/mcp/server.json'");
    expect(source).toContain("'streamable-http'");
    expect(source).toContain("rpc.method === 'initialize'");
    expect(source).toContain("rpc.method === 'tools/list'");
    expect(source).toContain("rpc.method === 'tools/call'");
  });

  it('registers the full planned PSScript tool surface', () => {
    const expectedTools = [
      'psscript.list_scripts',
      'psscript.get_script',
      'psscript.search_scripts',
      'psscript.get_script_analysis',
      'psscript.find_similar_scripts',
      'psscript.list_categories',
      'psscript.list_tags',
      'psscript.search_documentation',
      'psscript.get_dashboard',
      'psscript.get_ai_analytics',
      'psscript.create_script',
      'psscript.update_script_details',
      'psscript.upload_script_text',
      'psscript.analyze_script',
      'psscript.generate_script',
      'psscript.explain_script',
      'psscript.create_documentation',
      'psscript.update_documentation',
      'psscript.archive_script',
      'psscript.restore_script',
      'psscript.delete_script',
      'psscript.bulk_delete_scripts',
      'psscript.bulk_import_documentation',
      'psscript.manage_user',
      'psscript.create_db_backup',
      'psscript.restore_db_backup',
    ];

    for (const tool of expectedTools) {
      expect(source).toContain(`name: '${tool}'`);
    }
  });

  it('delegates through existing hosted API routes and keeps raw SQL out of the MCP function', () => {
    expect(source).toContain("function apiRequest");
    expect(source).toContain("new URL(path, req.url)");
    expect(source).toContain("Authorization: req.headers.get('authorization')!");
    expect(source).not.toContain('SELECT ');
    expect(source).not.toContain('UPDATE ');
    expect(source).not.toContain('DELETE FROM');
    expect(source).not.toContain('INSERT INTO');
  });

  it('requires auth, admin authorization, and confirmation for sensitive tools', () => {
    expect(source).toContain('getBearerUser(req)');
    expect(source).toContain("missing_or_invalid_token");
    expect(source).toContain("tool.adminOnly && user.role !== 'admin'");
    expect(source).toContain('tool.destructive && args.confirm !== true');
    expect(source).toContain("adminOnly: true");
    expect(source).toContain("destructive: true");
    expect(source).toContain('Disabling users requires confirmation.');
    expect(source).toContain('Deleting users requires confirmation.');
    expect(source).toContain('Resetting passwords requires confirmation.');
  });
});
