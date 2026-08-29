import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignalDropzone } from './SignalDropzone'

describe('SignalDropzone', () => {
  const onSubmit = vi.fn()

  beforeEach(() => onSubmit.mockClear())

  it('presents one combined intake with a disabled initial action', () => {
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)

    expect(screen.getByText(/add a poster or screenshot/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/paste a facebook link/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send to bndy/i })).toBeDisabled()
  })

  it('submits trimmed event text', async () => {
    const user = userEvent.setup()
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)

    await user.type(screen.getByPlaceholderText(/paste a facebook link/i), '  Jazz at The Blue Note  ')
    await user.click(screen.getByRole('button', { name: /send to bndy/i }))

    expect(onSubmit).toHaveBeenCalledWith({ content: 'Jazz at The Blue Note' })
  })

  it('keeps supporting text when an image is added and submits both', async () => {
    const user = userEvent.setup()
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)

    const textarea = screen.getByPlaceholderText(/paste a facebook link/i)
    await user.type(textarea, 'Doors at 8pm')
    const file = new File(['image'], 'poster.png', { type: 'image/png' })
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file] } })

    await screen.findByRole('img', { name: /selected gig poster preview/i })
    expect(textarea).toHaveValue('Doors at 8pm')
    await user.click(screen.getByRole('button', { name: /send to bndy/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Doors at 8pm',
      fileName: 'poster.png',
      mimeType: 'image/png',
      base64Content: expect.any(String),
    }))
  })

  it('removes an image without clearing event text', async () => {
    const user = userEvent.setup()
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)

    const textarea = screen.getByPlaceholderText(/paste a facebook link/i)
    await user.type(textarea, 'Keep this text')
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [new File(['image'], 'poster.png', { type: 'image/png' })] },
    })
    await user.click(await screen.findByRole('button', { name: /remove/i }))

    expect(screen.queryByRole('img', { name: /selected gig poster preview/i })).not.toBeInTheDocument()
    expect(textarea).toHaveValue('Keep this text')
  })

  it('rejects unsupported files with a visible explanation', async () => {
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)

    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [new File(['not an image'], 'line-up.pdf', { type: 'application/pdf' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/jpg, png, webp or gif/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects images over the real 5 MB API limit', async () => {
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' })

    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/over 5 mb/i)
    expect(screen.getByRole('button', { name: /send to bndy/i })).toBeDisabled()
  })

  it('accepts an image exactly at the 5 MB limit', async () => {
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'limit.webp', { type: 'image/webp' })

    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file] } })

    await waitFor(() => expect(screen.getByRole('img', { name: /selected gig poster preview/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /send to bndy/i })).toBeEnabled()
  })

  it('shows and clears the drag-over state', () => {
    render(<SignalDropzone onSubmit={onSubmit} isSubmitting={false} />)
    const dropzone = screen.getByTestId('dropzone')

    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('drag-over')
    fireEvent.dragLeave(dropzone)
    expect(dropzone).not.toHaveClass('drag-over')
  })
})
