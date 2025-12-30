import { Navbar } from "@/components/Navbar"

export default function ResourcesLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title skeleton */}
        <div className="mb-8">
          <div className="h-8 w-40 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-5 w-72 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Category filter skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <div className="h-9 w-16 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
          <div className="h-9 w-24 bg-gray-100 rounded-full animate-pulse flex-shrink-0" />
          <div className="h-9 w-20 bg-gray-100 rounded-full animate-pulse flex-shrink-0" />
          <div className="h-9 w-28 bg-gray-100 rounded-full animate-pulse flex-shrink-0" />
        </div>

        {/* Resource cards grid skeleton */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card overflow-hidden">
              {/* Image skeleton */}
              <div className="h-48 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
              
              {/* Content skeleton */}
              <div className="p-5">
                <div className="h-5 w-20 bg-gray-200 rounded-full mb-3 animate-pulse" />
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-2 animate-pulse" />
                <div className="h-4 w-full bg-gray-100 rounded mb-1 animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 rounded mb-4 animate-pulse" />
                
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

