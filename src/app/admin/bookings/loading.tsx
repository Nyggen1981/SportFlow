export default function AdminBookingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-10 w-48 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-2 flex-wrap">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 w-28 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 w-48 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
            <div className="flex gap-1">
              <div className="h-8 w-8 bg-gray-100 rounded" />
              <div className="h-8 w-8 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}



