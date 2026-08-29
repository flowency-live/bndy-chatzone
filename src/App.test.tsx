import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function apiResponse(body: Record<string, unknown>, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  })
}

describe('App', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the Send to bndy experience', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Know about a gig?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Send a gig to bndy' })).toBeInTheDocument()
    expect(screen.getByText(/poster, screenshot, link or event message/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
  })

  it('submits event text to the public Capture API', async () => {
    const mockFetch = vi.fn().mockImplementation(() => apiResponse({
      captureId: 'capture-123',
      status: 'processed',
      state: 'added',
      message: 'Added to bndy.',
    }))
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    fireEvent.change(screen.getByPlaceholderText(/paste a facebook link/i), {
      target: { value: 'Pistachio Nuts live at Briton Ferry Workies' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send to bndy/i }))

    expect(await screen.findByRole('heading', { name: 'It’s on bndy' })).toBeInTheDocument()
    const captureCall = mockFetch.mock.calls.find(([url]) => url.endsWith('/v1/public/captures'))
    if (!captureCall) throw new Error('Capture request was not made')
    const [, options] = captureCall
    const body = JSON.parse(options.body)
    expect(body.sharedText).toBe('Pistachio Nuts live at Briton Ferry Workies')
    expect(body.clientSubmissionId).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })

  it('sends an image and supporting text together', async () => {
    const media = {
      type: 'image',
      bucket: 'capture-images',
      key: 'captures/public/poster.png',
      mimeType: 'image/png',
    }
    const mockFetch = vi.fn()
      .mockImplementationOnce(() => apiResponse({
        uploadUrl: 'https://uploads.example.test',
        fields: { key: 'captures/public/poster.png' },
        media,
      }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true }))
      .mockImplementationOnce(() => apiResponse({
        captureId: 'capture-image-1',
        status: 'processed',
        state: 'added',
        message: 'Added to bndy.',
      }))
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const file = new File(['poster pixels'], 'poster.png', { type: 'image/png' })
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file] } })
    await screen.findByRole('img', { name: /selected gig poster preview/i })
    fireEvent.change(screen.getByPlaceholderText(/paste a facebook link/i), {
      target: { value: 'Doors are at 7.30pm' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send to bndy/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
    const [, options] = mockFetch.mock.calls[2]
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      clientSubmissionId: expect.any(String),
      sharedText: 'Doors are at 7.30pm',
      media,
    }))
  })

  it('shows a useful API error without clearing the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => apiResponse({
      message: 'Too many submissions. Please try again shortly.',
    }, false)))

    render(<App />)
    const textarea = screen.getByPlaceholderText(/paste a facebook link/i)
    fireEvent.change(textarea, { target: { value: 'Test event' } })
    fireEvent.click(screen.getByRole('button', { name: /send to bndy/i }))

    expect(await screen.findByText(/too many submissions/i)).toBeInTheDocument()
    expect(textarea).toHaveValue('Test event')
  })

  it('reuses the idempotency key when a failed request is retried', async () => {
    const mockFetch = vi.fn()
      .mockImplementationOnce(() => apiResponse({ message: 'Temporary failure' }, false))
      .mockImplementationOnce(() => apiResponse({
        captureId: 'capture-retry',
        status: 'processed',
        state: 'added',
        message: 'Added to bndy.',
      }))
    vi.stubGlobal('fetch', mockFetch)
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText(/paste a facebook link/i), { target: { value: 'Test event' } })

    fireEvent.click(screen.getByRole('button', { name: /send to bndy/i }))
    await screen.findByText('Temporary failure')
    fireEvent.click(screen.getByRole('button', { name: /send to bndy/i }))
    await screen.findByRole('heading', { name: 'It’s on bndy' })

    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(secondBody.clientSubmissionId).toBe(firstBody.clientSubmissionId)
  })

  it('resumes an active submission after refresh', async () => {
    window.sessionStorage.setItem('bndy.activeCapture.v1', JSON.stringify({
      captureId: 'capture-resume',
      startedAt: Date.now(),
    }))
    const mockFetch = vi.fn().mockImplementation(() => apiResponse({
      captureId: 'capture-resume',
      status: 'processed',
      state: 'already_exists',
      message: 'Already in bndy.',
    }))
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Already on bndy' }, { timeout: 2000 })).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith('https://capture.bndy.co.uk/v1/public/captures/capture-resume')
    expect(window.sessionStorage.getItem('bndy.activeCapture.v1')).toBeNull()
  })
})
