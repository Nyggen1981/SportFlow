export default function AdminCategoriesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="h-10 w-36 bg-gray-200 rounded" />
      </div>

      {/* Categories grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-5 w-32 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}



