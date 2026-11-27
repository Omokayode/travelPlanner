'use client'

// Full-screen photo viewer: ← / → keys, swipe on phones, Esc or the backdrop closes it.
// Always dark (photos look best on black), so its text is white in both themes.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useFocusTrap, useMounted } from './Dialog'

export interface LightboxItem {
  src: string
  alt: string
  caption?: React.ReactNode
  /** link to the full-size file */
  href?: string
}

interface Props {
  items: LightboxItem[]
  index: number | null
  onIndex: (i: number | null) => void
}

export default function Lightbox({ items, index, onIndex }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useMounted()
  const open = index !== null && !!items[index]
  const close = () => onIndex(null)
  useFocusTrap(open, ref, close)
  const touch = useRef<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const go = (step: number) => {
    if (index === null || items.length < 2) return
    onIndex((index + step + items.length) % items.length)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
  useEffect(() => setLoaded(false), [index])

  if (!open || !mounted || index === null) return null
  const item = items[index]

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      tabIndex={-1}
      className="fixed inset-0 z-[1200] bg-black/95 flex flex-col items-center justify-center p-4 text-white outline-none select-none"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      {!loaded && <div className="absolute w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- streamed through our own API */}
      <img
        key={item.src}
        src={item.src}
        alt={item.alt}
        onLoad={() => setLoaded(true)}
        className="max-w-full max-h-[78vh] rounded-xl object-contain"
      />
      <div className="mt-4 text-center space-y-1 text-sm">
        {item.caption && <div className="text-white/70">{item.caption}</div>}
        <div className="flex items-center justify-center gap-4 text-xs text-white/50">
          {items.length > 1 && (
            <span>
              {index + 1} / {items.length}
            </span>
          )}
          {item.href && (
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200">
              <ExternalLink className="w-3 h-3" /> Full size
            </a>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(1)}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      <button type="button" onClick={close} aria-label="Close"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
        <X className="w-6 h-6" />
      </button>
    </div>,
    document.body,
  )
}
