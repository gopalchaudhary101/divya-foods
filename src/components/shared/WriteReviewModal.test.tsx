import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import { WriteReviewModal } from './WriteReviewModal'
import { reviewApi } from '@/services/api/reviewApi'

vi.mock('@/services/api/reviewApi', () => ({
  reviewApi: { canReview: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

beforeEach(() => vi.clearAllMocks())

describe('WriteReviewModal', () => {
  it('prompts guests to sign in', () => {
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={vi.fn()} />
    )
    expect(screen.getByText('Please sign in to leave a review.')).toBeInTheDocument()
  })

  it('shows a message when the user has not purchased the product', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: false, reason: 'no_purchase' })
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={vi.fn()} />,
      { preloadedState: authedState }
    )
    expect(await screen.findByText(/Only customers who have/)).toBeInTheDocument()
  })

  it('offers to delete an existing review when already reviewed', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({
      canReview: false, reason: 'already_reviewed', reviewId: 'r1',
    })
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={vi.fn()} />,
      { preloadedState: authedState }
    )
    expect(await screen.findByText("You've already reviewed this product.")).toBeInTheDocument()
  })

  it('deletes the review and closes on confirmation', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({
      canReview: false, reason: 'already_reviewed', reviewId: 'r1',
    })
    vi.mocked(reviewApi.delete).mockResolvedValue(undefined)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={onClose} />,
      { preloadedState: authedState }
    )

    await user.click(await screen.findByText('Delete My Review'))
    await waitFor(() => expect(reviewApi.delete).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the review form when eligible, disabling submit until rating + 10-char comment', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: true, reason: null })
    const user = userEvent.setup()
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={vi.fn()} />,
      { preloadedState: authedState }
    )

    const submitButton = await screen.findByRole('button', { name: 'Submit Review' })
    expect(submitButton).toBeDisabled()

    await user.click(screen.getByLabelText('Rate 5 stars'))
    expect(submitButton).toBeDisabled() // still no comment

    await user.type(screen.getByPlaceholderText(/Share your experience/), 'Absolutely fantastic quality!')
    expect(submitButton).not.toBeDisabled()
  })

  it('submits the review with the chosen rating and comment', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: true, reason: null })
    vi.mocked(reviewApi.create).mockResolvedValue({ id: 'r2' } as never)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={onClose} />,
      { preloadedState: authedState }
    )

    await user.click(await screen.findByLabelText('Rate 4 stars'))
    await user.type(screen.getByPlaceholderText(/Share your experience/), 'Really great salmon, fresh!')
    await user.click(screen.getByRole('button', { name: 'Submit Review' }))

    await waitFor(() => expect(reviewApi.create).toHaveBeenCalledWith({
      productId: 'p1', rating: 4, comment: 'Really great salmon, fresh!',
    }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('closes when the X button is clicked', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: true, reason: null })
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <WriteReviewModal productId="p1" productName="Salmon" onClose={onClose} />,
      { preloadedState: authedState }
    )
    await user.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalled()
  })
})
