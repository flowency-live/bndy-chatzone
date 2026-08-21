import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders the header', () => {
      render(<App />)

      expect(screen.getByText('Signal Dropzone')).toBeInTheDocument()
    })

    it('renders the description', () => {
      render(<App />)

      expect(screen.getByText(/drop a gig poster or paste event text/i)).toBeInTheDocument()
    })

    it('renders the dropzone component', () => {
      render(<App />)

      expect(screen.getByTestId('dropzone')).toBeInTheDocument()
    })
  })

  describe('text submission flow', () => {
    it('submits text to the API', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ signalId: 'sig_test123' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            signal: { signalId: 'sig_test123', status: 'pending_review', signalType: 'text_paste', receivedAt: '2024-01-01' },
            interpretation: {
              interpretationId: 'int_123',
              llmInterpretation: { reasoning: 'Test interpretation', modelUsed: 'claude' },
              sourceCost: { modelCost: 0.01, tokensIn: 100, tokensOut: 50, runtimeMs: 1000 },
              uncertainties: [],
            },
            claims: [],
          }),
        })
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event announcement')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/signals'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test event announcement'),
          })
        )
      })
    })

    it('shows status panel after submission', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ signalId: 'sig_test123' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            signal: { signalId: 'sig_test123', status: 'pending_review', signalType: 'text_paste', receivedAt: '2024-01-01' },
            interpretation: {
              interpretationId: 'int_123',
              llmInterpretation: { reasoning: 'This appears to be an event', modelUsed: 'claude' },
              sourceCost: { modelCost: 0.01, tokensIn: 100, tokensOut: 50, runtimeMs: 1000 },
              uncertainties: [],
            },
            claims: [],
          }),
        })
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('sig_test123')).toBeInTheDocument()
      })
    })

    it('shows interpretation after polling completes', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ signalId: 'sig_test123' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            signal: { signalId: 'sig_test123', status: 'pending_review', signalType: 'text_paste', receivedAt: '2024-01-01' },
            interpretation: {
              interpretationId: 'int_123',
              llmInterpretation: { reasoning: 'This is a live music event', modelUsed: 'claude' },
              sourceCost: { modelCost: 0.01, tokensIn: 100, tokensOut: 50, runtimeMs: 1000 },
              uncertainties: [],
            },
            claims: [],
          }),
        })
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('This is a live music event')).toBeInTheDocument()
      })
    })

    it('shows claims when returned from API', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ signalId: 'sig_test123' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            signal: { signalId: 'sig_test123', status: 'pending_review', signalType: 'text_paste', receivedAt: '2024-01-01' },
            interpretation: {
              interpretationId: 'int_123',
              llmInterpretation: { reasoning: 'Event found', modelUsed: 'claude' },
              sourceCost: { modelCost: 0.01, tokensIn: 100, tokensOut: 50, runtimeMs: 1000 },
              uncertainties: [],
            },
            claims: [
              {
                claimId: 'claim_001',
                claimType: 'event_exists',
                subject: 'Jazz Night',
                predicate: 'exists',
                strength: 'strong',
                strengthReasoning: 'Clear event name',
                status: 'proposed',
              },
            ],
          }),
        })
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Jazz Night at venue')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/claims \(1\)/i)).toBeInTheDocument()
        expect(screen.getByText('Jazz Night')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error message when API call fails', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument()
      })
    })

    it('shows generic error when API throws', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('loading states', () => {
    it('shows interpreting state while submitting', async () => {
      const user = userEvent.setup()
      let resolveSubmit: (value: unknown) => void
      const submitPromise = new Promise((resolve) => { resolveSubmit = resolve })
      const mockFetch = vi.fn().mockReturnValue(submitPromise)
      vi.stubGlobal('fetch', mockFetch)

      render(<App />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: /interpreting/i })).toBeDisabled()

      // Clean up the promise
      resolveSubmit!({ ok: true, json: () => Promise.resolve({ signalId: 'test' }) })
    })
  })
})
