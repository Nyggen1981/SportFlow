import { Navbar } from "@/components/Navbar"
import { ArrowLeft, Calendar, Clock } from "lucide-react"

export default function BookingLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link skeleton */}
        <div className="inline-flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left column - Form skeleton */}
          <div className="space-y-6">
            {/* Date picker skeleton */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-300" />
                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
            </div>

            {/* Time picker skeleton */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-300" />
                <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Right column - Summary skeleton */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit button skeleton */}
            <div className="h-14 bg-blue-300 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

