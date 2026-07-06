import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Users, Search, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { userAdminApi, type AssignableRole, type UserRole, type AdminUserSummary } from '@/services/api/userAdminApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

const ASSIGNABLE_ROLES: AssignableRole[] = ['customer', 'admin', 'driver']

const ROLE_COLORS: Record<UserRole, string> = {
  customer:  'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/30',
  admin:     'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
  driver:    'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  developer: 'text-gold-600 bg-gold-50 dark:bg-gold-900/20',
}

function RoleCell({ target, isSelf }: { target: AdminUserSummary; isSelf: boolean }) {
  const queryClient = useQueryClient()
  const [pendingRole, setPendingRole] = useState<AssignableRole | ''>('')

  const mutation = useMutation({
    mutationFn: (role: AssignableRole) => userAdminApi.updateRole(target.id, role),
    onSuccess: (updated) => {
      toast.success(`${updated.name} is now ${updated.role}`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setPendingRole('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to update role')
    },
  })

  if (target.role === 'developer') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ocean-400" title="Developer accounts are managed outside the app for security">
        <Lock size={12} /> Locked
      </span>
    )
  }

  if (isSelf) {
    return <span className="text-xs text-ocean-400">Your account</span>
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={pendingRole || target.role}
        onChange={e => setPendingRole(e.target.value as AssignableRole)}
        className="input-field text-xs py-1"
      >
        {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {pendingRole && pendingRole !== target.role && (
        <button
          onClick={() => mutation.mutate(pendingRole)}
          disabled={mutation.isPending}
          className="text-xs font-semibold text-ocean-700 hover:text-ocean-900 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter, page],
    queryFn: () => userAdminApi.list(search || undefined, roleFilter || undefined, page),
  })

  const users = data?.data ?? []

  return (
    <>
      <Helmet><title>Users & Roles — Admin | Divya Luxury Seafoods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-ocean-400" />
                Users & Roles
              </h1>
              <p className="text-xs text-ocean-400">{data?.total ?? 0} total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ocean-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search name or email"
                className="input-field text-sm pl-8 w-56"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value as UserRole | ''); setPage(1) }}
              className="input-field text-sm"
            >
              <option value="">All roles</option>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="driver">Driver</option>
              <option value="developer">Developer</option>
            </select>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs text-ocean-400 mb-4">
            Developer accounts are the platform's superuser role and can only be granted via a server-side script — they can't be created or changed here.
          </p>
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Change Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-ocean-50 dark:border-ocean-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-ocean-900 dark:text-white">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_COLORS[u.role]}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-400">{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          <RoleCell target={u} isSelf={u.id === currentUser?.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="text-xs font-medium px-3 py-1.5 border border-ocean-200 dark:border-ocean-700 rounded-lg text-ocean-600 dark:text-ocean-300 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-ocean-400">Page {page} of {data.totalPages}</span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="text-xs font-medium px-3 py-1.5 border border-ocean-200 dark:border-ocean-700 rounded-lg text-ocean-600 dark:text-ocean-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
