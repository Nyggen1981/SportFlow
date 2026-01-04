export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar placeholder */}
      <div className="h-16 bg-white border-b border-gray-100" />
      
      <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-gray-200 rounded" />
            <div className="h-10 w-32 bg-gray-200 rounded" />
            <div className="h-10 w-10 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Calendar skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          {/* Days header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-50 rounded border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}



