import {
  buildDocumentationAnalysisPrompt,
  extractPowerShellCommands,
  extractPowerShellModules,
  extractPowerShellScriptsFromHtml,
  parseDocumentationAnalysisResponse,
} from '../documentationAnalysis';

describe('documentation analysis helpers', () => {
  it('extracts PowerShell scripts, commands, and modules from documentation content', () => {
    const html = `
      <main>
        <p>Use Get-Service with Microsoft.PowerShell.Management.</p>
        <pre><code class="language-powershell">Get-Service | Where-Object {$_.Status -eq "Running"}</code></pre>
      </main>
    `;

    const scripts = extractPowerShellScriptsFromHtml(html);

    expect(scripts).toEqual(['Get-Service | Where-Object {$_.Status -eq "Running"}']);
    expect(extractPowerShellCommands(html)).toEqual(['Get-Service', 'Where-Object']);
    expect(extractPowerShellModules(html)).toEqual(['Microsoft.PowerShell.Management']);
  });

  it('builds an audit-ready JSON prompt for AI document scanning', () => {
    const prompt = buildDocumentationAnalysisPrompt(
      'Get-Process returns local processes and can be piped to Stop-Process.',
      'https://learn.microsoft.com/powershell/get-process',
      ['Get-Process | Sort-Object CPU']
    );

    expect(prompt).toContain('executive summary first');
    expect(prompt).toContain('"keyFindings"');
    expect(prompt).toContain('"riskNotes"');
    expect(prompt).toContain('"recommendedActions"');
    expect(prompt).toContain('Return ONLY valid JSON');
    expect(prompt).toContain('Get-Process | Sort-Object CPU');
  });

  it('parses rich AI analysis JSON and falls back safely when needed', () => {
    const parsed = parseDocumentationAnalysisResponse(
      JSON.stringify({
        title: 'Service Operations',
        summary: 'Explains how to inspect services before automation changes.',
        category: 'Service Management',
        aiInsights: ['Use Get-Service for service state discovery'],
        keyFindings: ['The page shows service inventory commands with pipeline filtering.'],
        riskNotes: ['Stopping services can interrupt dependent workloads.'],
        recommendedActions: ['Test service filters before applying Stop-Service.'],
        codeExample: 'Get-Service | Where-Object Status -eq Running',
      }),
      'Fallback content',
      'https://example.test/service'
    );

    expect(parsed.category).toBe('Service Management');
    expect(parsed.keyFindings).toHaveLength(1);
    expect(parsed.riskNotes[0]).toContain('interrupt');
    expect(parsed.recommendedActions[0]).toContain('Test service filters');

    const fallback = parseDocumentationAnalysisResponse('', 'Set-ExecutionPolicy controls script execution policy.', 'https://example.test/security');
    expect(fallback.category).toBe('Security');
    expect(fallback.recommendedActions.length).toBeGreaterThan(0);
  });
});
