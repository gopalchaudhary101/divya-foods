import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UploadCloud, Download, FileWarning, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import { uploadApi, type BatchUploadResult } from '@/services/api/uploadApi'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { ApiResponse } from '@/types'

// ─── Shared modal shell ─────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Modal isOpen onClose={onClose} title={title} size="lg" tone="admin">
      <div className="px-6 py-5">{children}</div>
    </Modal>
  )
}

// ─── Bulk CSV import ────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'name', 'slug', 'category', 'price', 'originalPrice', 'stockQuantity',
  'weight', 'origin', 'brand', 'tags', 'images', 'inStock', 'isFeatured',
  'isBestSeller', 'description',
]

interface ImportResult {
  created: number
  skipped: number
  errors: { row: number; reason: string }[]
}

function downloadTemplate() {
  const csv = TEMPLATE_HEADERS.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'products-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function BulkImportModal({
  categoryNames,
  onClose,
}: {
  categoryNames: string[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axiosInstance.post<ApiResponse<ImportResult>>(
        '/admin/products/bulk-import', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setResult(data.data)
      if (data.data.created > 0) {
        toast.success(`${data.data.created} product${data.data.created !== 1 ? 's' : ''} imported`)
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <ModalShell title="Bulk Import Products" onClose={onClose}>
      <p className="text-sm text-ocean-500 dark:text-ocean-400 mb-4">
        Upload a CSV file to create many products at once. Each row becomes a new product.
      </p>

      <button
        type="button"
        onClick={downloadTemplate}
        className="flex items-center gap-1.5 text-xs text-ocean-600 hover:text-ocean-800 dark:text-ocean-300 mb-4"
      >
        <Download size={13} /> Download CSV template
      </button>

      {categoryNames.length > 0 && (
        <p className="text-xs text-ocean-400 mb-4">
          Valid categories: {categoryNames.join(', ')}
        </p>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-ocean-200 dark:border-ocean-700 rounded-xl p-6 text-center cursor-pointer hover:border-ocean-400 hover:bg-ocean-50 dark:hover:bg-ocean-900/30 transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        <UploadCloud size={22} className="mx-auto mb-2 text-ocean-400" />
        <p className="text-sm text-ocean-600 dark:text-ocean-300 font-medium">
          {file ? file.name : 'Click to choose a .csv file'}
        </p>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-sm flex items-center gap-1.5 text-mint-700 dark:text-mint-400">
            <CheckCircle2 size={14} /> {result.created} created, {result.skipped} skipped
          </p>
          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
              {result.errors.map((e, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <FileWarning size={12} className="shrink-0 mt-0.5" /> Row {e.row}: {e.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-5">
        <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
        <Button variant="primary" className="flex-1" loading={importing} disabled={!file} onClick={handleImport}>
          Import
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Bulk image upload + assign ─────────────────────────────────────────────

interface UploadedImage extends BatchUploadResult {
  assignedTo?: string
}

interface AssignableProduct {
  id: string
  name: string
  images: string[]
}

export function BulkImageModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<UploadedImage[]>([])
  const [selection, setSelection] = useState<Record<number, string>>({})

  const { data: productsData } = useQuery({
    queryKey: ['admin', 'products', 'assign-list'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<{ data: AssignableProduct[] }>>('/admin/products?limit=100')
      return data.data.data
    },
  })
  const products = productsData ?? []

  async function handleFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      const results = await uploadApi.images(files)
      setImages(prev => [...prev, ...results])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function assign(idx: number) {
    const productId = selection[idx]
    const image = images[idx]
    if (!productId || !image.url) return
    const product = products.find(p => p.id === productId)
    if (!product) return

    try {
      await axiosInstance.put(`/admin/products/${productId}`, {
        images: [...product.images, image.url],
      })
      setImages(prev => prev.map((img, i) => i === idx ? { ...img, assignedTo: product.name } : img))
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      toast.success(`Image assigned to ${product.name}`)
    } catch {
      toast.error('Failed to assign image')
    }
  }

  return (
    <ModalShell title="Bulk Image Upload" onClose={onClose}>
      <p className="text-sm text-ocean-500 dark:text-ocean-400 mb-4">
        Upload many images at once, then assign each one to a product.
      </p>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-ocean-200 dark:border-ocean-700 rounded-xl p-6 text-center cursor-pointer hover:border-ocean-400 hover:bg-ocean-50 dark:hover:bg-ocean-900/30 transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
        {uploading
          ? <Loader2 size={22} className="mx-auto mb-2 text-ocean-400 animate-spin" />
          : <UploadCloud size={22} className="mx-auto mb-2 text-ocean-400" />}
        <p className="text-sm text-ocean-600 dark:text-ocean-300 font-medium">
          Click to choose images — JPEG, PNG, WebP, up to 30 at once
        </p>
      </div>

      {images.length > 0 && (
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-3 border border-ocean-100 dark:border-ocean-800 rounded-xl p-2">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-ocean-50 dark:bg-ocean-800 shrink-0">
                {img.url
                  ? <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-ocean-200" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ocean-500 truncate">{img.filename}</p>
                {img.error && <p className="text-xs text-red-500">{img.error}</p>}
                {img.assignedTo && <p className="text-xs text-mint-600">Assigned to {img.assignedTo}</p>}
              </div>
              {img.url && !img.assignedTo && (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selection[i] ?? ''}
                    onChange={e => setSelection(prev => ({ ...prev, [i]: e.target.value }))}
                    className="input-field text-xs py-1"
                  >
                    <option value="">Assign to…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assign(i)}
                    disabled={!selection[i]}
                    className="text-xs px-2 py-1 bg-ocean-700 hover:bg-ocean-900 disabled:opacity-40 text-white rounded-lg font-medium"
                  >
                    Assign
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-5">
        <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
      </div>
    </ModalShell>
  )
}
