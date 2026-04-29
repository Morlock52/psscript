# Module 04: Search And Discovery

Last updated: April 29, 2026.

## Objectives

- Use script search and filters.
- Understand embedding-backed similarity.
- Compare exact keyword results with meaning-based results.

## Walkthrough

1. Open Scripts.
2. Search for a cmdlet or title.
3. Apply category or tag filters.
4. Search by natural language, such as `active directory onboarding`.
5. Compare exact and similar results.

## Search Modes

![Search Modes](../../graphics/search-modes.svg)

## Screenshot

![Scripts](../../screenshots/readme/scripts.png)

![Documentation](../../screenshots/readme/documentation.png)

## Query Patterns

| Query | Mode | Expected outcome |
| --- | --- | --- |
| `Get-ADUser` | keyword | exact cmdlet matches |
| `onboarding workflow` | vector/similarity | semantically related scripts |
| `reset password` | hybrid | exact and similar scripts |

## Verification Checklist

- Search results update without a full app reload.
- Filters narrow results.
- Similar scripts make sense for the query intent.
