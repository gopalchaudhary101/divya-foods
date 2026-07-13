import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Image as ImageIcon, Plus, Pencil, Trash2, ChevronLeft,
  ToggleLeft, ToggleRight, AlertTriangle, ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminBannerApi, type BannerUpsertPayload } from '@/services/api/bannerApi'
import { ImageUploader } from '@/components/shared/ImageUploader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ROUTES } from '@/constants/routes'
import type { Banner } from '@/types'

// ─── Banner form ──────────────────────────────────────────────────────────────

interface BannerFormValues {
  title: string
  subtitle: string
  link: string
  isActive: boolean
  order: number
}

function BannerModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Banner
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [images, setImages] = useState<string[]>(initial?.image ? [initial.image] : [])
  const { register, handleSubmit, watch, formState: { errors } } = useForm<BannerFormValues>({
    defaultValues: {
      title:    initial?.title ?? '',
      subtitle: initial?.subtitle ?? '',
      link:     initial?.link ?? '',
      isActive: initial?.isActive ?? true,
      order:    initial?.order ?? 0,
    },
  })

  const mutation = useMutation({
    mutationFn: (values: BannerFormValues) => {
      if (!images[0]) throw new Error('An image is required.')
      const payload: BannerUpsertPayload = {
        title:    values.title.trim(),
        subtitle: values.subtitle.trim() || null,
        image:    images[0],
        link:     values.link.trim() || null,
        isActive: values.isActive,
        order:    Number(values.order) || 0,
      }
      return isEdit
        ? adminBannerApi.update(initial!.id, payload)
        : adminBannerApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Banner updated' : 'Banner created')
      onSaved()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as Error)?.message
      toast.error(msg ?? 'Failed to save banner')
    },
  })

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Banner' : 'Create Banner'} size="md" tone="admin">
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Image *
            </label>
            <ImageUploader value={images} onChange={setImages} maxImages={1} disabled={mutation.isPending} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Title *
            </label>
            <input {...register('title', { required: 'Required' })} className="input-field w-full" placeholder="Fresh Norwegian Salmon — 20% Off" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Subtitle
            </label>
            <input {...register('subtitle')} className="input-field w-full" placeholder="This week only" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Link
            </label>
            <input {...register('link')} className="input-field w-full" placeholder="/products?category=seafood" />
            <p className="text-xs text-ocean-400 mt-1">Where the banner sends customers when clicked. Leave blank for none.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Display Order
            </label>
            <input {...register('order')} type="number" className="input-field w-full" placeholder="0" />
            <p className="text-xs text-ocean-400 mt-1">Lower numbers show first in the carousel.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="sr-only" />
            <div className={`w-10 h-6 rounded-full transition-colors relative ${watch('isActive') ? 'bg-mint-500' : 'bg-ocean-200 dark:bg-ocean-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${watch('isActive') ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-ocean-700 dark:text-ocean-200">Active</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="flex-1" loading={mutation.isPending}>
              {isEdit ? 'Save Changes' : 'Create Banner'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ banner, onClose, onDeleted }: { banner: Banner; onClose: () => void; onDeleted: () => void }) {
  const mutation = useMutation({
    mutationFn: () => adminBannerApi.delete(banner.id),
    onSuccess: () => { toast.success('Banner deleted'); onDeleted(); onClose() },
    onError: () => toast.error('Failed to delete banner'),
  })
  return (
    <Modal isOpen onClose={onClose} size="sm" tone="admin">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-ocean-900 dark:text-white">Delete Banner</p>
            <p className="text-sm text-ocean-500">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-5">
          Are you sure you want to delete <strong>{banner.title}</strong>?
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

// ─── Toggle active ────────────────────────────────────────────────────────────

function useToggleActive(onSuccess: () => void) {
  return useMutation({
    mutationFn: ({ banner }: { banner: Banner }) =>
      adminBannerApi.update(banner.id, {
        title:    banner.title,
        subtitle: banner.subtitle ?? null,
        image:    banner.image,
        link:     banner.link ?? null,
        isActive: !banner.isActive,
        order:    banner.order,
      }),
    onSuccess: () => { onSuccess() },
    onError: () => toast.error('Failed to update banner'),
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBannersPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<Banner | null>(null)
  const [deleting, setDeleting]     = useState<Banner | null>(null)

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: adminBannerApi.list,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
    queryClient.invalidateQueries({ queryKey: ['banners'] })
  }
  const toggleMutation = useToggleActive(invalidate)

  return (
    <>
      <Helmet><title>Banners — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-ocean-400" />
                Banners
              </h1>
              <p className="text-xs text-ocean-400">{banners.length} total</p>
            </div>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            New Banner
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">

            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : banners.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No banners yet</p>
                <p className="text-xs mt-1">Create a banner to show in the homepage carousel.</p>
                <Button variant="outline" size="sm" className="mt-4" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                  Create Banner
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Banner</th>
                      <th className="px-4 py-3">Link</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Active</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map(b => (
                      <tr key={b.id} className="border-b border-ocean-50 dark:border-ocean-800 hover:bg-ocean-50/40 dark:hover:bg-ocean-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-9 rounded-lg overflow-hidden bg-ocean-50 dark:bg-ocean-800 shrink-0">
                              <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ocean-900 dark:text-white truncate">{b.title}</p>
                              {b.subtitle && <p className="text-xs text-ocean-400 truncate">{b.subtitle}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-500 max-w-[180px] truncate">
                          {b.link ? (
                            <span className="inline-flex items-center gap-1"><ExternalLink size={11} />{b.link}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-500 font-mono">{b.order}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleMutation.mutate({ banner: b })}
                            aria-label={b.isActive ? 'Deactivate banner' : 'Activate banner'}
                            className="transition-colors"
                          >
                            {b.isActive
                              ? <ToggleRight size={24} className="text-mint-500" />
                              : <ToggleLeft size={24} className="text-ocean-300" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditing(b)}
                              className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
                              aria-label={`Edit ${b.title}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleting(b)}
                              className="p-1.5 text-ocean-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              aria-label={`Delete ${b.title}`}
                            >
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
          </div>
        </div>
      </div>

      {(showCreate || editing) && (
        <BannerModal
          initial={editing ?? undefined}
          onClose={() => { setShowCreate(false); setEditing(null) }}
          onSaved={invalidate}
        />
      )}
      {deleting && (
        <DeleteConfirm
          banner={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={invalidate}
        />
      )}
    </>
  )
}
