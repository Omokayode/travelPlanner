import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0b1121] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  )
}
