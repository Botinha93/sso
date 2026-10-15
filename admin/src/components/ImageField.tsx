import type { ReactNode } from 'react'
import { ImageField as NexusImageField } from '@nexus/design'

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

/** Admin wrapper over the Nexus `ImageField`: keeps media paths (`/media/...`) and the server's default-image presets. */
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
  return (
    <NexusImageField
      label={label}
      shape="rounded"
      value={value}
      onChange={onChange}
      fallback={previewFallback}
      urlLabel={urlLabel}
      urlPlaceholder={urlPlaceholder}
      presets={defaultImages.map((item) => ({ value: item.url, label: item.label }))}
      onUpload={onUpload}
      uploading={onUpload ? uploadPending : undefined}
      accept="image/*"
      hint={uploadHint}
      disabled={disabled}
    />
  )
}
