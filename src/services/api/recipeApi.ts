import axiosInstance from './axiosInstance'
import type { ApiResponse, PaginatedResponse, Recipe, RecipeDetail, RecipeFilters, RecipeDifficulty } from '@/types'

// ─── Request types ────────────────────────────────────────────────────────────

export interface RecipeListParams {
  page?: number
  limit?: number
  cuisine?: string
  category?: string
  difficulty?: RecipeDifficulty
  tag?: string
  search?: string
}

export interface AdminRecipeListParams {
  page?: number
  limit?: number
  search?: string
  cuisine?: string
  category?: string
  isPublished?: boolean
}

export interface RecipeUpsertPayload {
  title: string
  slug?: string
  description: string
  cuisine: string
  category: string
  ingredients: string[]
  steps: string[]
  prepTimeMinutes: number
  cookTimeMinutes: number
  difficulty: RecipeDifficulty
  servings: number
  emoji?: string
  image?: string | null
  tags?: string[]
  productTags?: string[]
  metaTitle?: string
  metaDescription?: string
  searchKeywords?: string[]
  isPublished?: boolean
}

function toSnakeCasePayload(payload: Partial<RecipeUpsertPayload>) {
  return {
    title:              payload.title,
    slug:               payload.slug,
    description:        payload.description,
    cuisine:            payload.cuisine,
    category:           payload.category,
    ingredients:        payload.ingredients,
    steps:              payload.steps,
    prep_time_minutes:  payload.prepTimeMinutes,
    cook_time_minutes:  payload.cookTimeMinutes,
    difficulty:         payload.difficulty,
    servings:           payload.servings,
    emoji:              payload.emoji,
    image:              payload.image,
    tags:               payload.tags,
    product_tags:       payload.productTags,
    meta_title:         payload.metaTitle,
    meta_description:   payload.metaDescription,
    search_keywords:    payload.searchKeywords,
    is_published:       payload.isPublished,
  }
}

// ─── Public ───────────────────────────────────────────────────────────────────

export const recipeApi = {
  /** Paginated + filtered recipe listing. Powers the /recipes page. */
  getList: async (params: RecipeListParams = {}): Promise<PaginatedResponse<Recipe>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Recipe>>('/recipes', { params })
    return data
  },

  /** Single recipe by slug, with resolved product recommendations + related recipes. */
  getBySlug: async (slug: string): Promise<RecipeDetail> => {
    const { data } = await axiosInstance.get<ApiResponse<RecipeDetail>>(`/recipes/${slug}`)
    return data.data
  },

  /** Distinct cuisines/categories currently in use — powers the filter UI. */
  getFilters: async (): Promise<RecipeFilters> => {
    const { data } = await axiosInstance.get<ApiResponse<RecipeFilters>>('/recipes/filters')
    return data.data
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface BulkImportResult {
  created: number
  skipped: number
  errors: { row: number; reason: string }[]
}

export const adminRecipeApi = {
  list: async (params: AdminRecipeListParams = {}): Promise<PaginatedResponse<Recipe>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Recipe>>('/admin/recipes', { params })
    return data
  },

  create: async (payload: RecipeUpsertPayload): Promise<Recipe> => {
    const { data } = await axiosInstance.post<ApiResponse<Recipe>>('/admin/recipes', toSnakeCasePayload(payload))
    return data.data
  },

  update: async (id: string, payload: Partial<RecipeUpsertPayload>): Promise<Recipe> => {
    const { data } = await axiosInstance.put<ApiResponse<Recipe>>(`/admin/recipes/${id}`, toSnakeCasePayload(payload))
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/recipes/${id}`)
  },

  bulkImport: async (recipes: RecipeUpsertPayload[]): Promise<BulkImportResult> => {
    const { data } = await axiosInstance.post<ApiResponse<BulkImportResult>>('/admin/recipes/bulk-import', {
      recipes: recipes.map(toSnakeCasePayload),
    })
    return data.data
  },
}
