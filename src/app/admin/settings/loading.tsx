export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-32 bg-gray-200 rounded" />

      {/* Settings sections skeleton */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 bg-gray-100 rounded" />
              <div className="h-10 w-64 bg-gray-100 rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-gray-100 rounded" />
              <div className="h-10 w-64 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}



