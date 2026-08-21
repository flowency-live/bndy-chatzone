export interface Signal {
  signalId: string
  status: string
  signalType: string
  receivedAt: string
}

export interface Interpretation {
  interpretationId: string
  llmInterpretation: {
    reasoning: string
    modelUsed: string
  }
  sourceCost: {
    modelCost: number
    tokensIn: number
    tokensOut: number
    runtimeMs: number
  }
  uncertainties: string[]
}

interface SignalStatusProps {
  signal: Signal
  interpretation?: Interpretation
  isPolling: boolean
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Signal Received',
  extracting: 'Extracting Content...',
  interpreting: 'Interpreting...',
  pending_review: 'Ready for Review',
  failed: 'Failed',
}

function formatModelName(modelUsed: string): string {
  // Extract meaningful part from model ID like "anthropic.claude-3-5-sonnet-20240620-v1:0"
  const parts = modelUsed.split('.')
  const lastPart = parts[parts.length - 1] || modelUsed
  return lastPart
    .replace(/-\d{8}-v\d+:\d+$/, '') // Remove date and version suffix
    .replace(/-/g, ' ') // Replace dashes with spaces
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

export function SignalStatus({ signal, interpretation, isPolling }: SignalStatusProps) {
  const statusLabel = STATUS_LABELS[signal.status] || signal.status
  const statusDotClasses = [
    'status-dot',
    signal.status,
    isPolling ? 'pulse' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="panel">
      <div className="status-header">
        <div className="status-label">
          <span
            data-testid="status-dot"
            className={statusDotClasses}
          />
          <span>{statusLabel}</span>
        </div>
        <code className="signal-id">{signal.signalId}</code>
      </div>

      {interpretation && (
        <div>
          <p className="interpretation-text">
            {interpretation.llmInterpretation.reasoning}
          </p>

          <div className="metrics-grid">
            <div>
              <p className="metric-label">Model</p>
              <p className="metric-value">
                {formatModelName(interpretation.llmInterpretation.modelUsed)}
              </p>
            </div>
            <div>
              <p className="metric-label">Cost</p>
              <p className="metric-value cost">
                {formatCost(interpretation.sourceCost.modelCost)}
              </p>
            </div>
            <div>
              <p className="metric-label">Tokens</p>
              <p className="metric-value">
                {interpretation.sourceCost.tokensIn} in / {interpretation.sourceCost.tokensOut} out
              </p>
            </div>
            <div>
              <p className="metric-label">Time</p>
              <p className="metric-value">
                {formatTime(interpretation.sourceCost.runtimeMs)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
