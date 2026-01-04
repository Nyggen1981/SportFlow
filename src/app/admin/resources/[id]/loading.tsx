export default function AdminResourceEditLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-200 rounded" />
          <div className="h-8 w-48 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 w-28 bg-gray-200 rounded-t" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="space-y-6">
          {/* Form fields */}
          <div>
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-10 w-full bg-gray-100 rounded" />
          </div>
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-24 w-full bg-gray-100 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-10 w-full bg-gray-100 rounded" />
            </div>
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-10 w-full bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



