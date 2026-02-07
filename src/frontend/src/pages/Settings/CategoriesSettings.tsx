import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import SettingsLayout from './SettingsLayout';
import { categoryService } from '../../services/api';

type CategoryRow = {
  id: number;
  name: string;
  description?: string | null;
  scriptCount?: number;
};

const inputStyles =
  'w-full px-3 py-2 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none';

const buttonPrimary =
  'px-3 py-2 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition disabled:opacity-60 disabled:cursor-not-allowed';
const buttonSecondary =
  'px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] transition disabled:opacity-60 disabled:cursor-not-allowed';
const buttonDanger =
  'px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60 disabled:cursor-not-allowed';

export default function CategoriesSettings() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<null | { id: number; name: string; scriptCount: number }>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getCategories(),
    staleTime: 30_000,
  });

  const rows: CategoryRow[] = (categoriesQuery.data?.categories || []) as CategoryRow[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) =>
      `${c.name} ${c.description || ''}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const invalidateEverywhere = async () => {
    // Categories are used in dashboard filters, upload forms, etc.
    await qc.invalidateQueries({ queryKey: ['categories'] });
    await qc.invalidateQueries({ queryKey: ['scripts'] });
    await qc.invalidateQueries({ queryKey: ['analytics'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string | null }) => categoryService.createCategory(payload),
    onMutate: async (payload) => {
      setRowError(null);
      await qc.cancelQueries({ queryKey: ['categories'] });
      const prev = qc.getQueryData<any>(['categories']);

      qc.setQueryData(['categories'], (old: any) => {
        const current = (old?.categories || []) as CategoryRow[];
        const optimistic: CategoryRow = {
          id: -Date.now(),
          name: payload.name,
          description: payload.description || null,
          scriptCount: 0,
        };
        return { ...(old || {}), categories: [optimistic, ...current].sort((a, b) => a.name.localeCompare(b.name)) };
      });

      return { prev };
    },
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['categories'], ctx.prev);
      const msg = String(err?.message || err?.message?.message || 'Failed to create category');
      setRowError(msg);
      toast.error(msg);
    },
    onSuccess: async () => {
      setNewName('');
      setNewDesc('');
      toast.success('Category created');
      await invalidateEverywhere();
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; name: string; description?: string | null }) =>
      categoryService.updateCategory(vars.id, { name: vars.name, description: vars.description ?? null }),
    onMutate: async (vars) => {
      setRowError(null);
      await qc.cancelQueries({ queryKey: ['categories'] });
      const prev = qc.getQueryData<any>(['categories']);
      qc.setQueryData(['categories'], (old: any) => {
        const current = (old?.categories || []) as CategoryRow[];
        return {
          ...(old || {}),
          categories: current
            .map((c) => (c.id === vars.id ? { ...c, name: vars.name, description: vars.description ?? null } : c))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      return { prev };
    },
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['categories'], ctx.prev);
      const msg = String(err?.message || 'Failed to update category');
      setRowError(msg);
      toast.error(msg);
    },
    onSuccess: async () => {
      toast.success('Category updated');
      setEditingId(null);
      await invalidateEverywhere();
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: number; mode?: 'uncategorize' }) => categoryService.deleteCategory(vars.id, { mode: vars.mode }),
    onMutate: async (vars) => {
      setRowError(null);
      await qc.cancelQueries({ queryKey: ['categories'] });
      const prev = qc.getQueryData<any>(['categories']);
      qc.setQueryData(['categories'], (old: any) => {
        const current = (old?.categories || []) as CategoryRow[];
        return { ...(old || {}), categories: current.filter((c) => c.id !== vars.id) };
      });
      return { prev };
    },
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['categories'], ctx.prev);
      const msg = String(err?.message || 'Failed to delete category');
      setRowError(msg);
      toast.error(msg);
    },
    onSuccess: async (_data: any) => {
      toast.success('Category deleted');
      await invalidateEverywhere();
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const startEdit = (c: CategoryRow) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description || '');
    setRowError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setRowError(null);
  };

  const onDelete = (c: CategoryRow) => {
    const count = Number(c.scriptCount || 0);
    if (count > 0) {
      setConfirm({ id: c.id, name: c.name, scriptCount: count });
    } else {
      void deleteMutation.mutateAsync({ id: c.id });
    }
  };

  return (
    <SettingsLayout
      title="Script Categories"
      description="Create, edit, and delete categories used across uploads, dashboards, and analytics."
    >
      <div className="space-y-6">
        {/* Create */}
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">New category</h2>
            <div className="text-xs text-[var(--color-text-tertiary)]">
              {categoriesQuery.isFetching ? 'Refreshing…' : ''}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1 text-[var(--color-text-secondary)]">Name</label>
              <input
                id="category-name"
                aria-label="Name"
                className={inputStyles}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Security & Compliance"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1 text-[var(--color-text-secondary)]">Description (optional)</label>
              <input
                id="category-description"
                aria-label="Description"
                className={inputStyles}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What belongs in this category?"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className={buttonPrimary}
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() =>
                void createMutation.mutateAsync({ name: newName.trim(), description: newDesc.trim() || null })
              }
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <div className="ml-auto w-full md:w-[320px]">
              <label className="block text-xs mb-1 text-[var(--color-text-secondary)]">Search</label>
              <input
                className={inputStyles}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter categories…"
              />
            </div>
          </div>

          {rowError ? (
            <div className="mt-3 text-sm text-red-400">{rowError}</div>
          ) : null}
        </div>

        {/* List */}
        <div className="rounded-lg border border-[var(--color-border-default)] overflow-hidden" data-testid="categories-list">
          <div className="px-4 py-3 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-default)] flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              Categories ({filtered.length})
            </div>
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => void categoriesQuery.refetch()}
              disabled={categoriesQuery.isFetching}
            >
              Refresh
            </button>
          </div>

          {categoriesQuery.isLoading ? (
            <div className="p-4 text-sm text-[var(--color-text-secondary)]">Loading…</div>
          ) : categoriesQuery.isError ? (
            <div className="p-4 text-sm text-red-400">Failed to load categories.</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-[var(--color-text-secondary)]">No categories found.</div>
          ) : (
            <div className="divide-y divide-[var(--color-border-default)]">
              {filtered.map((c) => {
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="p-4 bg-[var(--color-bg-elevated)]" data-testid={`category-row-${c.id}`} data-category-name={c.name}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      <div className="md:col-span-4">
                        <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Name</div>
                        {isEditing ? (
                          <input
                            className={inputStyles}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <div className="text-[var(--color-text-primary)] font-semibold">{c.name}</div>
                        )}
                      </div>

                      <div className="md:col-span-6">
                        <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Description</div>
                        {isEditing ? (
                          <input
                            aria-label="Description"
                            className={inputStyles}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                          />
                        ) : (
                          <div className="text-sm text-[var(--color-text-secondary)]">
                            {c.description || <span className="italic text-[var(--color-text-tertiary)]">—</span>}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Scripts</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          {Number(c.scriptCount || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className={buttonPrimary}
                            disabled={!editName.trim() || updateMutation.isPending}
                            onClick={() =>
                              void updateMutation.mutateAsync({
                                id: c.id,
                                name: editName.trim(),
                                description: editDesc.trim() || null,
                              })
                            }
                          >
                            Save
                          </button>
                          <button type="button" className={buttonSecondary} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className={buttonSecondary} onClick={() => startEdit(c)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className={buttonDanger}
                            disabled={deleteMutation.isPending}
                            onClick={() => onDelete(c)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm delete */}
        {confirm ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfirm(null)}
          >
            <div
              className="w-full max-w-lg rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-default)] flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Delete category and uncategorize scripts
                </div>
                <button type="button" className={buttonSecondary} onClick={() => setConfirm(null)}>
                  Close
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Deleting <span className="font-semibold text-[var(--color-text-primary)]">{confirm.name}</span> will
                  uncategorize <span className="font-semibold text-[var(--color-text-primary)]">{confirm.scriptCount}</span>{' '}
                  scripts (set their category to empty).
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" className={buttonSecondary} onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={buttonDanger}
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const id = confirm.id;
                      setConfirm(null);
                      await deleteMutation.mutateAsync({ id, mode: 'uncategorize' });
                    }}
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Uncategorize and delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsLayout>
  );
}
