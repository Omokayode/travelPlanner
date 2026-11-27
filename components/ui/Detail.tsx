export default function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink/4 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-ink/30 uppercase tracking-wide">{label}</div>
      <div className="text-xs font-medium text-ink/80">{value}</div>
    </div>
  )
}
