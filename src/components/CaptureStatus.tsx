export interface PublicCaptureStatus {
  captureId: string
  status: string
  state: 'processing' | 'added' | 'already_exists' | 'processed' | 'could_not_resolve' | 'ignored' | string
  message: string
  receivedAt?: string
  updatedAt?: string
  result?: {
    artist?: {
      name: string
      action?: string
      id?: string
    }
    event?: {
      id: string
      date: string
      time: string
      venue: string
      action?: 'created' | 'existing' | string
      venueAction?: string
      url: string
    }
  }
}

interface CaptureStatusProps {
  capture: PublicCaptureStatus
  isPolling: boolean
}

const STATUS_LABELS: Record<string, string> = {
  processing: 'Processing',
  added: 'Added to bndy',
  already_exists: 'Already in bndy',
  processed: 'Processed',
  could_not_resolve: 'Could not resolve',
  ignored: 'Not recognised as a gig',
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export function CaptureStatus({ capture, isPolling }: CaptureStatusProps) {
  const label = STATUS_LABELS[capture.state] || capture.state
  const statusDotClasses = [
    'status-dot',
    capture.state,
    isPolling ? 'pulse' : '',
  ].filter(Boolean).join(' ')
  const event = capture.result?.event
  const artist = capture.result?.artist

  return (
    <div className="panel">
      <div className="status-header">
        <div className="status-label">
          <span data-testid="status-dot" className={statusDotClasses} />
          <span>{label}</span>
        </div>
        <code className="signal-id">{capture.captureId}</code>
      </div>

      {event ? (
        <div className="capture-result">
          {artist?.name && <h3 style={{ margin: '0 0 0.5rem' }}>{artist.name}</h3>}
          <p className="interpretation-text" style={{ marginBottom: '0.35rem' }}>
            <strong>{event.venue}</strong>
          </p>
          <p className="interpretation-text" style={{ marginTop: 0 }}>
            {formatDate(event.date)} · {event.time}
          </p>
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="button button-primary"
            style={{ display: 'inline-block', marginTop: '0.5rem' }}
          >
            View gig on bndy.live
          </a>
        </div>
      ) : (
        <p className="interpretation-text">{capture.message}</p>
      )}
    </div>
  )
}
