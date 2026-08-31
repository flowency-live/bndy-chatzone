import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CaptureStatus, type PublicCaptureStatus } from './CaptureStatus'

const processing: PublicCaptureStatus = {
  captureId: 'capture-123',
  status: 'processing',
  state: 'processing',
  message: 'Processing.',
}

describe('CaptureStatus', () => {
  it('shows truthful processing and keeps the reference secondary', () => {
    render(<CaptureStatus capture={processing} isPolling />)

    expect(screen.getByRole('heading', { name: /bndy is checking it/i })).toBeInTheDocument()
    expect(screen.getByText(/you can close this page/i)).toBeInTheDocument()
    expect(screen.getByText('capture-123')).not.toBeVisible()
  })


  it('turns poster processing into a truthful, input-aware story', () => {
    vi.useFakeTimers()
    const view = render(<CaptureStatus capture={processing} isPolling processingInputKind="poster" />)

    expect(screen.getByText('Got it. Your poster is safe.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2300 * 4))
    expect(screen.getByText('If AI made this poster, AI is now taking it apart. Fair’s fair.')).toBeInTheDocument()

    view.unmount()
    vi.useRealTimers()
  })

  it('uses message-specific copy for a text submission', () => {
    render(<CaptureStatus capture={processing} isPolling processingInputKind="text" />)
    expect(screen.getByText('Got it. Your message is safe.')).toBeInTheDocument()
  })

  it('shows a resolved gig with a direct bndy link', () => {
    render(<CaptureStatus capture={{
      captureId: 'capture-456',
      status: 'processed',
      state: 'added',
      message: 'Added to bndy.',
      result: {
        artist: { name: 'The Torrists' },
        event: {
          id: 'event-1',
          date: '2026-09-26',
          time: '21:00',
          venue: 'Disley Amalgamated Sports Club',
          url: 'https://bndy.live/g/event-1',
        },
      },
    }} isPolling={false} />)

    expect(screen.getByRole('heading', { name: 'It’s on bndy' })).toBeInTheDocument()
    expect(screen.getByText('The Torrists')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view gig on bndy.live/i })).toHaveAttribute('href', 'https://bndy.live/g/event-1')
  })

  it('lets a person resume a paused status check', async () => {
    const user = userEvent.setup()
    const onCheckAgain = vi.fn()
    render(<CaptureStatus capture={processing} isPolling={false} pollPaused onCheckAgain={onCheckAgain} />)

    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /check again/i }))
    expect(onCheckAgain).toHaveBeenCalledOnce()
  })

  it('shows a truthful terminal review state and captures optional follow-up', async () => {
    const user = userEvent.setup()
    const onSaveFollowUp = vi.fn().mockResolvedValue(undefined)
    render(<CaptureStatus capture={{
      captureId: 'capture-review',
      status: 'failed',
      state: 'needs_review',
      message: 'The artist identity needs a human check.',
    }} isPolling={false} onSaveFollowUp={onSaveFollowUp} />)

    expect(screen.getByText('A human needs to check this one')).toBeInTheDocument()
    expect(screen.getByText(/do not need to send it again/i)).toBeInTheDocument()
    expect(screen.getByText('The artist identity needs a human check.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Keep me posted' }))
    expect(onSaveFollowUp).toHaveBeenCalledWith('email', 'person@example.com')
    expect(await screen.findByText('We’ll keep you posted.')).toBeInTheDocument()
  })
})
