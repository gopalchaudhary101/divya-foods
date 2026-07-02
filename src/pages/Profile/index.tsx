import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import {
  User, Phone, Mail, MapPin, Lock, LogOut, Plus, Pencil, Trash2,
  Star, Package, ChevronRight, CheckCircle, Eye, EyeOff, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { userApi } from '@/services/api/userApi'
import { orderApi } from '@/services/api/orderApi'
import { queryKeys } from '@/services/queryKeys'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/utils/apiError'
import axiosInstance from '@/services/api/axiosInstance'
import { setCredentials } from '@/features/auth/authSlice'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import type { Address, ApiResponse } from '@/types'
import { ROUTES } from '@/constants/routes'

// ─── Avatar initials ─────────────────────────────────────────────────────────

function Avatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`rounded-full bg-gradient-to-br from-ocean-600 to-ocean-400 flex items-center justify-center text-white font-bold select-none
      ${size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-9 h-9 text-sm'}`}>
      {initials}
    </div>
  )
}

// ─── Status badge (reused from Orders) ───────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:    'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  confirmed:  'text-mint-600 bg-mint-50 dark:bg-mint-900/20',
  processing: 'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/20',
  shipped:    'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  delivered:  'text-green-600 bg-green-50 dark:bg-green-900/20',
  cancelled:  'text-red-500 bg-red-50 dark:bg-red-900/20',
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-ocean-50 dark:border-ocean-800 flex items-center gap-2.5">
        <span className="text-ocean-500">{icon}</span>
        <h2 className="text-sm font-semibold text-ocean-800 dark:text-ocean-200 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Address form modal ───────────────────────────────────────────────────────

interface AddrFormData {
  label: string; fullName: string; phone: string
  addressLine1: string; addressLine2: string
  city: string; state: string; pincode: string; isDefault: boolean
}

const BLANK_ADDR: AddrFormData = {
  label: 'Home', fullName: '', phone: '', addressLine1: '',
  addressLine2: '', city: '', state: 'Delhi', pincode: '', isDefault: false,
}

function AddressModal({
  initial, onSave, onClose, isSaving,
}: {
  initial: AddrFormData
  onSave: (data: AddrFormData) => void
  onClose: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<AddrFormData>(initial)
  const set = (k: keyof AddrFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-ocean-900 rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 flex items-center justify-between">
          <h3 className="font-semibold text-ocean-900 dark:text-white">
            {initial.fullName ? 'Edit Address' : 'Add New Address'}
          </h3>
          <button onClick={onClose} className="text-ocean-400 hover:text-ocean-700 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Label</label>
              <select value={form.label} onChange={set('label')}
                className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 outline-none focus:ring-2 focus:ring-ocean-400">
                {['Home', 'Work', 'Other'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Full Name *</label>
              <input value={form.fullName} onChange={set('fullName')} placeholder="Recipient name"
                className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Phone *</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+91 9999999999"
              className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Address Line 1 *</label>
            <input value={form.addressLine1} onChange={set('addressLine1')} placeholder="House no., street, area"
              className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Address Line 2</label>
            <input value={form.addressLine2} onChange={set('addressLine2')} placeholder="Landmark (optional)"
              className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">City *</label>
              <input value={form.city} onChange={set('city')} placeholder="City"
                className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">State *</label>
              <input value={form.state} onChange={set('state')} placeholder="State"
                className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ocean-600 dark:text-ocean-400 mb-1">Pincode *</label>
              <input value={form.pincode} onChange={set('pincode')} placeholder="110001" maxLength={6}
                className="w-full text-sm bg-ocean-50 dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-2.5 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={set('isDefault')}
              className="w-4 h-4 accent-ocean-600 rounded" />
            <span className="text-sm text-ocean-700 dark:text-ocean-300">Set as default delivery address</span>
          </label>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            loading={isSaving}
            disabled={!form.fullName || !form.phone || !form.addressLine1 || !form.city || !form.pincode}
            className="flex-1"
          >
            Save Address
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Profile page ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // ── Profile edit state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '')

  // ── Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // ── Address modal state
  const [addrModal, setAddrModal] = useState<{ open: boolean; editId?: string; data: AddrFormData }>({
    open: false, data: BLANK_ADDR,
  })

  // ── Queries
  const { data: addresses = [] } = useQuery({
    queryKey: queryKeys.user.addresses(),
    queryFn: userApi.getAddresses,
    enabled: !!user,
  })

  const { data: ordersData } = useQuery({
    queryKey: queryKeys.orders.all(),
    queryFn: () => orderApi.getMyOrders(1),
    enabled: !!user,
  })
  const recentOrders = (ordersData?.data ?? []).slice(0, 3)

  // ── Mutations
  const updateProfileMut = useMutation({
    mutationFn: (payload: { name?: string; phone?: string }) => userApi.updateProfile(payload),
    onSuccess: (updated) => {
      dispatch(setCredentials({ user: updated, token: localStorage.getItem('access_token')! }))
      toast.success('Profile updated')
      setEditingProfile(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const changePwdMut = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      axiosInstance.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setShowPasswordForm(false)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const createAddrMut = useMutation({
    mutationFn: userApi.addAddress,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses() }); setAddrModal({ open: false, data: BLANK_ADDR }); toast.success('Address saved') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateAddrMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof userApi.updateAddress>[1] }) =>
      userApi.updateAddress(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses() }); setAddrModal({ open: false, data: BLANK_ADDR }); toast.success('Address updated') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteAddrMut = useMutation({
    mutationFn: userApi.deleteAddress,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses() }); toast.success('Address removed') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ocean-600 dark:text-ocean-300 mb-4">Please log in to view your profile</p>
          <Button onClick={() => navigate(ROUTES.AUTH.LOGIN)}>Log In</Button>
        </div>
      </div>
    )
  }

  function handleSaveAddress(form: AddrFormData) {
    const payload = {
      label: form.label, fullName: form.fullName, phone: form.phone,
      addressLine1: form.addressLine1, addressLine2: form.addressLine2 || undefined,
      city: form.city, state: form.state, pincode: form.pincode, isDefault: form.isDefault,
    }
    if (addrModal.editId) {
      updateAddrMut.mutate({ id: addrModal.editId, data: payload })
    } else {
      createAddrMut.mutate(payload)
    }
  }

  function openEditAddress(addr: Address) {
    setAddrModal({
      open: true,
      editId: addr.id,
      data: {
        label: addr.label, fullName: addr.fullName, phone: addr.phone,
        addressLine1: addr.addressLine1, addressLine2: addr.addressLine2 ?? '',
        city: addr.city, state: addr.state, pincode: addr.pincode,
        isDefault: addr.isDefault ?? false,
      },
    })
  }

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : ''

  return (
    <>
      <Helmet><title>My Profile — Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-ocean-950 pb-16">
        {/* ── Hero header ────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-ocean-800 to-ocean-600 px-4 pt-10 pb-16 text-white">
          <div className="max-w-2xl mx-auto flex items-center gap-5">
            <Avatar name={user.name} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-display font-bold truncate">{user.name}</h1>
              <p className="text-ocean-200 text-sm mt-0.5 truncate">{user.email}</p>
              {memberSince && (
                <p className="text-ocean-300 text-xs mt-1 flex items-center gap-1">
                  <Star size={11} /> Member since {memberSince}
                </p>
              )}
            </div>
            {user.role === 'admin' && (
              <Link to="/admin" className="px-3 py-1.5 bg-gold-500 text-ocean-900 text-xs font-semibold rounded-full">
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* ── Cards (pulled up over the hero) ────────────────────────── */}
        <div className="max-w-2xl mx-auto px-4 -mt-8 space-y-4">

          {/* ── Personal Information ─────────────────────────────────── */}
          <Card title="Personal Information" icon={<User size={16} />}>
            {!editingProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User size={15} className="text-ocean-400 shrink-0" />
                  <span className="text-sm text-ocean-800 dark:text-ocean-200">{user.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-ocean-400 shrink-0" />
                  <span className="text-sm text-ocean-800 dark:text-ocean-200">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3">
                    <Phone size={15} className="text-ocean-400 shrink-0" />
                    <span className="text-sm text-ocean-800 dark:text-ocean-200">{user.phone}</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setProfileName(user.name); setProfilePhone(user.phone ?? ''); setEditingProfile(true) }}
                  className="mt-1 flex items-center gap-2"
                >
                  <Pencil size={13} /> Edit Profile
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Full Name"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                />
                <Input
                  label="Phone"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="+91 9999999999"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => updateProfileMut.mutate({ name: profileName, phone: profilePhone })}
                    loading={updateProfileMut.isPending}
                    disabled={!profileName.trim()}
                  >
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ── Delivery Addresses ───────────────────────────────────── */}
          <Card title="Delivery Addresses" icon={<MapPin size={16} />}>
            {addresses.length === 0 ? (
              <p className="text-sm text-ocean-400 mb-3">No saved addresses yet</p>
            ) : (
              <div className="space-y-3 mb-3">
                {addresses.map((addr) => (
                  <div key={addr.id}
                    className="border border-ocean-100 dark:border-ocean-700 rounded-xl p-3.5 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-300 px-2 py-0.5 rounded-full">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="text-xs text-mint-600 dark:text-mint-400 flex items-center gap-1">
                            <CheckCircle size={11} /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-ocean-800 dark:text-ocean-200">{addr.fullName}</p>
                      <p className="text-xs text-ocean-500 dark:text-ocean-400 leading-relaxed mt-0.5">
                        {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                      <p className="text-xs text-ocean-500 dark:text-ocean-400">{addr.phone}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditAddress(addr)}
                        className="p-2 text-ocean-400 hover:text-ocean-700 dark:hover:text-ocean-200 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this address?')) deleteAddrMut.mutate(addr.id!) }}
                        className="p-2 text-ocean-400 hover:text-red-500 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddrModal({ open: true, data: BLANK_ADDR })}
              className="flex items-center gap-2"
            >
              <Plus size={14} /> Add New Address
            </Button>
          </Card>

          {/* ── Recent Orders ────────────────────────────────────────── */}
          <Card title="Recent Orders" icon={<Package size={16} />}>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-ocean-400">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => {
                  const statusColor = STATUS_COLOR[order.status] ?? STATUS_COLOR.pending
                  return (
                    <Link
                      key={order.id}
                      to={`${ROUTES.ORDERS}/${order.id}`}
                      className="flex items-center gap-3 py-2 hover:bg-ocean-50 dark:hover:bg-ocean-800/50 -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ocean-800 dark:text-ocean-200 truncate">
                          Order #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-ocean-400 mt-0.5">{formatDate(order.createdAt)} · {formatCurrency(order.total)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusColor}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <ChevronRight size={14} className="text-ocean-300 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
            <Link
              to={ROUTES.ORDERS}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ocean-600 dark:text-ocean-400 hover:text-ocean-900 dark:hover:text-white transition-colors"
            >
              View all orders <ChevronRight size={13} />
            </Link>
          </Card>

          {/* ── Security ─────────────────────────────────────────────── */}
          <Card title="Security" icon={<Shield size={16} />}>
            {!showPasswordForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2"
              >
                <Lock size={13} /> Change Password
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    label="Current Password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-8 text-ocean-400 hover:text-ocean-600"
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label="New Password"
                    type={showNew ? 'text' : 'password'}
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-8 text-ocean-400 hover:text-ocean-600"
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                />
                {confirmPwd && newPwd !== confirmPwd && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => changePwdMut.mutate({ currentPassword: currentPwd, newPassword: newPwd })}
                    loading={changePwdMut.isPending}
                    disabled={!currentPwd || !newPwd || newPwd !== confirmPwd || newPwd.length < 8}
                  >
                    Update Password
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowPasswordForm(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ── Sign Out ─────────────────────────────────────────────── */}
          <div className="pt-2 pb-4">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ── Address modal ──────────────────────────────────────────────── */}
      {addrModal.open && (
        <AddressModal
          initial={addrModal.data}
          onSave={handleSaveAddress}
          onClose={() => setAddrModal({ open: false, data: BLANK_ADDR })}
          isSaving={createAddrMut.isPending || updateAddrMut.isPending}
        />
      )}
    </>
  )
}
