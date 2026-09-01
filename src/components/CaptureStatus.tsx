import { useEffect, useState } from 'react'

interface PublicCaptureEvent {
  id: string
  date: string
  time: string
  venue: string
  action?: 'created' | 'existing' | string
  venueAction?: string
  url: string
}

export interface PublicCaptureStatus {
  captureId: string
  status: string
  state: 'processing' | 'added' | 'already_exists' | 'processed' | 'needs_review' | 'could_not_resolve' | 'ignored' | string
  message: string
  receivedAt?: string
  updatedAt?: string
  result?: {
    artist?: {
      name: string
      action?: string
      id?: string
    }
    event?: PublicCaptureEvent
    events?: PublicCaptureEvent[]
  }
  clarification?: {
    type: 'confirm_new_artist'
    artistName: string
    location: string
    prompt: string
  }
  requestArtistLinks?: boolean
}

interface CaptureStatusProps {
  capture: PublicCaptureStatus
  isPolling: boolean
  pollPaused?: boolean
  connectionNotice?: string | null
  processingInputKind?: ProcessingInputKind
  onCheckAgain?: () => void
  onSaveFollowUp?: (method: 'email' | 'whatsapp', value: string) => Promise<void>
  onConfirmClarification?: () => Promise<void>
  onSaveArtistLinks?: (urls: string[]) => Promise<void>
  onReset?: () => void
}

export type ProcessingInputKind = 'poster' | 'text' | 'unknown'

const PROCESSING_STORIES: Record<ProcessingInputKind, string[]> = {
  poster: [
    'Got it. Your poster is safe.',
    'Reading the names, place and date…',
    'Checking whether this gig is already on bndy…',
    'Untangling the internet’s finest poster typography…',
    'If AI made this poster, AI is now taking it apart. Fair’s fair.',
    'Still checking. Your submission is safe.',
  ],
  text: [
    'Got it. Your message is safe.',
    'Finding the artist, venue and date…',
    'Checking whether this gig is already on bndy…',
    'Cross-checking the details, not guessing…',
    'Still checking. Your submission is safe.',
  ],
  unknown: [
    'Got it. Your submission is safe.',
    'Finding the artist, venue and date…',
    'Checking whether this gig is already on bndy…',
    'Cross-checking the details, not guessing…',
    'Still checking. Your submission is safe.',
  ],
}

const STORY_INTERVAL_MS = 2300

function ProcessingStory({ inputKind }: { inputKind: ProcessingInputKind }) {
  const [step, setStep] = useState(0)
  const messages = PROCESSING_STORIES[inputKind]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => current < messages.length - 1 ? current + 1 : Math.min(3, messages.length - 1))
    }, STORY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [inputKind, messages.length])

  return (
    <div className="processing-story">
      <span className="processing-story-label" aria-hidden="true"><i /> LIVE CHECK</span>
      <span className="processing-story-line" aria-hidden="true" key={`${inputKind}-${step}`}>
        {messages[step]}
      </span>
      <span className="visually-hidden">Your submission is safely received and being checked.</span>
    </div>
  )
}

interface StatusCopy {
  eyebrow: string
  title: string
  detail: string
  tone: 'working' | 'success' | 'neutral' | 'attention'
}

const STATUS_COPY: Record<string, StatusCopy> = {
  processing: {
    eyebrow: 'SUBMISSION RECEIVED',
    title: 'bndy is checking it',
    detail: 'We are matching the artist, venue and date, then checking whether the gig is already listed.',
    tone: 'working',
  },
  added: {
    eyebrow: 'GIG ADDED',
    title: 'It’s on bndy',
    detail: 'Thanks. You have helped more people find live music.',
    tone: 'success',
  },
  already_exists: {
    eyebrow: 'GIG MATCHED',
    title: 'Already on bndy',
    detail: 'Good spot. We found the same gig and avoided adding a duplicate.',
    tone: 'success',
  },
  processed: {
    eyebrow: 'CHECK COMPLETE',
    title: 'All checked',
    detail: 'bndy has finished checking your submission.',
    tone: 'neutral',
  },
  needs_review: {
    eyebrow: 'WE’VE GOT IT',
    title: 'A human needs to check this one',
    detail: 'Your submission is safely kept and you do not need to send it again.',
    tone: 'attention',
  },
  could_not_resolve: {
    eyebrow: 'NEEDS MORE DETAIL',
    title: 'We could not add this one yet',
    detail: 'There was not enough reliable information to identify the gig automatically.',
    tone: 'attention',
  },
  ignored: {
    eyebrow: 'NOT ADDED',
    title: 'We could not find a gig in that',
    detail: 'Try again with a poster, event link, artist, venue and date if you have them.',
    tone: 'attention',
  },
}

function ResultIcon({ tone, working }: { tone: StatusCopy['tone']; working: boolean }) {
  if (working) return <span className="result-spinner" aria-hidden="true" />

  if (tone === 'success') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 4.2 4.2L19.5 6.5" />
      </svg>
    )
  }

  if (tone === 'attention') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 12.5 10 15l7-7" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function FindingRow({ label, value, confirmed = true }: { label: string; value?: string; confirmed?: boolean }) {
  return (
    <div className="finding-row">
      <dt>{label}</dt>
      <dd className={confirmed && value ? '' : 'finding-unconfirmed'}>{confirmed && value ? value : 'Not confirmed'}</dd>
    </div>
  )
}

export function CaptureStatus({
  capture,
  isPolling,
  pollPaused = false,
  connectionNotice,
  processingInputKind = 'unknown',
  onCheckAgain,
  onSaveFollowUp,
  onConfirmClarification,
  onSaveArtistLinks,
  onReset,
}: CaptureStatusProps) {
  const event = capture.result?.event ?? (capture.result?.events?.length === 1 ? capture.result.events[0] : undefined)
  const events = capture.result?.events?.length ? capture.result.events : event ? [event] : []
  const multipleEvents = events.length > 1
  const baseCopy = STATUS_COPY[capture.state] ?? STATUS_COPY.processed
  const copy = capture.state === 'added' && multipleEvents
    ? { ...baseCopy, eyebrow: 'GIGS ADDED', title: 'They’re on bndy' }
    : baseCopy
  const artist = capture.result?.artist
  const working = capture.state === 'processing'
  const [followUpMethod, setFollowUpMethod] = useState<'email' | 'whatsapp'>('email')
  const [followUpValue, setFollowUpValue] = useState('')
  const [followUpState, setFollowUpState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [followUpError, setFollowUpError] = useState('')
  const [clarificationState, setClarificationState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [artistLinks, setArtistLinks] = useState('')
  const [artistLinksState, setArtistLinksState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [artistLinksError, setArtistLinksError] = useState('')
  const detail = pollPaused
    ? 'This is taking longer than usual. Your submission is safe, and you can check it again here.'
    : copy.detail

  const saveFollowUp = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!onSaveFollowUp || !followUpValue.trim()) return
    setFollowUpState('saving')
    setFollowUpError('')
    try {
      await onSaveFollowUp(followUpMethod, followUpValue.trim())
      setFollowUpState('saved')
    } catch (error) {
      setFollowUpState('error')
      setFollowUpError(error instanceof Error ? error.message : 'We could not save that contact detail.')
    }
  }

  const confirmClarification = async () => {
    if (!onConfirmClarification) return
    setClarificationState('saving')
    try {
      await onConfirmClarification()
    } catch {
      setClarificationState('error')
    }
  }

  const saveArtistLinks = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!onSaveArtistLinks) return
    const urls = artistLinks.split(/[\n,]+/).map(value => value.trim()).filter(Boolean)
    if (!urls.length) return
    setArtistLinksState('saving')
    setArtistLinksError('')
    try {
      await onSaveArtistLinks(urls)
      setArtistLinksState('saved')
    } catch (error) {
      setArtistLinksState('error')
      setArtistLinksError(error instanceof Error ? error.message : 'We could not save those links.')
    }
  }

  return (
    <div className={`capture-status tone-${copy.tone}`} aria-live="polite">
      <div className="result-heading">
        <span className="result-icon"><ResultIcon tone={copy.tone} working={working && isPolling} /></span>
        <div>
          <p className="card-kicker">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{detail}</p>
        </div>
      </div>

      {working && (
        <div className="progress-track" aria-label="Submission progress">
          <div className="progress-step complete"><span />Received</div>
          <div className={`progress-step ${isPolling ? 'active' : ''}`}><span />Checking</div>
          <div className="progress-step"><span />Result</div>
        </div>
      )}

      {connectionNotice && <p className="connection-notice">{connectionNotice}</p>}

      {working && isPolling && <ProcessingStory inputKind={processingInputKind} />}

      {!working && (
        <section className="capture-findings" aria-labelledby="capture-findings-title">
          <div className="capture-findings-heading">
            <p className="card-kicker">CAPTURE RESULT</p>
            <h3 id="capture-findings-title">Here’s what we found</h3>
            <p>
              {multipleEvents
                ? `These are the ${events.length} gigs bndy matched from your submission.`
                : event
                ? 'These are the gig details bndy matched from your submission.'
                : artist
                  ? 'We identified part of your submission, but could not confirm the complete gig.'
                  : 'We could not safely confirm the gig details from this submission.'}
            </p>
          </div>
          {multipleEvents ? (
            <>
              <dl className="capture-findings-list capture-findings-artist">
                <FindingRow label="Artist" value={artist?.name} />
              </dl>
              <div className="capture-gig-list">
                {events.map((gig) => (
                  <article className="capture-gig-row" key={gig.id}>
                    <div>
                      <span className="capture-gig-date">{formatDate(gig.date)}</span>
                      <strong>{gig.venue}</strong>
                      <span className="capture-gig-meta">
                        {gig.time} · {gig.action === 'existing' ? 'Already listed' : 'Added'}
                      </span>
                    </div>
                    <a href={gig.url} target="_blank" rel="noreferrer" aria-label={`View ${gig.venue} gig on bndy.live`}>
                      View gig <span aria-hidden="true">↗</span>
                    </a>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <dl className="capture-findings-list">
              <FindingRow label="Artist" value={artist?.name} />
              <FindingRow label="Venue" value={event?.venue} />
              <FindingRow label="Date" value={event?.date ? formatDate(event.date) : undefined} />
              <FindingRow label="Time" value={event?.time} />
            </dl>
          )}
        </section>
      )}

      {!event && !working && capture.message && capture.message !== copy.detail && (
        <p className="capture-message">{capture.message}</p>
      )}

      {capture.state === 'needs_review' && capture.clarification?.type === 'confirm_new_artist' && onConfirmClarification && (
        <div className="follow-up-card clarification-card">
          <div className="follow-up-heading">
            <strong>Quick identity check</strong>
            <span>{capture.clarification.prompt}</span>
          </div>
          <button className="clarification-confirm" type="button" onClick={confirmClarification} disabled={clarificationState === 'saving'}>
            {clarificationState === 'saving' ? 'Confirming…' : `Yes, this is a different ${capture.clarification.location} artist`}
          </button>
          <p className="follow-up-privacy">We will use that confirmation to create the correct artist, then continue this submission.</p>
          {clarificationState === 'error' && <p className="follow-up-error" role="alert">We could not save that confirmation. Please try again.</p>}
        </div>
      )}

      {capture.requestArtistLinks && artist?.action === 'created' && onSaveArtistLinks && (
        <div className="follow-up-card artist-links-card">
          {artistLinksState === 'saved' ? (
            <div className="follow-up-saved" role="status">
              <strong>Thanks, we’ve got the links.</strong>
              <span>They will be added to {artist.name} without changing the gigs you just submitted.</span>
            </div>
          ) : (
            <form onSubmit={saveArtistLinks}>
              <div className="follow-up-heading">
                <strong>Know this artist?</strong>
                <span>Facebook is not required. If you have their website, Instagram, YouTube or another official profile, add it here.</span>
              </div>
              <div className="artist-links-entry">
                <label className="visually-hidden" htmlFor="artist-profile-links">Artist website or social profile URLs</label>
                <textarea
                  id="artist-profile-links"
                  rows={2}
                  value={artistLinks}
                  onChange={(event) => setArtistLinks(event.target.value)}
                  placeholder="https://instagram.com/…"
                  required
                />
                <button type="submit" disabled={artistLinksState === 'saving'}>{artistLinksState === 'saving' ? 'Saving…' : 'Add links'}</button>
              </div>
              <p className="follow-up-privacy">Optional. One link per line, up to five.</p>
              {artistLinksState === 'error' && <p className="follow-up-error" role="alert">{artistLinksError}</p>}
            </form>
          )}
        </div>
      )}

      {capture.state === 'needs_review' && !capture.clarification && onSaveFollowUp && (
        <div className="follow-up-card">
          {followUpState === 'saved' ? (
            <div className="follow-up-saved" role="status">
              <strong>We’ll keep you posted.</strong>
              <span>We will use that {followUpMethod === 'email' ? 'email address' : 'WhatsApp number'} only for this submission.</span>
            </div>
          ) : (
            <form onSubmit={saveFollowUp}>
              <div className="follow-up-heading">
                <strong>Want to know what happens?</strong>
                <span>Leave one contact detail and we’ll update you after the human check.</span>
              </div>
              <div className="follow-up-methods" aria-label="How should bndy contact you?">
                <button type="button" className={followUpMethod === 'email' ? 'active' : ''} onClick={() => setFollowUpMethod('email')}>Email</button>
                <button type="button" className={followUpMethod === 'whatsapp' ? 'active' : ''} onClick={() => setFollowUpMethod('whatsapp')}>WhatsApp</button>
              </div>
              <div className="follow-up-entry">
                <label className="visually-hidden" htmlFor="follow-up-contact">{followUpMethod === 'email' ? 'Email address' : 'WhatsApp number'}</label>
                <input
                  id="follow-up-contact"
                  type={followUpMethod === 'email' ? 'email' : 'tel'}
                  inputMode={followUpMethod === 'email' ? 'email' : 'tel'}
                  autoComplete={followUpMethod === 'email' ? 'email' : 'tel'}
                  required
                  value={followUpValue}
                  onChange={(event) => setFollowUpValue(event.target.value)}
                  placeholder={followUpMethod === 'email' ? 'you@example.com' : '07… or +44…'}
                />
                <button type="submit" disabled={followUpState === 'saving'}>{followUpState === 'saving' ? 'Saving…' : 'Keep me posted'}</button>
              </div>
              <p className="follow-up-privacy">Only for this submission. No account, no marketing.</p>
              {followUpState === 'error' && <p className="follow-up-error" role="alert">{followUpError}</p>}
            </form>
          )}
        </div>
      )}

      <div className="result-actions">
        {event?.url && (
          <a className="primary-button" href={event.url} target="_blank" rel="noreferrer">
            View gig on bndy.live <span aria-hidden="true">↗</span>
          </a>
        )}
        {pollPaused && onCheckAgain && (
          <button type="button" className="primary-button" onClick={onCheckAgain}>Check again</button>
        )}
        {!working && onReset && (
          <button type="button" className={events.length ? 'secondary-button' : 'primary-button'} onClick={onReset}>
            Send another
          </button>
        )}
        {pollPaused && onReset && (
          <button type="button" className="text-button" onClick={onReset}>Send something else</button>
        )}
      </div>

      {working && !pollPaused && (
        <p className="safe-to-leave">You can close this page. We will pick up the result when you return on this device.</p>
      )}

      <details className="capture-reference">
        <summary>Submission reference</summary>
        <code>{capture.captureId}</code>
      </details>
    </div>
  )
}
