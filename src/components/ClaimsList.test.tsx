import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaimsList } from './ClaimsList'
import type { Claim } from './ClaimsList'

describe('ClaimsList', () => {
  const mockOnClaimReviewed = vi.fn()
  const signalId = 'sig_123abc'

  const baseClaim: Claim = {
    claimId: 'claim_001',
    claimType: 'event_exists',
    subject: 'Jazz Night',
    predicate: 'exists_at',
    object: 'The Blue Note',
    strength: 'strong',
    strengthReasoning: 'Clear event name and venue mentioned.',
    status: 'proposed',
  }

  const claims: Claim[] = [
    baseClaim,
    {
      claimId: 'claim_002',
      claimType: 'event_date',
      subject: 'Jazz Night',
      predicate: 'occurs_on',
      value: '2024-01-15',
      strength: 'moderate',
      strengthReasoning: 'Date format is ambiguous.',
      status: 'proposed',
    },
    {
      claimId: 'claim_003',
      claimType: 'artist_performs',
      subject: 'Stingray',
      predicate: 'performs_at',
      object: 'The Rigger',
      strength: 'weak',
      strengthReasoning: 'Artist name unclear.',
      status: 'proposed',
    },
  ]

  beforeEach(() => {
    mockOnClaimReviewed.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders the claims count', () => {
      render(<ClaimsList claims={claims} signalId={signalId} />)

      expect(screen.getByText(/claims \(3\)/i)).toBeInTheDocument()
    })

    it('renders all claims', () => {
      render(<ClaimsList claims={claims} signalId={signalId} />)

      // Jazz Night appears in two claims (event_exists and event_date)
      expect(screen.getAllByText('Jazz Night')).toHaveLength(2)
      expect(screen.getByText('Stingray')).toBeInTheDocument()
    })

    it('renders claim type labels', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.getByText('Event')).toBeInTheDocument()
    })

    it('renders claim type icons', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.getByText('🎵')).toBeInTheDocument()
    })

    it('renders strength badges', () => {
      render(<ClaimsList claims={claims} signalId={signalId} />)

      expect(screen.getByText('strong')).toBeInTheDocument()
      expect(screen.getByText('moderate')).toBeInTheDocument()
      expect(screen.getByText('weak')).toBeInTheDocument()
    })

    it('renders strength reasoning', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.getByText('Clear event name and venue mentioned.')).toBeInTheDocument()
    })

    it('renders predicate between subject and object', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.getByText('exists at')).toBeInTheDocument()
      expect(screen.getByText('The Blue Note')).toBeInTheDocument()
    })

    it('renders value for date claims', () => {
      render(<ClaimsList claims={[claims[1]]} signalId={signalId} />)

      expect(screen.getByText('2024-01-15')).toBeInTheDocument()
    })
  })

  describe('review buttons', () => {
    it('renders accept, reject, and challenge buttons for proposed claims', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /challenge/i })).toBeInTheDocument()
    })

    it('does not render review buttons for already reviewed claims', () => {
      const reviewedClaim = { ...baseClaim, status: 'accepted' }
      render(<ClaimsList claims={[reviewedClaim]} signalId={signalId} />)

      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    })

    it('shows status badge for reviewed claims', () => {
      const reviewedClaim = { ...baseClaim, status: 'accepted' }
      render(<ClaimsList claims={[reviewedClaim]} signalId={signalId} />)

      expect(screen.getByText('accepted')).toBeInTheDocument()
    })
  })

  describe('claim review actions', () => {
    it('calls API when accept is clicked', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'accepted' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(
        <ClaimsList
          claims={[baseClaim]}
          signalId={signalId}
          onClaimReviewed={mockOnClaimReviewed}
        />
      )

      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/signals/sig_123abc/claims/claim_001/review'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"action":"accept"'),
          })
        )
      })
    })

    it('calls API when reject is clicked', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'rejected' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      await user.click(rejectButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/signals/sig_123abc/claims/claim_001/review'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"action":"reject"'),
          })
        )
      })
    })

    it('calls onClaimReviewed callback after successful review', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'accepted' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(
        <ClaimsList
          claims={[baseClaim]}
          signalId={signalId}
          onClaimReviewed={mockOnClaimReviewed}
        />
      )

      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)

      await waitFor(() => {
        expect(mockOnClaimReviewed).toHaveBeenCalledWith('claim_001', 'accepted')
      })
    })

    it('updates claim status after successful review', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'accepted' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)

      await waitFor(() => {
        expect(screen.getByText('accepted')).toBeInTheDocument()
      })
    })
  })

  describe('challenge flow', () => {
    it('shows challenge input when challenge button is clicked', async () => {
      const user = userEvent.setup()
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      expect(screen.getByPlaceholderText(/why is this wrong/i)).toBeInTheDocument()
    })

    it('hides review buttons when challenge input is shown', async () => {
      const user = userEvent.setup()
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
    })

    it('shows cancel button in challenge mode', async () => {
      const user = userEvent.setup()
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('closes challenge input when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(screen.queryByPlaceholderText(/why is this wrong/i)).not.toBeInTheDocument()
    })

    it('submits challenge with reason', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'challenged' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      const input = screen.getByPlaceholderText(/why is this wrong/i)
      await user.type(input, 'The venue is incorrect')

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/signals/sig_123abc/claims/claim_001/review'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"reason":"The venue is incorrect"'),
          })
        )
      })
    })

    it('disables submit button when challenge reason is empty', async () => {
      const user = userEvent.setup()
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const challengeButton = screen.getByRole('button', { name: /challenge/i })
      await user.click(challengeButton)

      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('uncertainties', () => {
    it('does not render uncertainties section when none provided', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      expect(screen.queryByText(/uncertainties/i)).not.toBeInTheDocument()
    })

    it('does not render uncertainties section when empty array', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} uncertainties={[]} />)

      expect(screen.queryByText(/uncertainties/i)).not.toBeInTheDocument()
    })

    it('renders uncertainties when provided', () => {
      const uncertainties = [
        'Date format could be UK or US',
        'Artist name spelling unconfirmed',
      ]

      render(
        <ClaimsList
          claims={[baseClaim]}
          signalId={signalId}
          uncertainties={uncertainties}
        />
      )

      expect(screen.getByText(/uncertainties/i)).toBeInTheDocument()
      expect(screen.getByText('Date format could be UK or US')).toBeInTheDocument()
      expect(screen.getByText('Artist name spelling unconfirmed')).toBeInTheDocument()
    })
  })

  describe('strength styling', () => {
    it('applies weak class to weak claims', () => {
      const weakClaim = { ...baseClaim, strength: 'weak' as const }
      render(<ClaimsList claims={[weakClaim]} signalId={signalId} />)

      const claimCard = screen.getByTestId('claim-card-claim_001')
      expect(claimCard).toHaveClass('weak')
    })

    it('applies moderate class to moderate claims', () => {
      const moderateClaim = { ...baseClaim, strength: 'moderate' as const }
      render(<ClaimsList claims={[moderateClaim]} signalId={signalId} />)

      const claimCard = screen.getByTestId('claim-card-claim_001')
      expect(claimCard).toHaveClass('moderate')
    })

    it('applies strong class to strong claims', () => {
      render(<ClaimsList claims={[baseClaim]} signalId={signalId} />)

      const claimCard = screen.getByTestId('claim-card-claim_001')
      expect(claimCard).toHaveClass('strong')
    })
  })
})
