export interface CommandDetailForMarkdown {
  name?: string;
  description?: string;
  purpose?: string;
  parameters?: Array<{ name?: string; description?: string }>;
  example?: string;
  alternatives?: string;
  alternativeNote?: string;
}

export function buildCommandAnalysisMarkdown(scriptTitle: string, analysis: any): string | null {
  const commandDetails = Array.isArray(analysis?.commandDetails)
    ? analysis.commandDetails as CommandDetailForMarkdown[]
    : [];
  if (commandDetails.length === 0) {
    return null;
  }

  const commandNames = commandDetails
    .map((command) => command.name)
    .filter((name): name is string => Boolean(name));
  const securityConcerns = Array.isArray(analysis?.securityConcerns) ? analysis.securityConcerns : [];
  const performanceSuggestions = Array.isArray(analysis?.performanceSuggestions) ? analysis.performanceSuggestions : [];
  const securityScore = Number(analysis?.securityScore ?? analysis?.security_score ?? 0);
  const codeQualityScore = Number(analysis?.codeQualityScore ?? analysis?.code_quality_score ?? 0);

  const lines = [
    `# Command Analysis for ${scriptTitle}`,
    '',
    '## Commands Found',
    commandNames.length > 0
      ? commandNames.map((name) => `* ${name}`).join('\n')
      : '* No named PowerShell commands were extracted.',
    '',
    '## Command Notes',
    ...commandDetails.flatMap((command) => {
      const commandName = command.name || 'Unnamed command';
      const notes = [`* ${commandName}: ${command.description || command.purpose || 'No description was provided by the analyzer.'}`];

      if (command.parameters?.length) {
        const parameterNames = command.parameters
          .map((param) => param.name)
          .filter(Boolean)
          .join(', ');
        if (parameterNames) {
          notes.push(`  * Parameters: ${parameterNames}`);
        }
      }

      if (command.example) {
        notes.push(`  * Example seen: ${command.example}`);
      }

      if (command.alternatives) {
        notes.push(`  * Alternative: ${command.alternatives}${command.alternativeNote ? ` (${command.alternativeNote})` : ''}`);
      }

      return notes;
    }),
    '',
    '## Safety and Quality Signals',
    `* Security score: ${Number.isFinite(securityScore) && securityScore > 0 ? `${securityScore}/10` : 'Not scored'}`,
    `* Code quality score: ${Number.isFinite(codeQualityScore) && codeQualityScore > 0 ? `${codeQualityScore}/10` : 'Not scored'}`,
    securityConcerns.length > 0
      ? `* Security concerns: ${securityConcerns.length}`
      : '* Security concerns: none reported',
    performanceSuggestions.length > 0
      ? `* Performance suggestions: ${performanceSuggestions.length}`
      : '* Performance suggestions: none reported',
    '',
    '## Tracking Note',
    '* This section is generated from the analyzer output for this script. It does not add sample commands or assumptions that were not extracted from the uploaded file.'
  ];

  return lines.join('\n');
}
