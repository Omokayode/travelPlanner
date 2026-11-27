'use client'

// Accessible modal: rendered at the end of <body>, focus moves inside and stays there (Tab
// wraps), Esc or a click on the backdrop closes it, focus goes back to whatever opened it, and
// the page behind does not scroll. On phones it slides up as a bottom sheet.
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps keyboard focus inside `ref` while active; Esc calls onEscape. Shared with Lightbox. */
export function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement>, onEscape: () => void) {
  const escRef = useRef(onEscape)
  escRef.current = onEscape
  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current
    const opener = document.activeElement as HTMLElement | null
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null)
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? el
    first.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        escRef.current()
      } else if (e.key === 'Tab') {
        const list = items()
        if (!list.length) return e.preventDefault()
        const [a, b] = [list[0], list[list.length - 1]]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [active, ref])
}

export function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

interface Props {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  /** max width on larger screens */
  size?: 'sm' | 'md' | 'lg'
  /** optional icon shown before the title */
  icon?: React.ReactNode
}

export default function Dialog({ open, onClose, title, children, size = 'md', icon }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const mounted = useMounted()
  useFocusTrap(open, ref, onClose)
  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'w-full bg-surface border border-line shadow-2xl outline-none',
          'rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto',
          'p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6',
          { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl' }[size],
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-ink flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-ink/5">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
