export default function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/4 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
      <div className="text-xs font-medium text-white/80">{value}</div>
    </div>
  )
}
