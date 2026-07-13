import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Edit2, Trash2, ChevronLeft,
  AlertTriangle, ChefHat, UploadCloud, Eye, EyeOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { adminRecipeApi, recipeApi, type RecipeUpsertPayload } from '@/services/api/recipeApi'
import { queryKeys } from '@/services/queryKeys'
import { ROUTES } from '@/constants/routes'
import type { Recipe, RecipeDifficulty } from '@/types'

// ─── Helpers: array fields as plain text ───────────────────────────────────────
// Ingredients/steps are one per line; tags/productTags/searchKeywords are
// comma-separated — simple, reliable to edit for a form with this many fields,
// no dynamic add/remove-row wiring required.

const linesToArray = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean)
const arrayToLines = (arr: string[]) => arr.join('\n')
const csvToArray = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean)
const arrayToCsv = (arr: string[]) => arr.join(', ')

// ─── Create / edit form ─────────────────────────────────────────────────────────

interface RecipeFormValues {
  title: string
  slug: string
  description: string
  cuisine: string
  category: string
  ingredientsText: string
  stepsText: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  difficulty: RecipeDifficulty
  servings: number
  emoji: string
  image: string
  tagsText: string
  productTagsText: string
  metaTitle: string
  metaDescription: string
  searchKeywordsText: string
  isPublished: boolean
}

function RecipeFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Recipe
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RecipeFormValues>({
    defaultValues: {
      title:              initial?.title ?? '',
      slug:               initial?.slug ?? '',
      description:        initial?.description ?? '',
      cuisine:            initial?.cuisine ?? '',
      category:           initial?.category ?? '',
      ingredientsText:    initial ? arrayToLines(initial.ingredients) : '',
      stepsText:          initial ? arrayToLines(initial.steps) : '',
      prepTimeMinutes:    initial?.prepTimeMinutes ?? 10,
      cookTimeMinutes:    initial?.cookTimeMinutes ?? 20,
      difficulty:         initial?.difficulty ?? 'Easy',
      servings:           initial?.servings ?? 2,
      emoji:              initial?.emoji ?? '🍽️',
      image:              initial?.image ?? '',
      tagsText:           initial ? arrayToCsv(initial.tags) : '',
      productTagsText:    initial ? arrayToCsv(initial.productTags) : '',
      metaTitle:          initial?.metaTitle ?? '',
      metaDescription:    initial?.metaDescription ?? '',
      searchKeywordsText: initial ? arrayToCsv(initial.searchKeywords) : '',
      isPublished:        initial?.isPublished ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: (values: RecipeFormValues) => {
      const payload: RecipeUpsertPayload = {
        title:            values.title.trim(),
        slug:             values.slug.trim() || undefined,
        description:      values.description.trim(),
        cuisine:          values.cuisine.trim(),
        category:         values.category.trim(),
        ingredients:      linesToArray(values.ingredientsText),
        steps:            linesToArray(values.stepsText),
        prepTimeMinutes:  Number(values.prepTimeMinutes),
        cookTimeMinutes:  Number(values.cookTimeMinutes),
        difficulty:       values.difficulty,
        servings:         Number(values.servings),
        emoji:            values.emoji.trim() || undefined,
        image:            values.image.trim() || null,
        tags:             csvToArray(values.tagsText),
        productTags:      csvToArray(values.productTagsText),
        metaTitle:        values.metaTitle.trim() || undefined,
        metaDescription:  values.metaDescription.trim() || undefined,
        searchKeywords:   csvToArray(values.searchKeywordsText),
        isPublished:      values.isPublished,
      }
      return isEdit
        ? adminRecipeApi.update(initial!.id, payload)
        : adminRecipeApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Recipe updated' : 'Recipe created')
      onSaved()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to save recipe')
    },
  })

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Recipe' : 'Create Recipe'} size="2xl" tone="admin">
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Title *</label>
            <input {...register('title', { required: 'Required', minLength: { value: 3, message: 'Min 3 characters' } })} className="input-field w-full" placeholder="Garlic Butter Salmon" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Slug</label>
              <input {...register('slug')} className="input-field w-full" placeholder="auto-generated from title" disabled />
              <p className="text-xs text-ocean-400 mt-1">The URL slug can't be changed here — it stays stable once published.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Description *</label>
            <textarea {...register('description', { required: 'Required', minLength: { value: 10, message: 'Min 10 characters' } })} rows={2} className="input-field w-full" placeholder="Short, appetizing summary shown on recipe cards" />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Cuisine *</label>
              <input {...register('cuisine', { required: 'Required' })} className="input-field w-full" placeholder="Japanese, Indian, Continental…" />
              {errors.cuisine && <p className="text-xs text-red-500 mt-1">{errors.cuisine.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Dish Type / Category *</label>
              <input {...register('category', { required: 'Required' })} className="input-field w-full" placeholder="seafood, curry, soup, grilled…" />
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Ingredients * (one per line)</label>
            <textarea {...register('ingredientsText', { required: 'Required' })} rows={5} className="input-field w-full font-mono text-xs" placeholder={'2 salmon fillets (200g each)\n3 tbsp butter\n4 cloves garlic (minced)'} />
            {errors.ingredientsText && <p className="text-xs text-red-500 mt-1">{errors.ingredientsText.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Preparation Steps * (one per line)</label>
            <textarea {...register('stepsText', { required: 'Required' })} rows={5} className="input-field w-full font-mono text-xs" placeholder={'Pat the salmon dry and season.\nSear skin-side up for 4 minutes.\nFlip, baste with butter and garlic.'} />
            {errors.stepsText && <p className="text-xs text-red-500 mt-1">{errors.stepsText.message}</p>}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Prep (min) *</label>
              <input {...register('prepTimeMinutes', { required: true, min: 0 })} type="number" min="0" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Cook (min) *</label>
              <input {...register('cookTimeMinutes', { required: true, min: 0 })} type="number" min="0" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Difficulty *</label>
              <select {...register('difficulty')} className="input-field w-full">
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Servings *</label>
              <input {...register('servings', { required: true, min: 1 })} type="number" min="1" className="input-field w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Emoji</label>
              <input {...register('emoji')} className="input-field w-full" placeholder="🍽️" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Image URL</label>
              <input {...register('image')} className="input-field w-full" placeholder="https://res.cloudinary.com/…" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Tags <span className="normal-case font-normal">(comma-separated — general keywords: quick, keto, party…)</span>
            </label>
            <input {...register('tagsText')} className="input-field w-full" placeholder="quick, keto, party" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Product Tags <span className="normal-case font-normal">(comma-separated — matched against real products to auto-recommend them)</span>
            </label>
            <input {...register('productTagsText')} className="input-field w-full" placeholder="salmon, norwegian salmon" />
          </div>

          <details className="group">
            <summary className="text-xs font-semibold text-ocean-500 uppercase tracking-widest cursor-pointer select-none">
              SEO fields (optional — sensible defaults are used if left blank)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Meta Title</label>
                <input {...register('metaTitle')} className="input-field w-full" placeholder="Defaults to the recipe title" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Meta Description</label>
                <textarea {...register('metaDescription')} rows={2} className="input-field w-full" placeholder="Defaults to the recipe description" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Search Keywords (comma-separated)</label>
                <input {...register('searchKeywordsText')} className="input-field w-full" placeholder="miso salmon, japanese salmon recipe" />
              </div>
            </div>
          </details>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('isPublished')} className="sr-only" />
            <div className={`w-10 h-6 rounded-full transition-colors relative ${watch('isPublished') ? 'bg-mint-500' : 'bg-ocean-200 dark:bg-ocean-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${watch('isPublished') ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-ocean-700 dark:text-ocean-200">Published (visible to customers)</span>
          </label>

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white dark:bg-ocean-900 pb-1">
            <Button variant="outline" size="sm" className="flex-1" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="flex-1" loading={mutation.isPending}>
              {isEdit ? 'Save Changes' : 'Create Recipe'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

// ─── Bulk import ────────────────────────────────────────────────────────────────

function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState('')
  const [parseError, setParseError] = useState('')

  const mutation = useMutation({
    mutationFn: (recipes: RecipeUpsertPayload[]) => adminRecipeApi.bulkImport(recipes),
    onSuccess: (result) => {
      toast.success(`${result.created} recipe(s) created, ${result.skipped} skipped`)
      onImported()
      onClose()
    },
    onError: () => toast.error('Bulk import failed'),
  })

  function handleImport() {
    setParseError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setParseError('Not valid JSON — paste an array of recipe objects.')
      return
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setParseError('Expected a non-empty JSON array of recipe objects.')
      return
    }
    mutation.mutate(parsed as RecipeUpsertPayload[])
  }

  return (
    <Modal
      isOpen onClose={onClose} size="xl" tone="admin"
      title={<span className="flex items-center gap-2"><UploadCloud size={18} /> Bulk Import Recipes</span>}
    >
      <div className="p-6">
        <p className="text-xs text-ocean-500 mb-3">
          Paste a JSON array of recipe objects (same fields as the create form — camelCase keys).
          Titles that already exist are skipped, not overwritten, so it's safe to re-run the same batch.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          className="input-field w-full font-mono text-xs"
          placeholder='[{"title": "...", "description": "...", "cuisine": "...", "category": "...", "ingredients": ["..."], "steps": ["..."], "prepTimeMinutes": 10, "cookTimeMinutes": 20, "difficulty": "Easy", "servings": 2}]'
        />
        {parseError && <p className="text-xs text-red-500 mt-1">{parseError}</p>}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" className="flex-1" loading={mutation.isPending} onClick={handleImport}>
            Import
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ recipe, onClose, onDeleted }: { recipe: Recipe; onClose: () => void; onDeleted: () => void }) {
  const mutation = useMutation({
    mutationFn: () => adminRecipeApi.delete(recipe.id),
    onSuccess: () => { toast.success('Recipe deleted'); onDeleted(); onClose() },
    onError: () => toast.error('Failed to delete recipe'),
  })
  return (
    <Modal isOpen onClose={onClose} size="sm" tone="admin">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-ocean-900 dark:text-white">Delete Recipe</p>
            <p className="text-sm text-ocean-500">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-5">
          Are you sure you want to delete <strong>{recipe.title}</strong>?
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            size="sm" className="flex-1 bg-red-500 hover:bg-red-600 text-white border-red-500"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminRecipesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [cuisineFilter, setCuisineFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [deleting, setDeleting] = useState<Recipe | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)

  const filters = { page, limit: 20, search: search || undefined, cuisine: cuisineFilter || undefined, category: categoryFilter || undefined }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.recipes(filters),
    queryFn: () => adminRecipeApi.list(filters),
  })
  const { data: filterOptions } = useQuery({
    queryKey: queryKeys.recipes.filters(),
    queryFn: () => recipeApi.getFilters(),
  })

  const recipes = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const cuisines = filterOptions?.cuisines ?? []
  const categories = filterOptions?.categories ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] })
    queryClient.invalidateQueries({ queryKey: ['recipes'] })
  }

  const togglePublishMutation = useMutation({
    mutationFn: (recipe: Recipe) => adminRecipeApi.update(recipe.id, { isPublished: !recipe.isPublished }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update recipe'),
  })

  return (
    <>
      <Helmet><title>Recipes — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        {/* Top bar */}
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <ChefHat size={18} className="text-ocean-400" />
                Recipes
              </h1>
              <p className="text-xs text-ocean-400">{total} total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" leftIcon={<UploadCloud size={14} />} onClick={() => setShowBulkImport(true)}>
              Bulk Import
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              New Recipe
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by title…"
                className="input-field w-full pl-9"
              />
            </div>
            <select value={cuisineFilter} onChange={e => { setCuisineFilter(e.target.value); setPage(1) }} className="input-field">
              <option value="">All cuisines</option>
              {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} className="input-field">
              <option value="">All dish types</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No recipes match these filters</p>
                <Button variant="outline" size="sm" className="mt-4" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                  Create Recipe
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Recipe</th>
                      <th className="px-4 py-3">Cuisine</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Difficulty</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map(r => (
                      <tr key={r.id} className="border-b border-ocean-50 dark:border-ocean-800/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{r.emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-ocean-900 dark:text-white">{r.title}</p>
                              <p className="text-xs text-ocean-400">/{r.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{r.cuisine}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500 capitalize">{r.category}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{r.difficulty}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePublishMutation.mutate(r)}
                            aria-label={r.isPublished ? `Unpublish ${r.title}` : `Publish ${r.title}`}
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${r.isPublished ? 'bg-mint-50 text-mint-600 dark:bg-mint-900/20' : 'bg-ocean-100 text-ocean-500 dark:bg-ocean-800'}`}
                          >
                            {r.isPublished ? <Eye size={11} /> : <EyeOff size={11} />}
                            {r.isPublished ? 'Live' : 'Draft'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg text-ocean-400 hover:text-ocean-600">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setDeleting(r)} aria-label={`Delete ${r.title}`} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-ocean-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} buttons="text" />
          </div>
        </div>
      </div>

      {showCreate && <RecipeFormModal onClose={() => setShowCreate(false)} onSaved={invalidate} />}
      {editing && <RecipeFormModal initial={editing} onClose={() => setEditing(null)} onSaved={invalidate} />}
      {deleting && <DeleteConfirm recipe={deleting} onClose={() => setDeleting(null)} onDeleted={invalidate} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={invalidate} />}
    </>
  )
}
