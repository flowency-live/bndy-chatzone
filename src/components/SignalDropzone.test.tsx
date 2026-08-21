import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SignalDropzone } from './SignalDropzone'

describe('SignalDropzone', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  describe('rendering', () => {
    it('renders the dropzone area', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      expect(screen.getByText(/drop or paste a gig poster/i)).toBeInTheDocument()
    })

    it('renders the text input area', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      expect(screen.getByPlaceholderText(/paste facebook event text/i)).toBeInTheDocument()
    })

    it('renders example buttons', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      expect(screen.getByText(/example 1/i)).toBeInTheDocument()
      expect(screen.getByText(/example 2/i)).toBeInTheDocument()
    })

    it('renders the interpret text button', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      expect(screen.getByRole('button', { name: /interpret text/i })).toBeInTheDocument()
    })
  })

  describe('text submission', () => {
    it('allows typing in the textarea', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Test event text')

      expect(textarea).toHaveValue('Test event text')
    })

    it('shows character count', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Hello')

      expect(screen.getByText(/5 characters/i)).toBeInTheDocument()
    })

    it('submits text when form is submitted', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, 'Jazz Night at The Blue Note')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith({
        type: 'text',
        content: 'Jazz Night at The Blue Note',
      })
    })

    it('does not submit empty text', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('does not submit whitespace-only text', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      await user.type(textarea, '   ')

      const submitButton = screen.getByRole('button', { name: /interpret text/i })
      await user.click(submitButton)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('disables submit button when submitting', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={true} />)

      const submitButton = screen.getByRole('button', { name: /interpreting/i })
      expect(submitButton).toBeDisabled()
    })

    it('disables textarea when submitting', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={true} />)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      expect(textarea).toBeDisabled()
    })
  })

  describe('example buttons', () => {
    it('fills textarea when example button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const exampleButton = screen.getByText(/example 1/i)
      await user.click(exampleButton)

      const textarea = screen.getByPlaceholderText(/paste facebook event text/i)
      expect(textarea).toHaveValue('STINGRAY LIVE AT THE RIGGER THURSDAY 15TH MAY 8PM')
    })

    it('disables example buttons when submitting', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={true} />)

      const exampleButton = screen.getByText(/example 1/i)
      expect(exampleButton).toBeDisabled()
    })
  })

  describe('file upload', () => {
    it('renders choose file button', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument()
    })

    it('accepts dropped image files', async () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      const file = new File(['test image'], 'poster.png', { type: 'image/png' })
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(screen.getByText(/poster\.png/i)).toBeInTheDocument()
      })
    })

    it('shows image preview after file drop', async () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      // Create a minimal valid PNG file
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await fetch(base64).then(r => r.blob())
      const file = new File([blob], 'poster.png', { type: 'image/png' })

      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /preview/i })).toBeInTheDocument()
      })
    })

    it('shows remove button after file is selected', async () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await fetch(base64).then(r => r.blob())
      const file = new File([blob], 'poster.png', { type: 'image/png' })

      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
      })
    })

    it('clears image when remove is clicked', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await fetch(base64).then(r => r.blob())
      const file = new File([blob], 'poster.png', { type: 'image/png' })

      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
      })

      const removeButton = screen.getByRole('button', { name: /remove/i })
      await user.click(removeButton)

      expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument()
      expect(screen.getByText(/drop or paste a gig poster/i)).toBeInTheDocument()
    })

    it('submits image when interpret poster button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await fetch(base64).then(r => r.blob())
      const file = new File([blob], 'poster.png', { type: 'image/png' })

      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /interpret poster/i })).toBeInTheDocument()
      })

      const submitButton = screen.getByRole('button', { name: /interpret poster/i })
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'image',
          fileName: 'poster.png',
          mimeType: 'image/png',
        })
      )
    })
  })

  describe('drag and drop states', () => {
    it('shows drag over state when dragging', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      fireEvent.dragOver(dropzone, {
        dataTransfer: { types: ['Files'] },
      })

      expect(dropzone).toHaveClass('drag-over')
    })

    it('removes drag over state when drag leaves', () => {
      render(<SignalDropzone onSubmit={mockOnSubmit} isSubmitting={false} />)

      const dropzone = screen.getByTestId('dropzone')

      fireEvent.dragOver(dropzone, {
        dataTransfer: { types: ['Files'] },
      })

      fireEvent.dragLeave(dropzone)

      expect(dropzone).not.toHaveClass('drag-over')
    })
  })
})
