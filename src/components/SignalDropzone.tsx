import { useCallback, useEffect, useRef, useState } from 'react'

export interface SignalSubmission {
  content?: string
  base64Content?: string
  fileName?: string
  mimeType?: string
}

interface SignalDropzoneProps {
  onSubmit: (submission: SignalSubmission) => void
  isSubmitting: boolean
}

interface SelectedImage {
  base64: string
  name: string
  type: string
  size: number
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5h16v13H4z" />
      <path d="m6.5 16 3.7-4 2.8 2.8 1.7-1.8 2.8 3" />
      <circle cx="15.8" cy="9.1" r="1.3" />
    </svg>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SignalDropzone({ onSubmit, isSubmitting }: SignalDropzoneProps) {
  const [content, setContent] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<SelectedImage | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setFileError(null)

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setFileError('Use a JPG, PNG, WEBP or GIF image.')
      return
    }

    if (file.size <= 0) {
      setFileError('That image is empty. Choose another one.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setFileError('That image is over 5 MB. Choose a smaller version.')
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setFileError('We could not read that image. Choose another one.')
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
        setFileError('We could not read that image. Choose another one.')
        return
      }
      setImagePreview(dataUrl)
      setImageFile({
        base64: dataUrl.split(',')[1],
        name: file.name,
        type: file.type,
        size: file.size,
      })
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (isSubmitting) return
    const imageItem = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    processFile(new File([file], `pasted-poster.${extension}`, { type: file.type }))
  }, [isSubmitting, processFile])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const clearImage = () => {
    setImagePreview(null)
    setImageFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting || (!content.trim() && !imageFile)) return
    onSubmit({
      ...(content.trim() ? { content: content.trim() } : {}),
      ...(imageFile ? {
        base64Content: imageFile.base64,
        fileName: imageFile.name,
        mimeType: imageFile.type,
      } : {}),
    })
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <form className="submission-form" onSubmit={handleSubmit}>
      <div
        data-testid="dropzone"
        className={`image-dropzone${dragOver ? ' drag-over' : ''}${imagePreview ? ' has-image' : ''}`}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault()
          if (!isSubmitting) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {imagePreview && imageFile ? (
          <div className="selected-image">
            <img src={imagePreview} alt="Selected gig poster preview" />
            <div className="selected-image-meta">
              <div>
                <strong>{imageFile.name}</strong>
                <span>{formatFileSize(imageFile.size)}</span>
              </div>
              <button type="button" className="text-button danger" onClick={clearImage} disabled={isSubmitting}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="dropzone-prompt">
            <span className="image-icon"><ImageIcon /></span>
            <div>
              <strong>Add a poster or screenshot</strong>
              <span>Drop it here, paste it, or choose an image</span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              Choose image
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="visually-hidden"
          aria-label="Choose a gig poster or screenshot"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) processFile(file)
          }}
          disabled={isSubmitting}
        />
      </div>

      {fileError && <p className="field-error" role="alert">{fileError}</p>}
      <p className="file-help">JPG, PNG, WEBP or GIF. Maximum 5 MB.</p>

      <div className="input-divider"><span>AND / OR</span></div>

      <label className="text-field">
        <span className="field-label">Add a link or event details</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste a Facebook link, WhatsApp message or anything else you know…"
          maxLength={20_000}
          disabled={isSubmitting}
        />
        <span className="field-help">
          {imageFile ? 'Optional, but useful for times, prices or corrections.' : 'A link or a few lines of event text is enough to start.'}
        </span>
      </label>

      <button
        type="submit"
        className="primary-button"
        disabled={isSubmitting || (!content.trim() && !imageFile)}
      >
        {isSubmitting ? (
          <><span className="button-spinner" aria-hidden="true" /> Sending…</>
        ) : (
          <>Send to bndy <span aria-hidden="true">→</span></>
        )}
      </button>

      <p className="submit-note">bndy checks for duplicates before adding anything.</p>
    </form>
  )
}
