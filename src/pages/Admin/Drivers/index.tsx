import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Truck, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminDriverApi, type DriverCreatePayload } from '@/services/api/driverApi'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

function CreateDriverModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DriverCreatePayload>({ name: '', email: '', phone: '', password: '' })

  const mutation = useMutation({
    mutationFn: () => adminDriverApi.create(form),
    onSuccess: (driver) => {
      toast.success(`Driver account created for ${driver.name}`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to create driver account')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-ocean-900 rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">Add Driver</h2>
          <button onClick={onClose} className="text-ocean-400 hover:text-ocean-700"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field w-full" placeholder="+91 9999123456" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Password *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input-field w-full" placeholder="Min 8 characters" />
          </div>
        </div>

        <Button
          variant="primary" size="lg" className="w-full mt-5"
          loading={mutation.isPending}
          disabled={!form.name.trim() || !form.email.trim() || form.password.length < 8}
          onClick={() => mutation.mutate()}
        >
          Create Driver Account
        </Button>
      </div>
    </div>
  )
}

export default function AdminDriversPage() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: adminDriverApi.list,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminDriverApi.setActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] }),
    onError: () => toast.error('Failed to update driver'),
  })

  return (
    <>
      <Helmet><title>Drivers — Admin | Divya Foods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <Truck size={18} className="text-ocean-400" />
                Drivers
              </h1>
              <p className="text-xs text-ocean-400">{drivers.length} total</p>
            </div>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            Add Driver
          </Button>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Truck size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No drivers yet</p>
                <Button variant="outline" size="sm" className="mt-4" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                  Add Driver
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d.id} className="border-b border-ocean-50 dark:border-ocean-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-ocean-900 dark:text-white">{d.name}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{d.email}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{d.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-ocean-400">{formatDate(d.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleMutation.mutate({ id: d.id, isActive: !d.isActive })}
                            className={d.isActive ? 'text-mint-500' : 'text-ocean-300'}
                            title={d.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                          >
                            {d.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
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

      {showCreate && <CreateDriverModal onClose={() => setShowCreate(false)} />}
    </>
  )
}
