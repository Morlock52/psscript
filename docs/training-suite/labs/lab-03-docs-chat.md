# Lab 03: Documentation And Assistant

## Goal

Use documentation and the assistant to answer a script safety question.

## Steps

1. Open Documentation and search for a PowerShell cmdlet.
2. Capture the relevant documentation note.
3. Open the assistant.
4. Ask for a safe usage or remediation pattern.
5. Open `/agentic` and confirm it routes to the assistant instead of a 404.

## Expected Results

- Documentation results are relevant.
- Assistant response includes safety guidance or best practices.
- Agentic alias routes land on the assistant experience.

## Troubleshooting

- If documentation fails, check the API response and Netlify Function logs.
- If assistant responses fail, check provider env vars and Function logs.
- If `/agentic` 404s, verify the latest Netlify deploy and redirects.
