import { Navbar } from "@/components/Navbar"
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react"

export default function ResourceLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero skeleton */}
      <div className="relative h-64 md:h-80 bg-gradient-to-r from-gray-300 to-gray-200 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20" />
        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-8">
          <div className="inline-flex items-center gap-2 text-white/60 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <div className="h-4 w-32 bg-white/30 rounded animate-pulse" />
          </div>
          <div>
            <div className="h-6 w-24 bg-white/30 rounded-full mb-3 animate-pulse" />
            <div className="h-10 w-64 bg-white/40 rounded mb-2 animate-pulse" />
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-white/40" />
              <div className="h-5 w-48 bg-white/30 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content skeleton */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description skeleton */}
            <div className="card p-6">
              <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>

            {/* Calendar skeleton */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-300" />
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Book button skeleton */}
            <div className="h-14 bg-blue-300 rounded-lg animate-pulse" />

            {/* Info card skeleton */}
            <div className="card p-6">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-300" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-200 rounded mb-1 animate-pulse" />
                    <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-300" />
                  <div className="flex-1">
                    <div className="h-4 w-28 bg-gray-200 rounded mb-1 animate-pulse" />
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Parts skeleton */}
            <div className="card p-6">
              <div className="h-6 w-20 bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

