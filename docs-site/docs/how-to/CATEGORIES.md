---
title: Manage Script Categories
description: Add, edit, and delete script categories from Settings (with safe delete behavior)
---

# Manage script categories

Admins can manage script categories directly in the app:

- Create new categories
- Edit name/description
- Delete categories
  - If a category has scripts, the delete flow will **uncategorize** those scripts (set `category_id = NULL`) and then delete the category

## Where to find it

Open:

- `https://localhost:3090/settings/categories`

Local ports (Feb 2026):

- Frontend: `https://localhost:3090`
- Backend API: `https://localhost:4000`
- AI service: `http://localhost:8000`

## Notes

- Categories are used across Upload, Dashboard filters, and Analytics.
- Changes propagate immediately after save/delete.

![Categories settings](/images/screenshots/variants/settings-categories-v1.png)
