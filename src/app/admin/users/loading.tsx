export default function AdminUsersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-10 w-48 bg-gray-200 rounded" />
          <div className="h-10 w-32 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-24 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="h-10 bg-gray-100 rounded" />
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-4 w-40 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
            <div className="h-8 w-8 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}



