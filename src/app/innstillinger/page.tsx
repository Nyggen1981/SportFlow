"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/PageLayout"
import { 
  Settings, 
  Download, 
  Trash2, 
  Shield, 
  User, 
  Mail, 
  Phone,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"
import { signOut } from "next-auth/react"

export default function InnstillingerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  
  // User info state
  const [userInfo, setUserInfo] = useState<{
    name: string | null
    phone: string | null
    emailVerified: boolean
    isMember: boolean
  } | null>(null)
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  
  // Form state
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Load user info
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      loadUserInfo()
    }
  }, [status, session])

  const loadUserInfo = async () => {
    try {
      const response = await fetch("/api/user/data")
      if (response.ok) {
        const data = await response.json()
        setUserInfo({
          name: data.user.name,
          phone: data.user.phone,
          emailVerified: data.user.emailVerified || false,
          isMember: data.user.isMember || false,
        })
        setEditName(data.user.name || "")
        setEditPhone(data.user.phone || "")
      }
    } catch (error) {
      console.error("Error loading user info:", error)
    } finally {
      setIsLoadingUserInfo(false)
    }
  }

  const handleUpdateUserInfo = async () => {
    setIsUpdating(true)
    setMessage(null)

    try {
      const response = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke oppdatere informasjon")
      }

      setUserInfo({
        name: data.name,
        phone: data.phone,
        emailVerified: data.emailVerified,
        isMember: data.isMember,
      })
      setIsEditing(false)
      setMessage({ type: "success", text: "Informasjon oppdatert!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Kunne ikke oppdatere informasjon" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResendVerificationEmail = async () => {
    setIsResendingEmail(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke sende verifiseringsmail")
      }

      setMessage({ type: "success", text: "Verifiseringsmail er sendt! Sjekk e-posten din." })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Kunne ikke sende verifiseringsmail" })
    } finally {
      setIsResendingEmail(false)
    }
  }

  if (status === "loading") {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </PageLayout>
    )
  }

  if (!session) return null

  const handleExportData = async () => {
    setIsExporting(true)
    setMessage(null)
    
    try {
      const response = await fetch("/api/user/data")
      
      if (!response.ok) {
        throw new Error("Kunne ikke eksportere data")
      }

      const data = await response.json()
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sportflow-booking-data-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setMessage({ type: "success", text: "Data eksportert! Filen er lastet ned." })
    } catch (error) {
      setMessage({ type: "error", text: "Kunne ikke eksportere data. Prøv igjen." })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setMessage(null)
    
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE"
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Kunne ikke slette konto")
      }

      // Sign out and redirect
      await signOut({ callbackUrl: "/" })
      router.push("/")
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: error.message || "Kunne ikke slette konto. Prøv igjen." 
      })
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbake
        </Link>

        <div className="card p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Innstillinger</h1>
              <p className="text-gray-500 text-sm">Administrer din konto og personvern</p>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Kontoinformasjon</h2>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Rediger
                </button>
              )}
            </div>

            {isLoadingUserInfo ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-postadresse
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={session.user?.email || ""}
                      disabled
                      className="input bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                    {session?.user?.systemRole === "admin" ? (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Shield className="w-5 h-5" />
                        <span className="text-xs">Administrator (ingen verifisering påkrevd)</span>
                      </div>
                    ) : userInfo?.emailVerified ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-xs">Verifisert</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-xs">Ikke verifisert</span>
                      </div>
                    )}
                  </div>
                  {!userInfo?.emailVerified && session?.user?.systemRole !== "admin" && (
                    <button
                      onClick={handleResendVerificationEmail}
                      disabled={isResendingEmail}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {isResendingEmail ? "Sender..." : "Send verifiseringsmail på nytt"}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fullt navn
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input"
                    placeholder="Ditt navn"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefonnummer
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="input"
                    placeholder="99 88 77 66"
                  />
                </div>


                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUpdateUserInfo}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lagrer...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Lagre endringer
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditName(userInfo?.name || "")
                      setEditPhone(userInfo?.phone || "")
                    }}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{session.user?.email}</span>
                  {userInfo?.emailVerified ? (
                    <div title="E-post verifisert">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                  ) : (
                    <div title="E-post ikke verifisert">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                  )}
                </div>
                {userInfo?.name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userInfo.name}</span>
                  </div>
                )}
                {userInfo?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userInfo.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Medlemsstatus:</span>
                  <span className="text-gray-600 font-medium">
                    {userInfo?.isMember ? "Medlem" : "Ikke medlem"}
                  </span>
                </div>
                {!userInfo?.emailVerified && session?.user?.systemRole !== "admin" && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 mb-2">
                      <strong>E-post ikke verifisert.</strong> Verifiser e-posten din for å få full tilgang.
                    </p>
                    <button
                      onClick={handleResendVerificationEmail}
                      disabled={isResendingEmail}
                      className="text-xs text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
                    >
                      {isResendingEmail ? "Sender..." : "Send verifiseringsmail på nytt"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
              message.type === "success" 
                ? "bg-green-50 border-green-200 text-green-800" 
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              )}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* GDPR Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Personvern og data</h2>
            </div>

            {/* Export Data */}
            <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Eksporter dine data</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Last ned alle dine personopplysninger i JSON-format. Dette inkluderer din profil, 
                    bookinger og preferanser.
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eksporterer...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Eksporter data
                  </>
                )}
              </button>
            </div>

            {/* Delete Account */}
            <div className="p-5 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <h3 className="font-semibold text-gray-900">Slett konto</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Slett din konto og alle tilknyttede data permanent. Denne handlingen kan ikke angres.
                  </p>
                  {session.user?.role === "admin" && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800">
                        <strong>Advarsel:</strong> Du er administrator. Hvis du er den eneste administratoren, 
                        må du først opprette en annen administrator før du kan slette kontoen din.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Slett konto
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-white border border-red-300 rounded-lg">
                    <p className="text-sm text-gray-700 mb-3">
                      Er du sikker på at du vil slette kontoen din? Alle følgende data vil bli slettet permanent:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-3">
                      <li>Din brukerprofil</li>
                      <li>Alle dine bookinger</li>
                      <li>Dine preferanser</li>
                    </ul>
                    <p className="text-sm font-semibold text-red-700">
                      Denne handlingen kan ikke angres!
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sletter...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Ja, slett kontoen min
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setMessage(null)
                      }}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Policy Link */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              For mer informasjon om hvordan vi behandler dine personopplysninger:
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/personvern" 
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Personvernpolicy
              </Link>
              <Link 
                href="/salgsvilkaar" 
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Salgsvilkår
              </Link>
            </div>
          </div>

          {/* App Info - visible on mobile since footer is hidden */}
          <div className="mt-6 pt-4 border-t border-gray-100 md:hidden">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>SportFlow - Smartere klubbdrift</span>
              <span>v{require("../../../package.json").version}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              © {new Date().getFullYear()} SportFlow
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

