import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ChevronLeft, Settings as SettingsIcon, Save, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminSettingsApi } from '@/services/api/settingsApi'
import type { SiteSettings } from '@/types'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

const IMAGE_FORMATS = ['jpeg', 'png', 'webp'] as const

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminSettingsApi.get,
  })

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<SiteSettings>({
    values: settings,
  })

  const mutation = useMutation({
    mutationFn: (values: SiteSettings) => adminSettingsApi.update(values),
    onSuccess: (data) => {
      toast.success('Settings saved')
      queryClient.setQueryData(['admin-settings'], data)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      reset(data)
    },
    onError: () => toast.error('Failed to save settings'),
  })

  return (
    <>
      <Helmet><title>Settings — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Link
            to={ROUTES.ADMIN.DASHBOARD}
            className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-ocean-400" />
          </Link>
          <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
            <SettingsIcon size={18} className="text-ocean-400" />
            Settings
          </h1>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6 sm:p-8">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
                className="flex flex-col gap-5"
              >
                <p className="text-sm text-ocean-500 dark:text-ocean-400">
                  Shown publicly in the site Footer, About page and Checkout — displayed
                  as text only for security (no certificate images are exposed).
                </p>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Business Name *
                  </label>
                  <input
                    {...register('businessName', { required: true })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    GSTIN *
                  </label>
                  <input
                    {...register('gstNumber', { required: true })}
                    className="input-field w-full"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    FSSAI License Number *
                  </label>
                  <input
                    {...register('fssaiNumber', { required: true })}
                    className="input-field w-full"
                    placeholder="12345678901234"
                  />
                </div>

                <div className="pt-2 border-t border-ocean-100 dark:border-ocean-800">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ocean-900 dark:text-white mb-1">
                    <ImageIcon size={14} /> Image Upload Limits
                  </h2>
                  <p className="text-xs text-ocean-400 mb-4">
                    Applied automatically to every upload — format/quality conversion still runs
                    through Cloudinary, these just control the limits it's given.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                      Max Upload Size (MB)
                    </label>
                    <input
                      type="number" min="1"
                      {...register('maxUploadSizeMB', { required: true, valueAsNumber: true, min: 1 })}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                      Max Dimension (px)
                    </label>
                    <input
                      type="number" min="100"
                      {...register('maxImageDimension', { required: true, valueAsNumber: true, min: 100 })}
                      className="input-field w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Compression Quality
                  </label>
                  <select {...register('compressionQuality')} className="input-field w-full">
                    <option value="auto:eco">Eco (smallest file size)</option>
                    <option value="auto:good">Good (balanced)</option>
                    <option value="auto:best">Best (highest quality)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-2">
                    Allowed Formats
                  </label>
                  <div className="flex gap-4">
                    {IMAGE_FORMATS.map(fmt => (
                      <label key={fmt} className="flex items-center gap-1.5 text-sm text-ocean-700 dark:text-ocean-200 cursor-pointer">
                        <input type="checkbox" value={fmt} {...register('allowedFormats')} />
                        {fmt.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Thumbnail Sizes (px, comma-separated)
                  </label>
                  <Controller
                    control={control}
                    name="thumbnailSizes"
                    render={({ field }) => (
                      <input
                        className="input-field w-full font-mono text-xs"
                        value={(field.value ?? []).join(', ')}
                        onChange={e => field.onChange(
                          e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)),
                        )}
                        placeholder="150, 400, 800"
                      />
                    )}
                  />
                </div>

                <div className="flex gap-6 pt-1">
                  {(
                    [
                      { field: 'enableWebP', label: 'Enable WebP' },
                      { field: 'enableAVIF', label: 'Enable AVIF' },
                    ] as const
                  ).map(({ field, label }) => {
                    const val = watch(field)
                    return (
                      <label key={field} className="flex items-center gap-3 cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setValue(field, !val)}
                          className={`relative w-10 h-5.5 rounded-full transition-colors ${val ? 'bg-ocean-600' : 'bg-ocean-200 dark:bg-ocean-700'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-4.5' : ''}`} />
                        </button>
                        <span className="text-sm text-ocean-700 dark:text-ocean-200">{label}</span>
                      </label>
                    )
                  })}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  leftIcon={<Save size={14} />}
                  loading={mutation.isPending}
                  className="self-start"
                >
                  Save Settings
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
