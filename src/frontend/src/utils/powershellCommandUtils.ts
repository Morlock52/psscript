export interface ParsedPowerShellCommand {
  original: string;
  cmdlet: string | null;
  pipelineSegments: string[];
  parameters: Array<{ name: string; value: string | null }>;
  switches: string[];
  positionalArgs: string[];
  specials: string[];
}

export type FlagSeverity = 'info' | 'warn' | 'danger';

export interface FlagFinding {
  id: string;
  severity: FlagSeverity;
  title: string;
  reason: string;
  saferAlternative?: string;
}

export function isCmdletToken(token: string): boolean {
  const t = (token || '').trim();
  // Verb-Noun (PowerShell cmdlet naming convention)
  return /^[A-Za-z]+-[A-Za-z][A-Za-z0-9]*$/.test(t);
}

export function extractFirstCommandLine(text: string): string | null {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    // Skip full-line comments
    if (line.startsWith('#')) continue;
    // Skip fenced blocks markers if present
    if (line.startsWith('```')) continue;
    return line;
  }
  return null;
}

function splitByPipeOutsideQuotes(input: string): string[] {
  const s = String(input || '');
  const out: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : '';

    // Minimal escaping support for backtick in PowerShell strings.
    if (ch === "'" && !inDouble && prev !== '`') inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '`') inDouble = !inDouble;

    if (ch === '|' && !inSingle && !inDouble) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [s.trim()];
}

function tokenizeOutsideQuotes(segment: string): string[] {
  const s = String(segment || '').trim();
  const tokens: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : '';

    if (ch === "'" && !inDouble && prev !== '`') {
      inSingle = !inSingle;
      cur += ch;
      continue;
    }
    if (ch === '"' && !inSingle && prev !== '`') {
      inDouble = !inDouble;
      cur += ch;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (cur.length) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }

  if (cur.length) tokens.push(cur);
  return tokens;
}

export function parsePowerShellCommand(commandLine: string): ParsedPowerShellCommand {
  const original = String(commandLine || '').trim();
  const pipelineSegments = splitByPipeOutsideQuotes(original);
  const firstSegment = pipelineSegments[0] || '';
  const tokens = tokenizeOutsideQuotes(firstSegment);

  const cmdlet = tokens.find((t) => isCmdletToken(t)) || (tokens.length && isCmdletToken(tokens[0]) ? tokens[0] : null);
  const parameters: Array<{ name: string; value: string | null }> = [];
  const switches: string[] = [];
  const positionalArgs: string[] = [];
  const specials: string[] = [];

  const specialPatterns = [
    { re: /(^|\\s)(\\d?>>|\\d?>)\\s*/g, label: 'redirection' },
    { re: /\\$\\([^)]*\\)/g, label: 'subexpression' },
    { re: /\\s@\\w+/g, label: 'splatting' },
  ];

  for (const p of specialPatterns) {
    if (p.re.test(original)) specials.push(p.label);
  }

  // Parameter parsing (first segment only, heuristic)
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.startsWith('-') && tok.length > 1) {
      // -Name:Value
      const idx = tok.indexOf(':');
      if (idx > 1) {
        const name = tok.slice(0, idx);
        const value = tok.slice(idx + 1) || '';
        parameters.push({ name, value });
        continue;
      }

      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        parameters.push({ name: tok, value: next });
        i += 1;
      } else {
        switches.push(tok);
        parameters.push({ name: tok, value: null });
      }
      continue;
    }

    // Ignore the cmdlet token itself.
    if (cmdlet && tok === cmdlet) continue;
    positionalArgs.push(tok);
  }

  return {
    original,
    cmdlet,
    pipelineSegments,
    parameters,
    switches,
    positionalArgs,
    specials,
  };
}

export function detectCommandFlags(parsed: ParsedPowerShellCommand): FlagFinding[] {
  const text = parsed.original.toLowerCase();
  const flags: FlagFinding[] = [];

  const has = (needle: string) => text.includes(needle.toLowerCase());
  const hasParam = (name: string) =>
    parsed.parameters.some((p) => p.name.toLowerCase() === name.toLowerCase());

  if (has('invoke-expression') || /\biex\b/.test(text)) {
    flags.push({
      id: 'invoke-expression',
      severity: 'danger',
      title: 'Dynamic code execution (Invoke-Expression)',
      reason: 'Executing strings as code is a common malware technique and can lead to remote code execution.',
      saferAlternative: 'Avoid iex; download to disk and validate content/signature before execution.',
    });
  }

  if (has('-encodedcommand') || has('-enc')) {
    flags.push({
      id: 'encoded-command',
      severity: 'danger',
      title: 'EncodedCommand',
      reason: 'Encoded commands are often used to obfuscate behavior and bypass inspection.',
      saferAlternative: 'Prefer readable scripts checked into source control; log and review execution.',
    });
  }

  if (has('-executionpolicy') && has('bypass')) {
    flags.push({
      id: 'executionpolicy-bypass',
      severity: 'warn',
      title: 'ExecutionPolicy Bypass',
      reason: 'Bypassing policy can allow untrusted scripts to run.',
      saferAlternative: 'Use signed scripts and set a policy that matches your security posture.',
    });
  }

  if (has('-noprofile')) {
    flags.push({
      id: 'no-profile',
      severity: 'info',
      title: 'NoProfile',
      reason: 'Skipping profiles can hide environment setup; commonly used in automation and also in obfuscation.',
    });
  }

  if (hasParam('-force') || has('-force')) {
    flags.push({
      id: 'force',
      severity: 'warn',
      title: 'Force',
      reason: 'Forcing operations can overwrite/remove items without prompts.',
      saferAlternative: 'Run without -Force first, or scope paths narrowly and add logging.',
    });
  }

  if (hasParam('-recurse') || has('-recurse')) {
    flags.push({
      id: 'recurse',
      severity: 'warn',
      title: 'Recurse',
      reason: 'Recursive operations can affect many items and increase blast radius.',
      saferAlternative: 'Test with small scopes; prefer -WhatIf when available.',
    });
  }

  if (has('-confirm:$false')) {
    flags.push({
      id: 'confirm-false',
      severity: 'warn',
      title: 'Confirm:$false',
      reason: 'Disables confirmation prompts and can lead to destructive actions.',
      saferAlternative: 'Use -WhatIf during testing; keep confirmation enabled in interactive runs.',
    });
  }

  if (has('-erroraction') && has('silentlycontinue')) {
    flags.push({
      id: 'erroraction-silent',
      severity: 'info',
      title: 'ErrorAction SilentlyContinue',
      reason: 'Suppressing errors can hide failures and security-relevant exceptions.',
      saferAlternative: 'Prefer try/catch with explicit handling and logging.',
    });
  }

  if (has('start-process') && has('-verb') && has('runas')) {
    flags.push({
      id: 'runas',
      severity: 'warn',
      title: 'Elevation request (RunAs)',
      reason: 'Running elevated increases impact of mistakes and may indicate privilege escalation.',
      saferAlternative: 'Avoid elevation unless required; prefer least privilege.',
    });
  }

  if (has('downloadstring') || has('invoke-webrequest') || has('invoke-restmethod')) {
    // Only warn strongly if combined with execution.
    const severity: FlagSeverity = (has('invoke-expression') || /\biex\b/.test(text)) ? 'danger' : 'info';
    flags.push({
      id: 'network-fetch',
      severity,
      title: 'Network content fetch',
      reason: 'Fetching remote content can introduce supply-chain risk if the source is untrusted.',
      saferAlternative: 'Pin to trusted sources, verify checksums/signatures, and store artifacts for review.',
    });
  }

  // Dedupe by id
  return Array.from(new Map(flags.map((f) => [f.id, f])).values());
}

