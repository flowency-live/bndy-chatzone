import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the public Dropzone', () => {
    render(<App />)
    expect(screen.getByText('Signal Dropzone')).toBeInTheDocument()
    expect(screen.getByText(/add the event to the live music map/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
  })

  it('submits pasted text to the public Capture API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        captureId: 'capture-123',
        status: 'unprocessed',
        state: 'processing',
        message: 'BNDY is processing your submission.',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    fireEvent.change(screen.getByPlaceholderText(/paste facebook event text/i), {
      target: { value: 'Pistachio Nuts live at Briton Ferry Workies' },
    })
    fireEvent.click(screen.getByRole('button', { name: /interpret text/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://capture.bndy.co.uk/v1/public/captures',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sharedText: 'Pistachio Nuts live at Briton Ferry Workies' }),
        })
      )
    })

    expect(await screen.findByText('capture-123')).toBeInTheDocument()
  })

  it('shows a terminal Capture result after polling', async () => {
    vi.useFakeTimers()
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          captureId: 'capture-456', status: 'unprocessed', state: 'processing', message: 'Processing',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          captureId: 'capture-456', status: 'processed', state: 'added', message: 'Added to bndy.',
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    fireEvent.change(screen.getByPlaceholderText(/paste facebook event text/i), { target: { value: 'Test event' } })
    fireEvent.click(screen.getByRole('button', { name: /interpret text/i }))

    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1100)

    expect(await screen.findByText('Added to bndy')).toBeInTheDocument()
    expect(screen.getByText('Added to bndy.')).toBeInTheDocument()
  })

  it('shows Capture API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Too many submissions. Please try again shortly.' }),
    }))

    render(<App />)
    fireEvent.change(screen.getByPlaceholderText(/paste facebook event text/i), { target: { value: 'Test event' } })
    fireEvent.click(screen.getByRole('button', { name: /interpret text/i }))

    expect(await screen.findByText(/too many submissions/i)).toBeInTheDocument()
  })
})
