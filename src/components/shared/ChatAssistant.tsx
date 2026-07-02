import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, Fish } from 'lucide-react'
import axiosInstance from '@/services/api/axiosInstance'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm Divya 🐟 Ask me about our seafood, recipes, delivery areas, or anything else — happy to help!",
}

export function ChatAssistant() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef<HTMLDivElement>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320)
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const { data } = await axiosInstance.post('/chat', { messages: next })
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, I had a connection issue. Please try again or call us at +91 9999123242.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* ── Chat panel ────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed bottom-[88px] right-4 z-50 w-[340px] sm:w-[380px] rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-700 flex flex-col"
            style={{ maxHeight: 'min(520px, calc(100dvh - 120px))' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-ocean-800 to-ocean-600 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Divya Assistant</p>
                <p className="text-ocean-200 text-xs">AI-powered · replies instantly</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-ocean-100 dark:bg-ocean-700 flex items-center justify-center shrink-0 mb-0.5">
                      <Fish size={12} className="text-ocean-600 dark:text-ocean-300" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-ocean-700 text-white rounded-br-sm'
                        : 'bg-ocean-50 dark:bg-ocean-800 text-ocean-900 dark:text-ocean-100 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full bg-ocean-100 dark:bg-ocean-700 flex items-center justify-center shrink-0">
                    <Fish size={12} className="text-ocean-600 dark:text-ocean-300" />
                  </div>
                  <div className="bg-ocean-50 dark:bg-ocean-800 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map(delay => (
                        <span
                          key={delay}
                          className="w-1.5 h-1.5 bg-ocean-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-ocean-100 dark:border-ocean-700 flex gap-2 shrink-0 bg-white dark:bg-ocean-900">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about products, recipes, delivery…"
                disabled={loading}
                className="flex-1 text-sm bg-ocean-50 dark:bg-ocean-800 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-ocean-500 transition-all disabled:opacity-60"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="w-10 h-10 bg-ocean-700 hover:bg-ocean-600 active:bg-ocean-800 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating trigger button ────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-ocean-700 to-ocean-500 text-white shadow-lg shadow-ocean-900/40 flex items-center justify-center"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
