import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import ProductQA from './ProductQA'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

beforeEach(() => mock.reset())

describe('ProductQA', () => {
  it('prompts guests to sign in instead of showing the ask-a-question form', async () => {
    mock.onGet('/qa/p1').reply(200, { success: true, data: [] })
    renderWithProviders(<ProductQA productId="p1" />)
    expect(screen.getByText('Sign in to ask a question.')).toBeInTheDocument()
  })

  it('shows the ask form for authenticated users, disabled until 10+ characters', async () => {
    mock.onGet('/qa/p1').reply(200, { success: true, data: [] })
    const user = userEvent.setup()
    renderWithProviders(<ProductQA productId="p1" />, { preloadedState: authedState })

    const input = screen.getByPlaceholderText('Type your question…')
    const askButton = screen.getByRole('button', { name: 'Ask' })
    expect(askButton).toBeDisabled()

    await user.type(input, 'Is this fresh?')
    expect(askButton).not.toBeDisabled()
  })

  it('submits a question and clears the input on success', async () => {
    mock.onGet('/qa/p1').reply(200, { success: true, data: [] })
    mock.onPost('/qa/p1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductQA productId="p1" />, { preloadedState: authedState })

    const input = screen.getByPlaceholderText('Type your question…') as HTMLInputElement
    await user.type(input, 'Is this wild caught?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    await waitFor(() => expect(input.value).toBe(''))
    expect(await screen.findByText(/Question submitted/)).toBeInTheDocument()
  })

  it('shows "no questions yet" when the list is empty', async () => {
    mock.onGet('/qa/p1').reply(200, { success: true, data: [] })
    renderWithProviders(<ProductQA productId="p1" />)
    expect(await screen.findByText('No questions yet. Be the first to ask!')).toBeInTheDocument()
  })

  it('expands an answered question to reveal the answer', async () => {
    mock.onGet('/qa/p1').reply(200, {
      success: true,
      data: [{ id: 'q1', question: 'Is it spicy?', userName: 'Priya', answer: 'Not at all.', answeredAt: '2026-01-01' }],
    })
    const user = userEvent.setup()
    renderWithProviders(<ProductQA productId="p1" />)

    const questionButton = await screen.findByText('Is it spicy?')
    expect(screen.queryByText('Not at all.')).not.toBeInTheDocument()

    await user.click(questionButton)
    expect(screen.getByText('Not at all.')).toBeInTheDocument()
  })

  it('shows "awaiting answer" for unanswered questions', async () => {
    mock.onGet('/qa/p1').reply(200, {
      success: true,
      data: [{ id: 'q1', question: 'Is it spicy?', userName: 'Priya', answer: null, answeredAt: null }],
    })
    renderWithProviders(<ProductQA productId="p1" />)
    expect(await screen.findByText('Awaiting answer from our team…')).toBeInTheDocument()
  })
})
