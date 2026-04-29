# Lab 02: Search And Similarity

## Goal

Use keyword and similarity search to locate related scripts.

## Steps

1. Open Scripts.
2. Search for an exact cmdlet or script title.
3. Search for a natural-language intent.
4. Compare the top three results.
5. Record which result is most relevant and why.

## Expected Results

- Exact matches appear for known cmdlets or titles.
- Similarity results return scripts related by meaning.
- Tags and categories help narrow the set.

## Troubleshooting

- If results are empty, confirm the script exists and the authenticated API response is successful.
- If similarity is poor, verify embeddings were generated and Supabase `pgvector` is enabled.
