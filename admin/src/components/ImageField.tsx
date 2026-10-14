import React, { type ChangeEvent, type ReactNode, useRef } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import { resolveMediaSrc } from '../lib/media'

export type DefaultImageOption = {
  key: string
  label: string
  url: string
}

type ImageFieldProps = {
  label: string
  urlLabel?: string
  value: string
  onChange: (value: string) => void
  previewFallback?: ReactNode
  urlPlaceholder?: string
  defaultImages?: DefaultImageOption[]
  onUpload?: (file: File) => Promise<void>
  uploadPending?: boolean
  uploadHint?: string
  disabled?: boolean
}

export default function ImageField({
  label,
  urlLabel = 'Image URL (optional)',
  value,
  onChange,
  previewFallback,
  urlPlaceholder = '/media/defaults/app/grid.svg or https://…',
  defaultImages = [],
  onUpload,
  uploadPending = false,
  uploadHint,
  disabled = false,
}: ImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewSrc = resolveMediaSrc(value)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onUpload) {
      return
    }

    try {
      await onUpload(file)
    } finally {
      event.target.value = ''
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
        <div className="h-14 w-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden text-2xl bg-slate-50">
          {previewSrc ? (
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            previewFallback ?? <span className="text-slate-300 text-sm">—</span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{urlLabel}</label>
        <Input
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={urlPlaceholder}
          disabled={disabled}
          className="h-9 w-full rounded-lg border-slate-200 text-sm"
        />
      </div>

      {onUpload ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Upload Image</label>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploadPending}
            className="h-9 w-full rounded-lg border-slate-200 text-sm pt-1.5"
            onChange={handleFileChange}
          />
          {uploadHint ? <p className="mt-1 text-xs text-slate-500">{uploadHint}</p> : null}
          {uploadPending ? <p className="mt-1 text-xs text-slate-500">Uploading…</p> : null}
        </div>
      ) : null}

      {(defaultImages.length > 0 || value) ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Presets</label>
          <div className="flex flex-wrap gap-2 items-center">
            {defaultImages.map((item) => (
              <Button
                key={item.key}
                type="button"
                onClick={() => onChange(item.url)}
                variant="secondary"
                size="icon"
                disabled={disabled}
                className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 p-0 hover:ring-2 hover:ring-slate-300"
                title={item.label}
              >
                <img src={resolveMediaSrc(item.url)} alt={item.label} className="h-full w-full object-cover" />
              </Button>
            ))}
            <Button
              type="button"
              onClick={() => onChange('')}
              variant="secondary"
              size="sm"
              disabled={disabled}
              className="h-10"
            >
              Clear image
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
