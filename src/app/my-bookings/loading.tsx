export default function MyBookingsLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar placeholder */}
      <div className="h-16 bg-white border-b border-gray-100" />
      
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 w-40 bg-gray-200 rounded mb-6" />

        {/* Filter tabs skeleton */}
        <div className="flex gap-2 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-28 bg-gray-200 rounded-lg" />
          ))}
        </div>

        {/* Bookings list skeleton */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-32 bg-gray-100 rounded mb-1" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



