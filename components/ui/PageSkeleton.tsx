// Placeholder with the rough shape of a trip/day page while it loads.
export default function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2 mb-6">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-64 max-w-full" />
        <div className="skeleton h-3 w-48" />
      </div>
      <div className="skeleton h-10 w-80 max-w-full mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-[clamp(240px,40vh,400px)]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
    </div>
  )
}
