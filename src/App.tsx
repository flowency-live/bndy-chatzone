import { useCallback, useEffect, useRef, useState } from 'react'
import { SignalDropzone, type SignalSubmission } from './components/SignalDropzone'
import { CaptureStatus, type PublicCaptureStatus } from './components/CaptureStatus'

const CAPTURE_API_URL = 'https://capture.bndy.co.uk'
const ACTIVE_CAPTURE_KEY = 'bndy.activeCapture.v1'
const MAX_AUTOMATIC_POLL_MS = 8 * 60 * 1000
const TERMINAL_STATES = new Set([
  'added',
  'already_exists',
  'processed',
  'could_not_resolve',
  'ignored',
])

interface StoredCapture {
  captureId: string
  startedAt: number
}

function newClientSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readStoredCapture(): StoredCapture | null {
  const saved = window.sessionStorage.getItem(ACTIVE_CAPTURE_KEY)
  if (!saved) return null
  try {
    const stored = JSON.parse(saved) as StoredCapture
    if (stored.captureId && Number.isFinite(stored.startedAt)) return stored
  } catch {
    // A broken browser-session value should never block a new submission.
  }
  window.sessionStorage.removeItem(ACTIVE_CAPTURE_KEY)
  return null
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const message = typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error.replaceAll('_', ' ')
        : 'Something went wrong. Please try again.'
    throw new Error(message)
  }
  return body as T
}

function App() {
  const [initialStoredCapture] = useState<StoredCapture | null>(readStoredCapture)
  const [capture, setCapture] = useState<PublicCaptureStatus | null>(() => initialStoredCapture ? {
    captureId: initialStoredCapture.captureId,
    status: 'processing',
    state: 'processing',
    message: 'Picking up where we left off.',
  } : null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [pollPaused, setPollPaused] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const activeCaptureRef = useRef<StoredCapture | null>(null)
  const pendingSubmissionIdRef = useRef<string | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const forgetActiveCapture = useCallback(() => {
    activeCaptureRef.current = null
    window.sessionStorage.removeItem(ACTIVE_CAPTURE_KEY)
  }, [])

  const pollForResult = useCallback((stored: StoredCapture, initialDelay = 500) => {
    clearTimer()
    activeCaptureRef.current = stored
    setIsPolling(true)
    setPollPaused(false)
    setConnectionNotice(null)
    let consecutiveFailures = 0

    const schedule = (delay: number) => {
      clearTimer()
      timerRef.current = window.setTimeout(check, delay)
    }

    const pause = (notice: string | null = null) => {
      clearTimer()
      setIsPolling(false)
      setIsSubmitting(false)
      setPollPaused(true)
      setConnectionNotice(notice)
    }

    const check = async () => {
      if (Date.now() - stored.startedAt >= MAX_AUTOMATIC_POLL_MS) {
        pause()
        return
      }

      try {
        const response = await fetch(`${CAPTURE_API_URL}/v1/public/captures/${stored.captureId}`)
        const data = await jsonResponse<PublicCaptureStatus>(response)
        setCapture(data)
        consecutiveFailures = 0
        setConnectionNotice(null)

        if (TERMINAL_STATES.has(data.state)) {
          clearTimer()
          setIsPolling(false)
          setIsSubmitting(false)
          setPollPaused(false)
          forgetActiveCapture()
          return
        }

        schedule(2500)
      } catch {
        consecutiveFailures += 1
        if (consecutiveFailures >= 4) {
          pause('We lost the connection, but your submission is safe.')
          return
        }
        setConnectionNotice('Connection interrupted. Reconnecting…')
        schedule(Math.min(10_000, 2000 * consecutiveFailures))
      }
    }

    schedule(initialDelay)
  }, [clearTimer, forgetActiveCapture])

  useEffect(() => {
    const resumeTimer = initialStoredCapture
      ? window.setTimeout(() => pollForResult(initialStoredCapture, 100), 0)
      : null

    return () => {
      if (resumeTimer !== null) window.clearTimeout(resumeTimer)
      clearTimer()
    }
  }, [clearTimer, initialStoredCapture, pollForResult])

  const createCapture = async (body: Record<string, unknown>): Promise<PublicCaptureStatus> => {
    const response = await fetch(`${CAPTURE_API_URL}/v1/public/captures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return jsonResponse<PublicCaptureStatus>(response)
  }

  const handleSubmit = async (submission: SignalSubmission) => {
    setIsSubmitting(true)
    setError(null)
    setConnectionNotice(null)
    const clientSubmissionId = pendingSubmissionIdRef.current ?? newClientSubmissionId()
    pendingSubmissionIdRef.current = clientSubmissionId

    try {
      let media: Record<string, unknown> | undefined

      if (submission.base64Content && submission.mimeType && submission.fileName) {
        const blob = base64ToBlob(submission.base64Content, submission.mimeType)
        const uploadResponse = await fetch(`${CAPTURE_API_URL}/v1/public/uploads/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mimeType: submission.mimeType,
            fileName: submission.fileName,
            size: blob.size,
          }),
        })
        const upload = await jsonResponse<{
          uploadUrl: string
          fields: Record<string, string>
          media: Record<string, unknown>
        }>(uploadResponse)

        const form = new FormData()
        Object.entries(upload.fields).forEach(([key, value]) => form.append(key, value))
        form.append('file', blob, submission.fileName)

        const s3Response = await fetch(upload.uploadUrl, { method: 'POST', body: form })
        if (!s3Response.ok) throw new Error('The image upload did not finish. Please try again.')
        media = upload.media
      }

      const created = await createCapture({
        clientSubmissionId,
        ...(submission.content ? { sharedText: submission.content } : {}),
        ...(media ? { media } : {}),
      })
      pendingSubmissionIdRef.current = null
      setCapture(created)

      if (TERMINAL_STATES.has(created.state)) {
        setIsSubmitting(false)
        return
      }

      const stored = { captureId: created.captureId, startedAt: Date.now() }
      window.sessionStorage.setItem(ACTIVE_CAPTURE_KEY, JSON.stringify(stored))
      pollForResult(stored)
    } catch (submissionError) {
      setIsSubmitting(false)
      setError(submissionError instanceof Error
        ? submissionError.message
        : 'We could not send that to bndy. Please try again.')
    }
  }

  const handleCheckAgain = () => {
    const stored = activeCaptureRef.current
    if (!stored) return
    const refreshed = { ...stored, startedAt: Date.now() }
    window.sessionStorage.setItem(ACTIVE_CAPTURE_KEY, JSON.stringify(refreshed))
    pollForResult(refreshed, 0)
  }

  const handleReset = () => {
    clearTimer()
    forgetActiveCapture()
    pendingSubmissionIdRef.current = null
    setCapture(null)
    setIsSubmitting(false)
    setIsPolling(false)
    setPollPaused(false)
    setConnectionNotice(null)
    setError(null)
  }

  return (
    <div className="site-shell">
      <header className="brand-bar">
        <a className="brand" href="https://bndy.live" aria-label="bndy.live home">
          <img src="/favicon.svg" alt="" className="brand-mark" />
          <span>bndy<span className="brand-dot">.live</span></span>
        </a>
        <a className="explore-link" href="https://bndy.live">
          Explore gigs <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="intake-layout">
        <section className="hero-copy" aria-labelledby="page-title">
          <p className="eyebrow">SEND TO BNDY</p>
          <h1 id="page-title">Know about a gig?</h1>
          <p className="hero-lead">
            Send us whatever you have. A poster, screenshot, link or event message.
          </p>
          <div className="promise-list" aria-label="What happens next">
            <div className="promise-item">
              <span className="promise-number">1</span>
              <p><strong>You send it</strong><span>No account needed.</span></p>
            </div>
            <div className="promise-item">
              <span className="promise-number">2</span>
              <p><strong>bndy checks it</strong><span>We match the artist, venue and date.</span></p>
            </div>
            <div className="promise-item">
              <span className="promise-number">3</span>
              <p><strong>The scene sees it</strong><span>New gigs join the live map.</span></p>
            </div>
          </div>
        </section>

        <section className="intake-card" aria-label="Send a gig to bndy">
          {capture ? (
            <CaptureStatus
              capture={capture}
              isPolling={isPolling}
              pollPaused={pollPaused}
              connectionNotice={connectionNotice}
              onCheckAgain={handleCheckAgain}
              onReset={handleReset}
            />
          ) : (
            <>
              <div className="card-heading">
                <p className="card-kicker">ADD WHAT YOU HAVE</p>
                <h2>Send a gig to bndy</h2>
                <p>More detail helps, but you do not need to fill in a form.</p>
              </div>
              <SignalDropzone onSubmit={handleSubmit} isSubmitting={isSubmitting} />
              {error && (
                <div className="error-message" role="alert">
                  <strong>That did not send</strong>
                  <p>{error}</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>Grassroots gig discovery, built with the people who make it happen.</p>
        <a href="https://www.bndy.co.uk/privacy">Privacy</a>
      </footer>
    </div>
  )
}

export default App
