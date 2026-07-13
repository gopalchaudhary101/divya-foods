import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Mail, MapPin, Send, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageSEO } from '@/components/shared/PageSEO'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { contactApi } from '@/services/api/contactApi'
import { CONFIG } from '@/constants/config'
import { getErrorMessage } from '@/utils/apiError'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: typeof errors = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Enter your name'
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.message.trim() || form.message.trim().length < 5) e.message = 'Message is too short'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await contactApi.submit(form)
      setSubmitted(true)
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PageSEO
        title="Contact Us — Divya Foods"
        description="Get in touch with Divya Foods for order queries, bulk enquiries, or general questions."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-premium-navy dark:text-white mb-3">
            Contact Us
          </h1>
          <p className="text-premium-navy/70 dark:text-ocean-300 leading-relaxed max-w-2xl">
            Questions about an order, bulk pricing, or anything else? Reach out — we usually reply within one business day.
          </p>
        </motion.div>

        <div className="mt-10 grid md:grid-cols-5 gap-8">
          {/* Contact details */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="md:col-span-2 space-y-5">
            <a href={`tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`}
               className="flex items-start gap-3 p-4 rounded-xl border border-premium-navy/10 dark:border-ocean-800 hover:border-premium-gold transition-colors">
              <Phone size={18} className="mt-0.5 text-premium-teal shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40">Call Us</p>
                <p className="text-premium-navy dark:text-ocean-100">{CONFIG.CONTACT.PHONE_1}</p>
                <p className="text-premium-navy dark:text-ocean-100">{CONFIG.CONTACT.PHONE_2}</p>
              </div>
            </a>
            <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}
               className="flex items-start gap-3 p-4 rounded-xl border border-premium-navy/10 dark:border-ocean-800 hover:border-premium-gold transition-colors">
              <Mail size={18} className="mt-0.5 text-premium-teal shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40">Email Us</p>
                <p className="text-premium-navy dark:text-ocean-100 break-all">{CONFIG.CONTACT.EMAIL}</p>
              </div>
            </a>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-premium-navy/10 dark:border-ocean-800">
              <MapPin size={18} className="mt-0.5 text-premium-teal shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40">Visit Us</p>
                <p className="text-premium-navy dark:text-ocean-100">{CONFIG.CONTACT.ADDRESS}</p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp}
            className="md:col-span-3 bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6 sm:p-8"
          >
            {submitted ? (
              <div className="flex flex-col items-center text-center py-10">
                <CheckCircle size={40} className="text-premium-teal mb-3" />
                <p className="font-display text-xl font-semibold text-premium-navy dark:text-white">Message sent!</p>
                <p className="mt-1.5 text-sm text-premium-navy/60 dark:text-ocean-300">
                  Thanks for reaching out — we'll get back to you shortly.
                </p>
                <Button variant="outline" size="sm" className="mt-6" onClick={() => setSubmitted(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Your Name"
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })) }}
                  error={errors.name}
                  required
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })) }}
                    error={errors.email}
                    required
                  />
                  <Input
                    label="Phone (optional)"
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-premium-navy/80 dark:text-ocean-200 mb-1.5">Message</label>
                  <textarea
                    value={form.message}
                    onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErrors(er => ({ ...er, message: undefined })) }}
                    rows={5}
                    className="input-field w-full resize-none"
                    placeholder="How can we help?"
                  />
                  {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message}</p>}
                </div>
                <Button type="submit" variant="premium" size="lg" loading={isSubmitting} rightIcon={<Send size={16} />} className="self-start">
                  Send Message
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}
