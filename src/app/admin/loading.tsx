import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { Settings } from "lucide-react"

export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              Admin
            </h1>
            <div className="h-5 w-32 bg-gray-200 rounded mt-1 animate-pulse" />
          </div>

          {/* License status skeleton */}
          <div className="mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-40 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick links skeleton - matches actual layout */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-12 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Booking Management skeleton */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-6 w-24 bg-gray-200 rounded mb-4" />
            
            {/* Tabs skeleton */}
            <div className="flex gap-2 mb-4">
              <div className="h-9 w-24 bg-gray-200 rounded-lg" />
              <div className="h-9 w-24 bg-gray-100 rounded-lg" />
              <div className="h-9 w-24 bg-gray-100 rounded-lg" />
            </div>
            
            {/* Booking list skeleton */}
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-32 bg-gray-100 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}



