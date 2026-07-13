import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ChevronLeft, MessageCircle, Save, Share2, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import { adminWhatsappApi, type WhatsAppConfigUpdate } from '@/services/api/whatsappApi'
import { queryKeys } from '@/services/queryKeys'
import { ROUTES } from '@/constants/routes'

const TEMPLATE_HELP = '{productName} {description} {price} {category} {availability} {link}'
const CART_HELP = '{itemsList} {total}'
const ORDER_HELP = '{orderNumber} {status} {total}'

export default function AdminWhatsAppPage() {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.admin.whatsappConfig(),
    queryFn: adminWhatsappApi.getConfig,
  })
  const { data: analytics } = useQuery({
    queryKey: queryKeys.admin.whatsappAnalytics(),
    queryFn: adminWhatsappApi.getAnalytics,
  })

  const { register, handleSubmit, reset, watch } = useForm<WhatsAppConfigUpdate>({ values: config })

  const mutation = useMutation({
    mutationFn: (values: WhatsAppConfigUpdate) => adminWhatsappApi.updateConfig(values),
    onSuccess: (data) => {
      toast.success('WhatsApp settings saved')
      queryClient.setQueryData(queryKeys.admin.whatsappConfig(), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.config() })
      reset(data)
    },
    onError: () => toast.error('Failed to save WhatsApp settings'),
  })

  return (
    <>
      <Helmet><title>WhatsApp — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
            <ChevronLeft size={18} className="text-ocean-400" />
          </Link>
          <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
            <MessageCircle size={18} className="text-ocean-400" />
            WhatsApp
          </h1>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* ── Analytics ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-ocean-400 mb-2">
                <Share2 size={15} />
                <span className="text-xs font-semibold uppercase tracking-widest">Total Shares</span>
              </div>
              <p className="text-3xl font-bold text-ocean-900 dark:text-white">{analytics?.totalShares ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 sm:col-span-2">
              <div className="flex items-center gap-2 text-ocean-400 mb-3">
                <TrendingUp size={15} />
                <span className="text-xs font-semibold uppercase tracking-widest">Shares by Source</span>
              </div>
              {analytics && analytics.bySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={analytics.bySource} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#25D366" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-ocean-400 py-8 text-center">No shares yet</p>
              )}
            </div>
          </div>

          {analytics && analytics.topProducts.length > 0 && (
            <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
              <p className="text-xs font-semibold text-ocean-400 uppercase tracking-widest px-5 pt-5 pb-3">
                Most Shared Products
              </p>
              <table className="w-full">
                <tbody>
                  {analytics.topProducts.map((p, i) => (
                    <tr key={p.productId} className="border-t border-ocean-50 dark:border-ocean-800/60">
                      <td className="px-5 py-2.5 text-sm text-ocean-400 w-8">{i + 1}</td>
                      <td className="px-5 py-2.5 text-sm text-ocean-900 dark:text-white">{p.productName}</td>
                      <td className="px-5 py-2.5 text-sm text-ocean-500 text-right">{p.count} shares</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Settings ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6 sm:p-8">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" {...register('enabled')} className="sr-only" />
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${watch('enabled') ? 'bg-mint-500' : 'bg-ocean-200 dark:bg-ocean-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${watch('enabled') ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
                    Enable "Share on WhatsApp" buttons sitewide
                  </span>
                </label>

                {config && !config.cloudApiConfigured && (
                  <p className="text-xs text-ocean-400 bg-ocean-50 dark:bg-ocean-800 rounded-lg px-3 py-2">
                    Click-to-chat buttons work independently of this: the automatic catalogue
                    reply bot (customers messaging your WhatsApp number directly) additionally
                    needs the Meta WhatsApp Business Platform configured — see the setup guide.
                    Cloud API status: <strong>not configured</strong>.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    {...register('phoneNumber', { required: true, pattern: /^\d{8,15}$/ })}
                    className="input-field w-full"
                    placeholder="919999123242"
                  />
                  <p className="text-xs text-ocean-400 mt-1">
                    Digits only, with country code, no + or spaces — e.g. 919999123242.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Product Message Template
                  </label>
                  <textarea {...register('productMessageTemplate')} rows={6} className="input-field w-full font-mono text-xs" />
                  <p className="text-xs text-ocean-400 mt-1">Placeholders: {TEMPLATE_HELP}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Cart Message Template
                  </label>
                  <textarea {...register('cartMessageTemplate')} rows={4} className="input-field w-full font-mono text-xs" />
                  <p className="text-xs text-ocean-400 mt-1">Placeholders: {CART_HELP}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                    Order Message Template
                  </label>
                  <textarea {...register('orderMessageTemplate')} rows={4} className="input-field w-full font-mono text-xs" />
                  <p className="text-xs text-ocean-400 mt-1">Placeholders: {ORDER_HELP}</p>
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-ocean-700 hover:bg-ocean-900 text-white disabled:opacity-50 transition-colors"
                >
                  <Save size={14} /> {mutation.isPending ? 'Saving…' : 'Save Settings'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
