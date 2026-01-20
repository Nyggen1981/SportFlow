import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  Receipt,
  FileText,
  Users,
  Car,
  Gavel,
  Plus,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react"
import { isExpensesEnabled } from "@/lib/expenses"

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/")
  }

  const isAdmin = session.user.systemRole === "admin" || session.user.role === "admin"

  if (!isAdmin) {
    redirect("/")
  }

  // Sjekk om modulen er aktivert
  const expensesEnabled = await isExpensesEnabled()
  
  if (!expensesEnabled) {
    redirect("/admin")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back button */}
          <Link 
            href="/admin" 
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 mb-6 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake til admin
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Utlegg og refusjoner</h1>
              <p className="text-gray-500">Håndter dommerregninger, reiseutgifter og andre refusjoner</p>
            </div>
          </div>

          {/* Coming soon placeholder */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <Receipt className="w-10 h-10 text-emerald-600" />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Kommer snart!</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              Utlegg og refusjoner-modulen er under utvikling. Her vil du kunne håndtere:
            </p>

            {/* Feature preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <Gavel className="w-5 h-5 text-blue-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">Dommerregninger</p>
                <p className="text-xs text-gray-500 mt-1">Registrer og godkjenn</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <Car className="w-5 h-5 text-purple-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">Reiseutgifter</p>
                <p className="text-xs text-gray-500 mt-1">Kjøregodtgjørelse</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">Kvitteringer</p>
                <p className="text-xs text-gray-500 mt-1">Last opp bilag</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">Godkjenningsflyt</p>
                <p className="text-xs text-gray-500 mt-1">Behandling & utbetaling</p>
              </div>
            </div>

            {/* Status indicators preview */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="w-4 h-4" />
                Venter på godkjenning
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                Godkjent
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-4 h-4" />
                Avslått
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
