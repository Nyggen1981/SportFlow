import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Building2, 
  Users, 
  Settings,
  Layers,
  Shield,
  Trophy
} from "lucide-react"
import { BookingManagement } from "@/components/BookingManagement"
import { LicenseStatusCard } from "@/components/LicenseStatusCard"
import { isPricingEnabled } from "@/lib/pricing"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { isAssetRegisterEnabled } from "@/lib/asset-register"
import { FileText, ClipboardList } from "lucide-react"

async function getModeratorResources(userId: string) {
  const moderatorResources = await prisma.resourceModerator.findMany({
    where: { userId },
    include: {
      resource: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  return moderatorResources.map(mr => mr.resource)
}

async function getQuickStats(organizationId: string) {
  const [resourceCount, categoryCount, userCount, customRoleCount] = await Promise.all([
    prisma.resource.count({ where: { organizationId, isActive: true } }),
    prisma.resourceCategory.count(),
    prisma.user.count({ where: { organizationId } }),
    prisma.customRole.count({ where: { organizationId } })
  ])
  // Legg til 3 standardroller (Admin, Medlem, Ikke medlem) til antallet
  const roleCount = customRoleCount + 3
  return { resourceCount, categoryCount, userCount, roleCount }
      }

// Force dynamic rendering since we use getServerSession and database queries
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      redirect("/")
    }

    // Sjekk både systemRole og role (legacy) for bakoverkompatibilitet
    const isAdmin = session.user.systemRole === "admin" || session.user.role === "admin"
    const isModerator = session.user.hasModeratorAccess

    if (!isAdmin && !isModerator) {
      redirect("/")
    }

    if (!session.user.organizationId) {
      redirect("/")
    }

    // Get data based on role
    const moderatorResources = isModerator 
      ? await getModeratorResources(session.user.id)
      : []
    
    const stats = isAdmin 
      ? await getQuickStats(session.user.organizationId)
      : null

    const pricingEnabled = isAdmin ? await isPricingEnabled() : false
    const matchSetupEnabled = isAdmin ? await isMatchSetupEnabled() : false
    const assetRegisterEnabled = isAdmin ? await isAssetRegisterEnabled() : false

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                {isAdmin ? "Admin" : "Moderator"}
              </h1>
          <p className="text-sm sm:text-base text-gray-500">{session.user.organizationName}</p>
        </div>

            {/* Moderator (ikke admin): Show assigned facilities */}
            {isModerator && !isAdmin && moderatorResources.length > 0 && (
              <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <p className="text-sm text-purple-700">
                  <span className="font-medium">Dine fasiliteter:</span>{" "}
                  {moderatorResources.map(r => r.name).join(", ")}
                </p>
              </div>
            )}

            {/* Moderator (ikke admin): Show warning if no facilities assigned */}
            {isModerator && !isAdmin && moderatorResources.length === 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm text-amber-700">
                  Du er ikke tildelt noen fasiliteter ennå. Kontakt administrator.
                </p>
              </div>
            )}

            {/* Admin: License status */}
            {isAdmin && (
              <div className="mb-6">
                <LicenseStatusCard />
              </div>
            )}

            {/* Admin: Quick links */}
            {isAdmin && stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <Link 
                href="/admin/resources" 
                  className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                      <p className="font-medium text-gray-900">Fasiliteter</p>
                    <p className="text-sm text-gray-500">{stats.resourceCount} aktive</p>
                  </div>
                </div>
              </Link>
              <Link 
                href="/admin/categories" 
                  className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Layers className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Kategorier</p>
                      <p className="text-sm text-gray-500">{stats.categoryCount} stk</p>
                    </div>
                  </div>
              </Link>
              <Link 
                href="/admin/users" 
                  className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Brukere</p>
                    <p className="text-sm text-gray-500">{stats.userCount} registrert</p>
                  </div>
                </div>
              </Link>
              <Link 
                href="/admin/roles" 
                  className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                      <Shield className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Roller</p>
                    <p className="text-sm text-gray-500">{stats.roleCount} definert</p>
                  </div>
                </div>
              </Link>
              <Link 
                href="/admin/settings" 
                  className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      <Settings className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Innstillinger</p>
                      <p className="text-sm text-gray-500">Klubb & utseende</p>
                    </div>
                  </div>
                </Link>
              {pricingEnabled && (
                <Link 
                  href="/admin/invoices" 
                  className="card p-4 hover:shadow-md transition-shadow group h-full flex items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Fakturaer</p>
                      <p className="text-sm text-gray-500">Fakturaoversikt</p>
                    </div>
                  </div>
                </Link>
              )}
              {matchSetupEnabled && (
                <Link 
                  href="/admin/match-setup" 
                  className="card p-4 hover:shadow-md transition-shadow group h-full flex items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <Trophy className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Kampoppsett</p>
                      <p className="text-sm text-gray-500">Turneringer & serier</p>
                    </div>
                  </div>
                </Link>
              )}
              {assetRegisterEnabled && (
                <Link 
                  href="/admin/anleggsregister" 
                  className="card p-4 hover:shadow-md transition-shadow group h-full flex items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                      <ClipboardList className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Anleggsregister</p>
                      <p className="text-sm text-gray-500">Vedlikehold & oppfølging</p>
                    </div>
                  </div>
                </Link>
              )}
              </div>
            )}

            {/* Booking Management */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bookinger</h2>
              <BookingManagement />
            </div>
        </div>
      </main>
      <Footer />
    </div>
    )
  } catch (error) {
    console.error("Admin page error:", error)
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Feil oppstod</h1>
            <p className="text-gray-500">Kunne ikke laste dashboard. Prøv å oppdatere siden.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }
}
