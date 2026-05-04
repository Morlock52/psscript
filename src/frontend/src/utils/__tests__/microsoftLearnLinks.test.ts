import { describe, expect, it } from 'vitest';
import { microsoftLearnReferenceForCommandName, qrCodeUrlFor } from '../microsoftLearnLinks';

describe('microsoftLearnLinks', () => {
  it('builds direct Microsoft Learn links for known PowerShell commands', () => {
    const reference = microsoftLearnReferenceForCommandName('Get-Process');

    expect(reference).toMatchObject({
      command: 'Get-Process',
      title: 'Get-Process - Microsoft Learn',
      url: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-process?view=powershell-7.5',
      sourceConfidence: 'Client fallback Microsoft Learn article',
    });
    expect(microsoftLearnReferenceForCommandName('Out-Null')?.url).toBe(
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/out-null?view=powershell-7.5'
    );
  });

  it('falls back to Microsoft Learn search for unknown Verb-Noun commands', () => {
    const reference = microsoftLearnReferenceForCommandName('Get-ContosoThing');

    expect(reference?.url).toBe('https://learn.microsoft.com/en-us/search/?terms=Get-ContosoThing&scope=PowerShell');
    expect(reference?.sourceConfidence).toBe('Client fallback Microsoft Learn search');
  });

  it('rejects strings that are not PowerShell command names', () => {
    expect(microsoftLearnReferenceForCommandName('not a command')).toBeNull();
  });

  it('builds scannable QR image URLs for Learn links', () => {
    const learnUrl = 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-process?view=powershell-7.5';
    const qrUrl = qrCodeUrlFor(learnUrl);

    expect(qrUrl).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(qrUrl).toContain('size=160x160');
    expect(qrUrl).toContain(encodeURIComponent(learnUrl));
  });
});
