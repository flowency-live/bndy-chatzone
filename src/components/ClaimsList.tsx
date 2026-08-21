import { useState } from 'react'

export interface Claim {
  claimId: string
  claimType: string
  subject: string
  predicate: string
  object?: string
  value?: string
  strength: 'weak' | 'moderate' | 'strong'
  strengthReasoning: string
  status: string
}

interface ClaimsListProps {
  claims: Claim[]
  uncertainties?: string[]
  signalId: string
  onClaimReviewed?: (claimId: string, status: string) => void
}

const API_URL = 'https://9tq7w39hb2.execute-api.eu-west-2.amazonaws.com/dev'

const CLAIM_TYPE_LABELS: Record<string, string> = {
  event_exists: 'Event',
  artist_performs: 'Performance',
  venue_hosts: 'Hosting',
  event_date: 'Date',
  event_time: 'Time',
  artist_exists: 'Artist',
  venue_exists: 'Venue',
  ticket_source: 'Tickets',
}

const CLAIM_TYPE_ICONS: Record<string, string> = {
  event_exists: '🎵',
  artist_performs: '🎤',
  venue_hosts: '🏠',
  event_date: '📅',
  event_time: '🕗',
  artist_exists: '👤',
  venue_exists: '📍',
  ticket_source: '🎟️',
}

export function ClaimsList({ claims, uncertainties, signalId, onClaimReviewed }: ClaimsListProps) {
  const [claimStatuses, setClaimStatuses] = useState<Record<string, string>>({})
  const [reviewingClaim, setReviewingClaim] = useState<string | null>(null)
  const [challengeReason, setChallengeReason] = useState('')
  const [showChallengeInput, setShowChallengeInput] = useState<string | null>(null)

  const reviewClaim = async (claimId: string, action: 'accept' | 'reject' | 'challenge', reason?: string) => {
    setReviewingClaim(claimId)
    try {
      const response = await fetch(`${API_URL}/signals/${signalId}/claims/${claimId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })

      if (response.ok) {
        const result = await response.json()
        setClaimStatuses((prev) => ({ ...prev, [claimId]: result.status }))
        onClaimReviewed?.(claimId, result.status)
        setShowChallengeInput(null)
        setChallengeReason('')
      }
    } catch {
      // Error handling - silently fail for now
    } finally {
      setReviewingClaim(null)
    }
  }

  return (
    <div className="panel">
      <h2 className="claims-header">
        Claims ({claims.length})
      </h2>

      <div>
        {claims.map((claim) => {
          const currentStatus = claimStatuses[claim.claimId] || claim.status
          const isReviewed = currentStatus !== 'proposed'
          const isReviewing = reviewingClaim === claim.claimId

          const claimCardClasses = [
            'claim-card',
            claim.strength,
            isReviewed ? 'reviewed' : '',
          ].filter(Boolean).join(' ')

          return (
            <div
              key={claim.claimId}
              data-testid={`claim-card-${claim.claimId}`}
              className={claimCardClasses}
            >
              <div className="claim-header">
                <span className="claim-icon">
                  {CLAIM_TYPE_ICONS[claim.claimType] || '📋'}
                </span>
                <span className="claim-type">
                  {CLAIM_TYPE_LABELS[claim.claimType] || claim.claimType}
                </span>
                <span className={`claim-strength ${claim.strength}`}>
                  {claim.strength}
                </span>
                {isReviewed && (
                  <span className={`claim-status ${currentStatus}`}>
                    {currentStatus}
                  </span>
                )}
              </div>

              <p className="claim-content">
                {claim.subject}
                {claim.predicate && (
                  <span className="claim-predicate">
                    {claim.predicate.replace(/_/g, ' ')}
                  </span>
                )}
                {claim.object && (
                  <span>{claim.object}</span>
                )}
                {claim.value && (
                  <span className="claim-value">{claim.value}</span>
                )}
              </p>

              <p className="claim-reasoning">
                {claim.strengthReasoning}
              </p>

              {/* Challenge input */}
              {showChallengeInput === claim.claimId && (
                <div className="challenge-form">
                  <input
                    type="text"
                    value={challengeReason}
                    onChange={(e) => setChallengeReason(e.target.value)}
                    placeholder="Why is this wrong?"
                    className="input"
                  />
                  <button
                    type="button"
                    onClick={() => reviewClaim(claim.claimId, 'challenge', challengeReason)}
                    disabled={!challengeReason || isReviewing}
                    className="btn btn-warning btn-sm"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowChallengeInput(null); setChallengeReason('') }}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Review buttons */}
              {!isReviewed && showChallengeInput !== claim.claimId && (
                <div className="claim-actions">
                  <button
                    type="button"
                    onClick={() => reviewClaim(claim.claimId, 'accept')}
                    disabled={isReviewing}
                    className="btn btn-success btn-sm"
                  >
                    {isReviewing ? '...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewClaim(claim.claimId, 'reject')}
                    disabled={isReviewing}
                    className="btn btn-danger btn-sm"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChallengeInput(claim.claimId)}
                    disabled={isReviewing}
                    className="btn btn-warning btn-sm"
                  >
                    Challenge
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {uncertainties && uncertainties.length > 0 && (
        <div className="uncertainties">
          <h3 className="uncertainties-header">
            <span>⚠️</span> Uncertainties
          </h3>
          <ul>
            {uncertainties.map((uncertainty, i) => (
              <li key={i} className="uncertainty-item">
                <span className="uncertainty-bullet">•</span>
                {uncertainty}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
