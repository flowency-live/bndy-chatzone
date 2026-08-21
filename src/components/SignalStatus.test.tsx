import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SignalStatus } from './SignalStatus'
import type { Signal, Interpretation } from './SignalStatus'

describe('SignalStatus', () => {
  const baseSignal: Signal = {
    signalId: 'sig_123abc',
    status: 'received',
    signalType: 'text_paste',
    receivedAt: '2024-01-15T10:30:00Z',
  }

  const baseInterpretation: Interpretation = {
    interpretationId: 'int_456def',
    llmInterpretation: {
      reasoning: 'This appears to be a live music event announcement.',
      modelUsed: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    },
    sourceCost: {
      modelCost: 0.0123,
      tokensIn: 500,
      tokensOut: 150,
      runtimeMs: 2500,
    },
    uncertainties: [],
  }

  describe('rendering', () => {
    it('renders the signal ID', () => {
      render(<SignalStatus signal={baseSignal} isPolling={false} />)

      expect(screen.getByText('sig_123abc')).toBeInTheDocument()
    })

    it('renders the status label for received', () => {
      render(<SignalStatus signal={baseSignal} isPolling={false} />)

      expect(screen.getByText('Signal Received')).toBeInTheDocument()
    })

    it('renders the status label for extracting', () => {
      const signal = { ...baseSignal, status: 'extracting' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      expect(screen.getByText('Extracting Content...')).toBeInTheDocument()
    })

    it('renders the status label for interpreting', () => {
      const signal = { ...baseSignal, status: 'interpreting' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      expect(screen.getByText('Interpreting...')).toBeInTheDocument()
    })

    it('renders the status label for pending_review', () => {
      const signal = { ...baseSignal, status: 'pending_review' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      expect(screen.getByText('Ready for Review')).toBeInTheDocument()
    })

    it('renders the status label for failed', () => {
      const signal = { ...baseSignal, status: 'failed' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('renders unknown status as-is', () => {
      const signal = { ...baseSignal, status: 'unknown_status' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      expect(screen.getByText('unknown_status')).toBeInTheDocument()
    })
  })

  describe('status indicator', () => {
    it('shows status dot with correct class for received', () => {
      render(<SignalStatus signal={baseSignal} isPolling={false} />)

      const statusDot = screen.getByTestId('status-dot')
      expect(statusDot).toHaveClass('received')
    })

    it('shows status dot with correct class for failed', () => {
      const signal = { ...baseSignal, status: 'failed' }
      render(<SignalStatus signal={signal} isPolling={false} />)

      const statusDot = screen.getByTestId('status-dot')
      expect(statusDot).toHaveClass('failed')
    })

    it('shows pulse animation when polling', () => {
      render(<SignalStatus signal={baseSignal} isPolling={true} />)

      const statusDot = screen.getByTestId('status-dot')
      expect(statusDot).toHaveClass('pulse')
    })

    it('does not show pulse animation when not polling', () => {
      render(<SignalStatus signal={baseSignal} isPolling={false} />)

      const statusDot = screen.getByTestId('status-dot')
      expect(statusDot).not.toHaveClass('pulse')
    })
  })

  describe('interpretation display', () => {
    it('does not render interpretation section when no interpretation provided', () => {
      render(<SignalStatus signal={baseSignal} isPolling={false} />)

      expect(screen.queryByText(/this appears to be/i)).not.toBeInTheDocument()
    })

    it('renders interpretation reasoning when provided', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText('This appears to be a live music event announcement.')).toBeInTheDocument()
    })

    it('renders model name from interpretation', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText(/claude 3 5 sonnet/i)).toBeInTheDocument()
    })

    it('renders cost formatted correctly', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText('$0.0123')).toBeInTheDocument()
    })

    it('renders token counts', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText('500 in / 150 out')).toBeInTheDocument()
    })

    it('renders runtime formatted as seconds', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText('2.50s')).toBeInTheDocument()
    })
  })

  describe('metrics grid', () => {
    it('renders all four metric labels', () => {
      render(
        <SignalStatus
          signal={baseSignal}
          interpretation={baseInterpretation}
          isPolling={false}
        />
      )

      expect(screen.getByText('Model')).toBeInTheDocument()
      expect(screen.getByText('Cost')).toBeInTheDocument()
      expect(screen.getByText('Tokens')).toBeInTheDocument()
      expect(screen.getByText('Time')).toBeInTheDocument()
    })
  })
})
