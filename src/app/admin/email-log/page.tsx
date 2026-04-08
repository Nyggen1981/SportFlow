import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { prisma } from "@/lib/prisma"
import { ArrowLeft, Mail, CheckCircle2, XCircle, Paperclip } from "lucide-react"

export const dynamic = "force-dynamic"

const LIMIT = 30

const categoryLabels: Record<string, string> = {
  test_email: "Test-e-post",
  new_booking_admin: "Ny booking (varsel til admin)",
  booking_approved: "Booking godkjent (bruker)",
  booking_rejected: "Booking avslått",
  booking_cancelled_admin: "Booking kansellert av admin",
  booking_cancelled_user: "Booking kansellert (bekreftelse bruker)",
  booking_cancelled_notify_admin: "Booking kansellert (varsel admin)",
  booking_overlap_cancelled: "Overlapp – eksisterende booking kansellert",
  booking_changed_reapproval: "Booking endret (ny godkjenning)",
  booking_bulk_edit_admin: "Serie endret (varsel admin)",
  booking_bulk_cancel_admin: "Serie kansellert (varsel admin)",
  booking_payment_confirmed: "Betaling bekreftet",
  new_user_admin: "Ny bruker (varsel admin)",
  password_reset: "Tilbakestill passord",
  email_verification: "E-postverifisering",
  invoice_booking: "Faktura (booking)",
  invoice_registration: "Faktura (påmelding)",
  vipps_payment_request: "Vipps betalingslenke",
  competition_registration_approved: "Påmelding godkjent",
  competition_registration_rejected: "Påmelding avslått",
}

function labelCategory(category: string | null) {
  if (!category) return "—"
  return categoryLabels[category] ?? category
}

export default async function AdminEmailLogPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    redirect("/")
  }

  if (!session.user.organizationId) {
    redirect("/")
  }

  const logs = await prisma.emailSendLog.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      toAddress: true,
      subject: true,
      category: true,
      success: true,
      errorMessage: true,
      hasAttachments: true,
      createdAt: true,
    },
  })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbake til admin
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">E-postutsendelseslogg</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              De siste {LIMIT} e-postene systemet har forsøkt å sende for{" "}
              <span className="font-medium text-gray-700">{session.user.organizationName}</span>.
              Mislykkede forsøk (inkl. manglende SMTP) logges også.
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <p>Ingen loggførte e-poster ennå. Når systemet sender e-post, vises de her.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Tidspunkt</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Til</th>
                    <th className="px-4 py-3 font-medium min-w-[180px]">Emne</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Vedlegg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80 align-top">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                        {format(row.createdAt, "d. MMM yyyy HH:mm", { locale: nb })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 break-all max-w-[200px]">
                        {row.toAddress}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{row.subject}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {labelCategory(row.category)}
                      </td>
                      <td className="px-4 py-3">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            Sendt
                          </span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-red-700">
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              Feilet
                              {row.errorMessage && (
                                <span className="block text-xs font-normal text-red-600 mt-0.5 max-w-xs">
                                  {row.errorMessage}
                                </span>
                              )}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.hasAttachments ? (
                          <Paperclip className="w-4 h-4 text-gray-500" aria-label="Ja" />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
