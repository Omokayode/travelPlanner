// components/PhotoPanel.tsx
'use client'

import { useState, useRef } from 'react'
import { Upload, Trash2, Camera, X, Image } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Photo } from '@/lib/types'

interface PhotoPanelProps {
  photos: Photo[]
  onAdd: (photo: Photo) => void
  onDelete: (id: string) => void
}

export default function PhotoPanel({ photos, onAdd, onDelete }: PhotoPanelProps) {
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')

    // Check size (2MB limit per photo)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Photo must be under 2MB for local storage.')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!preview) return
    const photo: Photo = {
      id: uuidv4(),
      dataUrl: preview,
      caption: caption || undefined,
      uploadedAt: new Date().toISOString(),
    }
    onAdd(photo)
    setPreview(null)
    setCaption('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleCancel = () => {
    setPreview(null)
    setCaption('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square bg-[#111827]">
              <img src={photo.dataUrl} alt={photo.caption || 'Travel photo'} className="w-full h-full object-cover" />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white truncate">
                  {photo.caption}
                </div>
              )}
              <button
                onClick={() => onDelete(photo.id)}
                className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview before save */}
      {preview && (
        <div className="bg-[#111827] rounded-xl p-3 space-y-3 border border-[#2d3f5a]">
          <img src={preview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
          {uploadError && <div className="text-xs text-red-400">{uploadError}</div>}
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            className="tp-input"
            placeholder="Add a caption…"
          />
          <div className="flex gap-2">
            <button onClick={handleCancel} className="tp-btn-ghost flex-1 justify-center">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} className="tp-btn-primary flex-1 justify-center">
              <Camera className="w-3.5 h-3.5" /> Save Photo
            </button>
          </div>
        </div>
      )}

      {!preview && (
        <div>
          {uploadError && <div className="text-xs text-red-400 mb-2">{uploadError}</div>}
          <button
            onClick={() => inputRef.current?.click()}
            className="tp-btn-ghost w-full justify-center py-3 border-dashed"
          >
            <Upload className="w-4 h-4" />
            Upload Photo (max 2MB)
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-xs text-[#475569] text-center mt-1.5">
            Photos are stored locally in your browser
          </div>
        </div>
      )}
    </div>
  )
}
