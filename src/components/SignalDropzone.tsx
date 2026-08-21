import { useState, useRef, useCallback, useEffect } from 'react'

export interface SignalSubmission {
  type: 'text' | 'image'
  content?: string
  base64Content?: string
  fileName?: string
  mimeType?: string
}

interface SignalDropzoneProps {
  onSubmit: (submission: SignalSubmission) => void
  isSubmitting: boolean
}

const EXAMPLE_TEXTS = [
  'STINGRAY LIVE AT THE RIGGER THURSDAY 15TH MAY 8PM',
  'Jazz Night at The Blue Note - Friday 23rd May, 7pm, tickets £15',
]

export function SignalDropzone({ onSubmit, isSubmitting }: SignalDropzoneProps) {
  const [content, setContent] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<{ base64: string; name: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim() && !isSubmitting) {
      onSubmit({ type: 'text', content: content.trim() })
    }
  }

  const handleImageSubmit = () => {
    if (imageFile && !isSubmitting) {
      onSubmit({
        type: 'image',
        base64Content: imageFile.base64,
        fileName: imageFile.name,
        mimeType: imageFile.type,
      })
    }
  }

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageFile({ base64, name: file.name, type: file.type })
      setContent('')
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const extension = file.type.split('/')[1] || 'png'
          const clipboardFile = new File([file], `clipboard-image.${extension}`, { type: file.type })
          processFile(clipboardFile)
        }
        return
      }
    }
  }, [processFile])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const clearImage = () => {
    setImagePreview(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const dropzoneClasses = [
    'dropzone',
    dragOver ? 'drag-over' : '',
    imagePreview ? 'has-image' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="panel">
      {/* Image Upload Zone */}
      <div
        data-testid="dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={dropzoneClasses}
      >
        {imagePreview ? (
          <div>
            <img
              src={imagePreview}
              alt="Preview"
              className="dropzone-preview"
            />
            <div className="dropzone-file-info">
              <span className="dropzone-file-name">{imageFile?.name}</span>
              <button
                type="button"
                onClick={clearImage}
                className="btn-link"
              >
                Remove
              </button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleImageSubmit}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Interpreting...' : 'Interpret Poster'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="dropzone-icon">🎵</div>
            <p className="dropzone-text">Drop or paste a gig poster</p>
            <p className="dropzone-hint">Ctrl+V to paste from clipboard, or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem' }}
            >
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload image"
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="divider">
        <div className="divider-line" />
        <span className="divider-text">or paste text</span>
        <div className="divider-line" />
      </div>

      {/* Text Input */}
      <form onSubmit={handleTextSubmit}>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (e.target.value) clearImage()
          }}
          placeholder="Paste Facebook event text, poster text, or any event announcement..."
          className="textarea"
          disabled={isSubmitting}
        />

        <div className="form-row">
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Interpreting...' : 'Interpret Text'}
          </button>
          <span className="char-count">{content.length} characters</span>
        </div>
      </form>

      {/* Examples */}
      <div className="examples">
        <p className="examples-label">Try an example:</p>
        <div className="examples-buttons">
          {EXAMPLE_TEXTS.map((text, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setContent(text); clearImage() }}
              disabled={isSubmitting}
              className="example-btn"
            >
              Example {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
