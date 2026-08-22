export interface PublicCaptureStatus {
  captureId: string
  status: string
  state: 'processing' | 'added' | 'already_exists' | 'processed' | 'could_not_resolve' | 'ignored' | string
  message: string
  receivedAt?: string
  updatedAt?: string
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

export function CaptureStatus({ capture, isPolling }: CaptureStatusProps) {
  const label = STATUS_LABELS[capture.state] || capture.state
  const statusDotClasses = [
    'status-dot',
    capture.state,
    isPolling ? 'pulse' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="panel">
      <div className="status-header">
        <div className="status-label">
          <span data-testid="status-dot" className={statusDotClasses} />
          <span>{label}</span>
        </div>
        <code className="signal-id">{capture.captureId}</code>
      </div>
      <p className="interpretation-text">{capture.message}</p>
    </div>
  )
}
