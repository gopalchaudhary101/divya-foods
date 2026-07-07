/**
 * ImageUploader — drag-drop / click-to-browse image uploader for the admin panel.
 *
 * Props:
 *   value      — current array of image URLs (shown as thumbnails)
 *   onChange   — called when the URL array changes (add / remove / reorder)
 *   maxImages  — default 5; stops accepting new uploads above this limit
 *   disabled   — disable all interactions (e.g. while form is submitting)
 *
 * Behaviour:
 *   - Accepts JPEG, PNG, WebP up to 5 MB each
 *   - Uploads each file to POST /upload/image (admin endpoint)
 *   - If Cloudinary is not configured on the server, shows the server error message
 *   - Shows upload progress per file (spinner overlay on thumbnail)
 *   - Allows removing individual images (X button)
 *   - Drag thumbnails to reorder; the first image is always the cover
 *   - "Set as cover" button promotes any image to the first position
 *   - Also shows a "Paste URL" input for adding images without uploading a file
 */

import React, { useCallback, useId, useRef, useState } from 'react'
import { Upload, X, Link2, Loader2, Image as ImageIcon, AlertCircle, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadApi } from '@/services/api/uploadApi'

interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  disabled?: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export function ImageUploader({
  value,
  onChange,
  maxImages = 5,
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState<Record<number, boolean>>({})
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const canAdd = value.length < maxImages && !disabled

  // ── Validate a single file before uploading ───────────────────────────────

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: unsupported type. Use JPEG, PNG or WebP.`
    if (file.size > MAX_SIZE_BYTES) return `${file.name}: too large (max 5 MB).`
    return null
  }

  // ── Upload one or more files ───────────────────────────────────────────────

  const uploadFiles = useCallback(async (files: File[]) => {
    const newErrors: string[] = []
    const validFiles = files.filter(f => {
      const err = validateFile(f)
      if (err) { newErrors.push(err); return false }
      return true
    })

    // How many slots remain?
    const slots = maxImages - value.length
    const toUpload = validFiles.slice(0, slots)
    if (validFiles.length > slots) {
      newErrors.push(`Only ${slots} more image${slots === 1 ? '' : 's'} can be added (limit ${maxImages}).`)
    }

    setErrors(newErrors)
    if (toUpload.length === 0) return

    // Reserve placeholder indices
    const startIdx = value.length
    onChange([...value, ...toUpload.map(() => '')])   // empty strings hold position

    const results: string[] = [...value, ...toUpload.map(() => '')]

    await Promise.all(
      toUpload.map(async (file, i) => {
        const idx = startIdx + i
        setUploading(prev => ({ ...prev, [idx]: true }))
        try {
          const { url } = await uploadApi.image(file)
          results[idx] = url
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ?? 'Upload failed'
          toast.error(msg)
          results[idx] = ''  // will be filtered out
        } finally {
          setUploading(prev => ({ ...prev, [idx]: false }))
        }
      }),
    )

    onChange(results.filter(Boolean))
  }, [value, onChange, maxImages])

  // ── Drag & drop handlers ──────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!canAdd) return
    const files = Array.from(e.dataTransfer.files)
    uploadFiles(files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) uploadFiles(files)
    e.target.value = ''
  }

  // ── Paste URL ─────────────────────────────────────────────────────────────

  function addPastedUrl() {
    const url = pasteUrl.trim()
    if (!url) return
    if (value.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed.`)
      return
    }
    onChange([...value, url])
    setPasteUrl('')
    setPasteOpen(false)
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  function removeImage(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  // ── Reorder / set cover ─────────────────────────────────────────────────────

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  function setAsCover(i: number) {
    moveImage(i, 0)
  }

  function handleThumbDragStart(i: number) {
    setDragIdx(i)
  }

  function handleThumbDrop(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.stopPropagation()
    if (dragIdx !== null) moveImage(dragIdx, i)
    setDragIdx(null)
  }

  return (
    <div className="space-y-3">
      {/* Error list */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Thumbnail row */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.length > 1 && (
            <p className="text-[11px] text-ocean-400">Drag to reorder · hover an image for cover / remove options</p>
          )}
          <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={i}
              draggable={!disabled && !uploading[i]}
              onDragStart={() => handleThumbDragStart(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleThumbDrop(e, i)}
              onDragEnd={() => setDragIdx(null)}
              className={[
                'relative w-20 h-20 rounded-xl overflow-hidden border-2 bg-ocean-50 dark:bg-ocean-800 group',
                dragIdx === i ? 'border-ocean-500 opacity-50' : 'border-ocean-100 dark:border-ocean-700',
                !disabled && !uploading[i] ? 'cursor-grab active:cursor-grabbing' : '',
              ].join(' ')}
            >
              {url ? (
                <img src={url} alt={`Product image ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={24} className="text-ocean-300" />
                </div>
              )}

              {/* Uploading overlay */}
              {uploading[i] && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 size={18} className="text-white animate-spin" />
                </div>
              )}

              {!uploading[i] && !disabled && (
                <>
                  {/* Remove button (on hover) */}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    aria-label="Remove image"
                  >
                    <X size={10} />
                  </button>

                  {/* Set as cover button (on hover, non-primary images only) */}
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => setAsCover(i)}
                      className="absolute top-1 left-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-500"
                      aria-label="Set as cover image"
                      title="Set as cover image"
                    >
                      <Star size={10} />
                    </button>
                  )}
                </>
              )}

              {/* Primary badge */}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-ocean-700/80 text-white py-0.5">
                  Cover
                </span>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Drop zone (shown when under limit) */}
      {canAdd && (
        <div
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none',
            dragging
              ? 'border-ocean-500 bg-ocean-50 dark:bg-ocean-900/40 scale-[1.01]'
              : 'border-ocean-200 dark:border-ocean-700 hover:border-ocean-400 hover:bg-ocean-50 dark:hover:bg-ocean-900/30',
          ].join(' ')}
        >
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={handleFileInput}
          />
          <Upload size={22} className="mx-auto mb-2 text-ocean-400" />
          <p className="text-sm text-ocean-600 dark:text-ocean-300 font-medium">
            Drag & drop images here
          </p>
          <p className="text-xs text-ocean-400 mt-1">
            or click to browse — JPEG, PNG, WebP · max 5 MB each · {maxImages - value.length} slot{maxImages - value.length === 1 ? '' : 's'} remaining
          </p>
        </div>
      )}

      {/* Paste URL option */}
      {canAdd && (
        <div>
          {pasteOpen ? (
            <div className="flex gap-2">
              <input
                type="url"
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPastedUrl()}
                placeholder="https://res.cloudinary.com/..."
                className="input-field flex-1 text-xs font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={addPastedUrl}
                className="px-3 py-1.5 text-xs bg-ocean-700 hover:bg-ocean-900 text-white rounded-lg font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setPasteOpen(false); setPasteUrl('') }}
                className="px-3 py-1.5 text-xs border border-ocean-200 dark:border-ocean-700 text-ocean-500 hover:text-ocean-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="flex items-center gap-1.5 text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300"
            >
              <Link2 size={12} /> Paste image URL instead
            </button>
          )}
        </div>
      )}
    </div>
  )
}
