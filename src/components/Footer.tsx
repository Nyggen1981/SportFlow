import { Calendar } from "lucide-react"

const VERSION = "1.0.0"

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          {/* Arena Booking Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Arena Booking</h3>
              <p className="text-slate-400 text-xs">Profesjonell booking for idrettslag</p>
            </div>
          </div>

          {/* Version and Copyright */}
          <div className="text-right">
            <p className="text-xs text-slate-600">
              v{VERSION}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              © {new Date().getFullYear()} Arena Booking. Alle rettigheter reservert.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

