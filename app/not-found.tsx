import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="tp-card max-w-sm w-full p-6 text-center space-y-3">
        <Compass className="w-10 h-10 text-accent mx-auto" />
        <h1 className="text-lg font-semibold text-ink">Page not found</h1>
        <p className="text-ink/50 text-sm">That trip or page doesn&apos;t exist (any more).</p>
        <Link href="/" className="inline-block text-accent hover:text-accent text-sm">
          ← Back to your trips
        </Link>
      </div>
    </div>
  )
}
