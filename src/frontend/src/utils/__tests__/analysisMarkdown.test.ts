import { describe, expect, it } from 'vitest';
import { buildCommandAnalysisMarkdown } from '../analysisMarkdown';

describe('buildCommandAnalysisMarkdown', () => {
  it('returns null when no command details are present', () => {
    expect(buildCommandAnalysisMarkdown('No Commands', {})).toBeNull();
  });

  it('renders extracted commands without inventing missing details', () => {
    const markdown = buildCommandAnalysisMarkdown('Cleanup Script', {
      securityScore: 8,
      codeQualityScore: 7,
      securityConcerns: ['Review Remove-Item target scope.'],
      performanceSuggestions: [],
      commandDetails: [
        {
          name: 'Remove-Item',
          description: 'Deletes matching files.',
          parameters: [{ name: '-Path' }, { name: '-Recurse' }],
          example: 'Remove-Item -Path $target -Recurse',
        },
      ],
    });

    expect(markdown).toContain('# Command Analysis for Cleanup Script');
    expect(markdown).toContain('* Remove-Item');
    expect(markdown).toContain('Parameters: -Path, -Recurse');
    expect(markdown).toContain('Security concerns: 1');
    expect(markdown).toContain('Performance suggestions: none reported');
  });
});
