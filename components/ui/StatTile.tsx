// A small icon / value / label tile used in the trip and day headers.
export default function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="tp-card flex flex-col items-center gap-0.5 py-3">
      <span className="text-base">{icon}</span>
      <div className="text-sm font-semibold text-ink">{value}</div>
      <div className="text-[10px] text-ink/30 uppercase tracking-wide">{label}</div>
    </div>
  )
}
