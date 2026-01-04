export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-pulse">
        {/* Logo skeleton */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/20 mx-auto mb-4" />
          <div className="h-8 w-40 bg-white/20 rounded mx-auto mb-2" />
          <div className="h-4 w-56 bg-white/10 rounded mx-auto" />
        </div>

        {/* Form skeleton */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <div className="space-y-4">
            <div>
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-12 w-full bg-gray-100 rounded-xl" />
            </div>
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-12 w-full bg-gray-100 rounded-xl" />
            </div>
            <div className="h-12 w-full bg-gray-200 rounded-xl mt-6" />
          </div>
        </div>
      </div>
    </div>
  )
}



