import { useState } from 'react'
import { SignalDropzone, type SignalSubmission } from './components/SignalDropzone'
import { CaptureStatus, type PublicCaptureStatus } from './components/CaptureStatus'

const CAPTURE_API_URL = 'https://capture.bndy.co.uk'

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

async function jsonResponse(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || body.error || 'Request failed')
  return body
}

function App() {
  const [capture, setCapture] = useState<PublicCaptureStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollForResult = (captureId: string) => {
    setIsPolling(true)
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`${CAPTURE_API_URL}/v1/public/captures/${captureId}`)
        const data = await jsonResponse(response) as PublicCaptureStatus
        setCapture(data)

        if (['added', 'already_exists', 'processed', 'could_not_resolve', 'ignored'].includes(data.state)) {
          setIsPolling(false)
          setIsSubmitting(false)
          return
        }

        attempts += 1
        if (attempts < 90) {
          setTimeout(poll, 2000)
        } else {
          setIsPolling(false)
          setIsSubmitting(false)
          setError('BNDY is still processing this submission. Please try again later.')
        }
      } catch (err) {
        setIsPolling(false)
        setIsSubmitting(false)
        setError(err instanceof Error ? err.message : 'Could not check submission status')
      }
    }

    setTimeout(poll, 1000)
  }

  const createCapture = async (body: Record<string, unknown>): Promise<PublicCaptureStatus> => {
    const response = await fetch(`${CAPTURE_API_URL}/v1/public/captures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return jsonResponse(response)
  }

  const handleSubmit = async (submission: SignalSubmission) => {
    setIsSubmitting(true)
    setError(null)
    setCapture(null)

    try {
      let created: PublicCaptureStatus

      if (submission.type === 'text') {
        created = await createCapture({ sharedText: submission.content })
      } else {
        if (!submission.base64Content || !submission.mimeType || !submission.fileName) {
          throw new Error('Poster image is incomplete')
        }

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
        const upload = await jsonResponse(uploadResponse)

        const form = new FormData()
        Object.entries(upload.fields as Record<string, string>).forEach(([key, value]) => form.append(key, value))
        form.append('file', blob, submission.fileName)

        const s3Response = await fetch(upload.uploadUrl, { method: 'POST', body: form })
        if (!s3Response.ok) throw new Error('Poster upload failed')

        created = await createCapture({ media: upload.media })
      }

      setCapture(created)
      pollForResult(created.captureId)
    } catch (err) {
      setIsSubmitting(false)
      setError(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1 className="tight">Signal Dropzone</h1>
          <p>
            Drop a gig poster or paste event text, and bndy will add the event to the live music map.
          </p>
        </div>
      </header>

      <main className="container">
        <SignalDropzone onSubmit={handleSubmit} isSubmitting={isSubmitting} />

        {error && (
          <div className="error-message" style={{ marginTop: '1.5rem' }}>
            <p>{error}</p>
          </div>
        )}

        {capture && (
          <div style={{ marginTop: '1.5rem' }}>
            <CaptureStatus capture={capture} isPolling={isPolling} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
