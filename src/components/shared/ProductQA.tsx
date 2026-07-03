import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import type { QA } from '@/types'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'

interface Props {
  productId: string
}

export default function ProductQA({ productId }: Props) {
  const { isAuthenticated } = useAppSelector(s => s.auth)
  const [question, setQuestion] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.qa(productId),
    queryFn: async () => {
      const res = await axiosInstance.get<{ success: boolean; data: QA[] }>(`/qa/${productId}`)
      return res.data.data
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (q: string) => {
      await axiosInstance.post(`/qa/${productId}`, { question: q })
    },
    onSuccess: () => {
      setQuestion('')
      qc.invalidateQueries({ queryKey: queryKeys.qa(productId) })
    },
  })

  const items = data ?? []

  return (
    <div className="space-y-6">
      {/* Ask a question */}
      {isAuthenticated ? (
        <div className="bg-ocean-50 dark:bg-ocean-900/20 rounded-xl p-4">
          <p className="text-sm font-medium text-ocean-800 dark:text-ocean-200 mb-2">
            Have a question about this product?
          </p>
          <div className="flex gap-2">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Type your question…"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-ocean-200 dark:border-ocean-700 bg-white dark:bg-ocean-900 text-ocean-900 dark:text-ocean-100 focus:outline-none focus:ring-2 focus:ring-ocean-500"
            />
            <button
              onClick={() => submitMutation.mutate(question)}
              disabled={question.trim().length < 10 || submitMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-ocean-600 text-white rounded-lg disabled:opacity-50 hover:bg-ocean-700 transition-colors"
            >
              {submitMutation.isPending ? 'Sending…' : 'Ask'}
            </button>
          </div>
          {submitMutation.isSuccess && (
            <p className="text-xs text-green-600 mt-2">
              Question submitted! Our team will answer it soon.
            </p>
          )}
          {submitMutation.isError && (
            <p className="text-xs text-red-500 mt-2">Failed to submit. Try again.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ocean-500 italic">Sign in to ask a question.</p>
      )}

      {/* Q&A list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse h-16 bg-ocean-100 dark:bg-ocean-800 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-ocean-400">
          <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(qa => (
            <div
              key={qa.id}
              className="border border-ocean-100 dark:border-ocean-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === qa.id ? null : qa.id)}
                className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left bg-white dark:bg-ocean-900 hover:bg-ocean-50 dark:hover:bg-ocean-800/50 transition-colors"
              >
                <div>
                  <span className="text-xs font-semibold text-ocean-500 uppercase tracking-wide">Q</span>
                  <p className="text-sm font-medium text-ocean-900 dark:text-ocean-100 mt-0.5">
                    {qa.question}
                  </p>
                  <p className="text-xs text-ocean-400 mt-1">Asked by {qa.userName}</p>
                </div>
                {qa.answer && (
                  expanded === qa.id
                    ? <ChevronUp size={16} className="shrink-0 text-ocean-400 mt-1" />
                    : <ChevronDown size={16} className="shrink-0 text-ocean-400 mt-1" />
                )}
              </button>
              {expanded === qa.id && qa.answer && (
                <div className="px-4 py-3 bg-ocean-50 dark:bg-ocean-900/40 border-t border-ocean-100 dark:border-ocean-800">
                  <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">A</span>
                  <p className="text-sm text-ocean-700 dark:text-ocean-300 mt-0.5">{qa.answer}</p>
                </div>
              )}
              {!qa.answer && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-t border-ocean-100 dark:border-ocean-800">
                  <p className="text-xs text-amber-600 dark:text-amber-400 italic">Awaiting answer from our team…</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
