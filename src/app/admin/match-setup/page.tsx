import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import Link from "next/link"
import { 
  Trophy,
  Plus,
  Calendar,
  Users,
  ArrowRight,
  Lock,
  Swords,
  Medal,
  Building2
} from "lucide-react"

export const dynamic = 'force-dynamic'

async function getCompetitions(organizationId: string) {
  return prisma.competition.findMany({
    where: { organizationId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          location: true
        }
      },
      _count: {
        select: {
          teams: true,
          matches: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })
}

export default async function MatchSetupPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const isAdmin = session.user.systemRole === "admin" || session.user.role === "admin"
  if (!isAdmin) {
    redirect("/admin")
  }

  // Sjekk om modulen er aktivert
  const moduleEnabled = await isMatchSetupEnabled()
  
  if (!moduleEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Kampoppsett er ikke aktivert
            </h1>
            <p className="text-gray-500 mb-6">
              Kampoppsett-modulen er ikke inkludert i din lisens. 
              Kontakt din leverandør for å aktivere denne funksjonen.
            </p>
            <Link 
              href="/admin"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Tilbake til admin
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const competitions = await getCompetitions(session.user.organizationId)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Utkast</span>
      case "SCHEDULED":
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">Planlagt</span>
      case "ACTIVE":
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-600 rounded-full">Pågår</span>
      case "COMPLETED":
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-600 rounded-full">Fullført</span>
      case "CANCELLED":
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-600 rounded-full">Avlyst</span>
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    return type === "LEAGUE" 
      ? <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1"><Swords className="w-3 h-3" /> Serie</span>
      : <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1"><Medal className="w-3 h-3" /> Cup</span>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                Kampoppsett
              </h1>
              <p className="text-gray-500 mt-1">
                Opprett og administrer seriespill og turneringer
              </p>
            </div>
            
            <Link
              href="/admin/match-setup/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
            >
              <Plus className="w-5 h-5" />
              Ny konkurranse
            </Link>
          </div>

          {/* Competition List */}
          {competitions.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Ingen konkurranser ennå
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Opprett din første turnering eller serie for å komme i gang med kampoppsett.
              </p>
              <Link
                href="/admin/match-setup/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Opprett konkurranse
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {competitions.map((competition) => (
                <Link
                  key={competition.id}
                  href={`/admin/match-setup/${competition.id}`}
                  className="card p-6 hover:shadow-lg transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                          {competition.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(competition.type)}
                          {getStatusBadge(competition.status)}
                        </div>
                      </div>
                      
                      {competition.description && (
                        <p className="text-gray-500 text-sm mb-3 line-clamp-1">
                          {competition.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {competition._count.teams} lag
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Swords className="w-4 h-4" />
                          {competition._count.matches} kamper
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(competition.startDate).toLocaleDateString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                        {competition.resource && (
                          <span className="flex items-center gap-1.5 text-orange-600">
                            <Building2 className="w-4 h-4" />
                            {competition.resource.name}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  )
}

