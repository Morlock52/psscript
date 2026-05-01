export interface MSDocsReference {
  command?: string;
  title?: string;
  url?: string;
  description?: string;
  sourceConfidence?: string;
  source_confidence?: string;
}

const MICROSOFT_LEARN_COMMAND_MODULES: Record<string, string> = {
  'convertto-securestring': 'microsoft.powershell.security',
  'foreach-object': 'microsoft.powershell.core',
  'format-list': 'microsoft.powershell.utility',
  'format-table': 'microsoft.powershell.utility',
  'get-childitem': 'microsoft.powershell.management',
  'get-content': 'microsoft.powershell.management',
  'get-item': 'microsoft.powershell.management',
  'get-location': 'microsoft.powershell.management',
  'get-process': 'microsoft.powershell.management',
  'get-service': 'microsoft.powershell.management',
  'group-object': 'microsoft.powershell.utility',
  'import-csv': 'microsoft.powershell.utility',
  'invoke-command': 'microsoft.powershell.core',
  'invoke-expression': 'microsoft.powershell.utility',
  'invoke-restmethod': 'microsoft.powershell.utility',
  'invoke-webrequest': 'microsoft.powershell.utility',
  'measure-object': 'microsoft.powershell.utility',
  'new-item': 'microsoft.powershell.management',
  'new-object': 'microsoft.powershell.utility',
  'remove-item': 'microsoft.powershell.management',
  'select-object': 'microsoft.powershell.utility',
  'set-content': 'microsoft.powershell.management',
  'set-executionpolicy': 'microsoft.powershell.security',
  'sort-object': 'microsoft.powershell.utility',
  'start-process': 'microsoft.powershell.management',
  'stop-process': 'microsoft.powershell.management',
  'test-path': 'microsoft.powershell.management',
  'where-object': 'microsoft.powershell.core',
  'write-error': 'microsoft.powershell.utility',
  'write-host': 'microsoft.powershell.utility',
  'write-output': 'microsoft.powershell.utility',
};

export const microsoftLearnReferenceForCommandName = (commandName: string): MSDocsReference | null => {
  if (!/^[A-Za-z]+-[A-Za-z][A-Za-z0-9]+$/.test(commandName)) {
    return null;
  }

  const slug = commandName.toLowerCase();
  const moduleName = MICROSOFT_LEARN_COMMAND_MODULES[slug];
  const url = moduleName
    ? `https://learn.microsoft.com/en-us/powershell/module/${moduleName}/${slug}?view=powershell-7.5`
    : `https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(commandName)}&scope=PowerShell`;

  return {
    command: commandName,
    title: `${commandName} - Microsoft Learn`,
    url,
    description: moduleName
      ? `Official Microsoft Learn reference for the ${commandName} PowerShell command.`
      : `Microsoft Learn search results for the ${commandName} PowerShell command.`,
    sourceConfidence: moduleName ? 'Client fallback Microsoft Learn article' : 'Client fallback Microsoft Learn search',
  };
};

export const qrCodeUrlFor = (url: string): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(url)}`;
