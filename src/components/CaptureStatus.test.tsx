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
    expect(screen.getByRole('heading', { name: 'Here’s what we found' })).toBeInTheDocument()
    expect(screen.getByText('The Torrists')).toBeInTheDocument()
    expect(screen.getByText('Disley Amalgamated Sports Club')).toBeInTheDocument()
    expect(screen.getByText('Saturday, 26 September 2026')).toBeInTheDocument()
    expect(screen.getByText('21:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view gig on bndy.live/i })).toHaveAttribute('href', 'https://bndy.live/g/event-1')
  })

  it('makes a partial Capture result explicit instead of hiding it', () => {
    render(<CaptureStatus capture={{
      captureId: 'capture-partial',
      status: 'processed',
      state: 'processed',
      message: 'BNDY finished checking the submission.',
      result: {
        artist: { name: 'The Torrists' },
      },
    }} isPolling={false} />)

    expect(screen.getByRole('heading', { name: 'Here’s what we found' })).toBeInTheDocument()
    expect(screen.getByText('The Torrists')).toBeInTheDocument()
    expect(screen.getByText(/identified part of your submission/i)).toBeInTheDocument()
    expect(screen.getAllByText('Not confirmed')).toHaveLength(3)
  })

  it('shows every gig returned from a multi-date poster', () => {
    render(<CaptureStatus capture={{
      captureId: 'capture-gig-list',
      status: 'processed',
      state: 'added',
      message: '3 gigs added to bndy.',
      result: {
        artist: { name: 'One for the Road' },
        events: [
          { id: 'gig-1', date: '2026-10-03', time: '21:00', venue: 'The Lion Hotel', action: 'created', url: 'https://bndy.live/g/gig-1' },
          { id: 'gig-2', date: '2026-11-15', time: '19:00', venue: 'Lambs Wharf', action: 'existing', url: 'https://bndy.live/g/gig-2' },
          { id: 'gig-3', date: '2026-12-19', time: '21:00', venue: 'The Red Lion', action: 'created', url: 'https://bndy.live/g/gig-3' },
        ],
      },
    }} isPolling={false} />)

    expect(screen.getByRole('heading', { name: 'They’re on bndy' })).toBeInTheDocument()
    expect(screen.getByText('One for the Road')).toBeInTheDocument()
    expect(screen.getByText('The Lion Hotel')).toBeInTheDocument()
    expect(screen.getByText('Lambs Wharf')).toBeInTheDocument()
    expect(screen.getByText('The Red Lion')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /gig on bndy.live/i })).toHaveLength(3)
    expect(screen.getByText(/Already listed/)).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Here’s what we found' })).toBeInTheDocument()
    expect(screen.getAllByText('Not confirmed')).toHaveLength(4)
    expect(screen.getByText(/do not need to send it again/i)).toBeInTheDocument()
    expect(screen.getByText('The artist identity needs a human check.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Keep me posted' }))
    expect(onSaveFollowUp).toHaveBeenCalledWith('email', 'person@example.com')
    expect(await screen.findByText('We’ll keep you posted.')).toBeInTheDocument()
  })
})
