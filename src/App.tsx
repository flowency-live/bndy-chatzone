import { useState } from 'react'
import { SignalDropzone, type SignalSubmission } from './components/SignalDropzone'
import { SignalStatus, type Signal, type Interpretation } from './components/SignalStatus'
import { ClaimsList, type Claim } from './components/ClaimsList'

const API_URL = 'https://9tq7w39hb2.execute-api.eu-west-2.amazonaws.com/dev'

interface SignalResponse {
  signal: Signal
  interpretation?: Interpretation
  claims: Claim[]
}

function App() {
  const [currentSignal, setCurrentSignal] = useState<SignalResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (submission: SignalSubmission) => {
    setIsSubmitting(true)
    setError(null)
    setCurrentSignal(null)

    try {
      let body: Record<string, unknown>

      if (submission.type === 'text') {
        body = {
          signalType: 'text_paste',
          content: submission.content,
        }
      } else {
        body = {
          signalType: 'image',
          base64Content: submission.base64Content,
          fileName: submission.fileName,
          mimeType: submission.mimeType,
        }
      }

      const response = await fetch(`${API_URL}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create signal')
      }

      const { signalId } = await response.json()
      setIsPolling(true)
      pollForResult(signalId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsSubmitting(false)
    }
  }

  const pollForResult = async (signalId: string) => {
    const maxAttempts = 60
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/signals/${signalId}`)
        const data: SignalResponse = await response.json()

        setCurrentSignal(data)

        if (data.signal.status === 'pending_review' || data.signal.status === 'failed') {
          setIsPolling(false)
          setIsSubmitting(false)
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        } else {
          setIsPolling(false)
          setIsSubmitting(false)
          setError('Timeout waiting for interpretation')
        }
      } catch (err) {
        setIsPolling(false)
        setIsSubmitting(false)
        setError(err instanceof Error ? err.message : 'Polling failed')
      }
    }

    poll()
  }

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1 className="tight">Signal Dropzone</h1>
          <p>
            Drop a gig poster or paste event text, and bndy will interpret what it means for the live music world.
          </p>
        </div>
      </header>

      <main className="container">
        <SignalDropzone
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        {error && (
          <div className="error-message" style={{ marginTop: '1.5rem' }}>
            <p>{error}</p>
          </div>
        )}

        {currentSignal && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SignalStatus
              signal={currentSignal.signal}
              interpretation={currentSignal.interpretation}
              isPolling={isPolling}
            />

            {currentSignal.claims.length > 0 && (
              <ClaimsList
                claims={currentSignal.claims}
                uncertainties={currentSignal.interpretation?.uncertainties}
                signalId={currentSignal.signal.signalId}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
