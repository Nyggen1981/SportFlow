import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Du er offline</h1>
        <p className="text-slate-400 mb-6 max-w-sm">
          Koble til internett for å se bookinger og behandle forespørsler.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Prøv igjen
        </button>
      </div>
    </div>
  )
}

