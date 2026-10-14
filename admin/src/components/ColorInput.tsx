import { useEffect, useMemo, useRef, useState } from 'react'

type ColorInputProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  defaultColor?: string
  className?: string
}

type Hsv = {
  h: number
  s: number
  v: number
}

const presetColors = [
  '#0f172a',
  '#111827',
  '#0b1220',
  '#1d4ed8',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#64748b'
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(hex: string) {
  const trimmed = hex.trim()
  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map((char) => char + char).join('')}`.toLowerCase()
  }
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  return null
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rNorm) h = ((gNorm - bNorm) / delta) % 6
    else if (max === gNorm) h = (bNorm - rNorm) / delta + 2
    else h = (rNorm - gNorm) / delta + 4
  }

  return {
    h: Math.round(((h * 60) + 360) % 360),
    s: max === 0 ? 0 : delta / max,
    v: max
  }
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (h < 60) [rPrime, gPrime, bPrime] = [c, x, 0]
  else if (h < 120) [rPrime, gPrime, bPrime] = [x, c, 0]
  else if (h < 180) [rPrime, gPrime, bPrime] = [0, c, x]
  else if (h < 240) [rPrime, gPrime, bPrime] = [0, x, c]
  else if (h < 300) [rPrime, gPrime, bPrime] = [x, 0, c]
  else [rPrime, gPrime, bPrime] = [c, 0, x]

  return {
    r: (rPrime + m) * 255,
    g: (gPrime + m) * 255,
    b: (bPrime + m) * 255
  }
}

function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

function hsvToHex(hsv: Hsv) {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(r, g, b)
}

export default function ColorInput({
  value,
  onChange,
  placeholder = '#000000',
  defaultColor = '#000000',
  className = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
}: ColorInputProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)

  const normalizedDefault = normalizeHex(defaultColor) ?? '#0f172a'
  const normalizedValue = normalizeHex(value ?? '')
  const resolvedColor = normalizedValue ?? normalizedDefault
  const hsv = useMemo(() => hexToHsv(resolvedColor) ?? { h: 217, s: 0.66, v: 0.16 }, [resolvedColor])
  const rgb = useMemo(() => hexToRgb(resolvedColor) ?? { r: 15, g: 23, b: 42 }, [resolvedColor])
  const hueOnly = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const updateFromSurface = (clientX: number, clientY: number) => {
    if (!surfaceRef.current) return
    const rect = surfaceRef.current.getBoundingClientRect()
    const s = clamp((clientX - rect.left) / rect.width, 0, 1)
    const v = clamp(1 - ((clientY - rect.top) / rect.height), 0, 1)
    onChange(hsvToHex({ h: hsv.h, s, v }))
  }

  const updateFromHue = (clientX: number) => {
    if (!hueRef.current) return
    const rect = hueRef.current.getBoundingClientRect()
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360)
    onChange(hsvToHex({ h, s: hsv.s, v: hsv.v }))
  }

  const beginSurfaceDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    updateFromSurface(event.clientX, event.clientY)
    const target = event.currentTarget
    const pointerId = event.pointerId
    target.setPointerCapture(pointerId)

    const handleMove = (moveEvent: PointerEvent) => updateFromSurface(moveEvent.clientX, moveEvent.clientY)
    const handleUp = () => {
      target.releasePointerCapture(pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  const beginHueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    updateFromHue(event.clientX)
    const target = event.currentTarget
    const pointerId = event.pointerId
    target.setPointerCapture(pointerId)

    const handleMove = (moveEvent: PointerEvent) => updateFromHue(moveEvent.clientX)
    const handleUp = () => {
      target.releasePointerCapture(pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  return (
    <div ref={rootRef} className="relative w-45">
      <div className={`flex items-center border w-45 gap-2 rounded-xl ${
            open
              ? 'bg-slate-950 text-white ring-4 ring-slate-300/30'
              : 'bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={'group flex h-10 min-w-0 shrink-0 items-center gap-2 rounded-xl px-2.5 transition-all duration-200'}
          title="Open color picker"
        >
          <span
            className={`relative block h-5 w-5 rounded-lg ${open ? 'border-white/30 ring-1 ring-white/10' : 'border-white/70 ring-1 ring-slate-200'}`}
            style={{ background: resolvedColor }}
          >
            <span className="absolute inset-0 rounded-lg bg-[linear-gradient(135deg,rgba(255,255,255,0.28),transparent_58%)]" />
          </span>
          <span className={`font-mono text-[12px] ${open ? 'text-slate-200' : 'text-slate-500'}`}>{resolvedColor}</span>
        </button>

        <button
          type="button"
          onClick={() => onChange('')}
          className="h-7 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition-colors hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 top-12 z-20 w-75 origin-top-left overflow-hidden rounded-2xl border border-slate-200/80 bg-background backdrop-blur-sm animate-[fade-in_160ms_ease-out]">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Color</p>
                <p className="mt-1 font-mono text-sm text-slate-900">{resolvedColor}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  RGB {rgb.r}, {rgb.g}, {rgb.b}
                </div>
                <div
                  className="h-9 w-9 rounded-2xl border border-white/80 shadow-sm ring-1 ring-slate-200"
                  style={{ background: resolvedColor }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3.5 p-4">
            <div
              ref={surfaceRef}
              onPointerDown={beginSurfaceDrag}
              className="relative h-30 cursor-crosshair overflow-hidden rounded-[1.1rem] bg-red-500"
              style={{ backgroundColor: hueOnly }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#fff,rgba(255,255,255,0))]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,#000)]" />
              <div
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.2)]"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: resolvedColor
                }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Hue</p>
                <p className="font-mono text-xs text-slate-500">{Math.round(hsv.h)}deg</p>
              </div>
              <div
                ref={hueRef}
                onPointerDown={beginHueDrag}
                className="relative h-2.5 cursor-ew-resize rounded-full border border-slate-200 shadow-inner transition-transform duration-150 hover:scale-y-110"
                style={{ background: 'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}
              >
                <div
                  className="pointer-events-none absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_2px_12px_rgba(15,23,42,0.24)]"
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Brand Palette</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Tap to swap</p>
              </div>
              <div className="grid grid-cols-14 gap-1">
                {presetColors.map((color) => {
                  const active = resolvedColor === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onChange(color)}
                      className={`relative h-4 rounded-xl transition-all duration-150 hover:scale-[1.05] ${active ? 'border-slate-900 shadow-sm ring-2 ring-slate-300/80' : 'border-slate-200 hover:border-slate-300'}`}
                      style={{ background: color }}
                      title={color}
                    >
                      {active ? <span className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_58%)]" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/75 px-3 py-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tone</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {hsv.v > 0.72 ? 'Light and bright' : hsv.v > 0.38 ? 'Balanced mid-tone' : 'Deep and moody'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {['#f8fafc', normalizedDefault, resolvedColor].map((swatch, index) => (
                  <button
                    key={`${swatch}-${index}`}
                    type="button"
                    onClick={() => onChange(swatch)}
                    className="h-6 w-6 rounded-full border-white shadow-sm ring-1 ring-slate-200 transition-transform hover:scale-110"
                    style={{ background: swatch }}
                    title={swatch}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
