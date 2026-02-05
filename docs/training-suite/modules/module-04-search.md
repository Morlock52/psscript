# Module 04: Search and Discovery

## Objectives

- Use keyword search and filters
- Use vector search for similarity
- Compare results and refine queries

## Walkthrough

1. Navigate to Search or Scripts.
2. Run a keyword search for a common cmdlet (example: Get-ADUser).
3. Apply filters for category or tag.
4. Use semantic search to find similar scripts.

## Search modes

![Search Modes](../../graphics/search-modes-v4.svg)

## Screenshots

![Script Library](../../screenshots/scripts-v4.png)

## Query patterns

| Query | Mode | Expected outcome |
| --- | --- | --- |
| Get-ADUser | Keyword | Exact cmdlet matches |
| onboarding workflow | Vector | Semantically similar scripts |
| reset password | Hybrid | Mixed exact + semantic ranking |

## Verification checklist

- You can filter by category or tag
- Similar scripts surface when vector search is enabled
