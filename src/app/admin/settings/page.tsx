"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  Loader2,
  Save,
  Settings,
  Palette,
  Building,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  X,
  Download,
  Database,
  AlertCircle,
  Mail,
  ChevronDown,
  ChevronRight,
  Key,
  Shield,
  FileText,
} from "lucide-react"
import Image from "next/image"
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor"

interface Organization {
  id: string
  name: string
  slug: string
  logo: string | null
  tagline: string
  primaryColor: string
  secondaryColor: string
  requireUserApproval?: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  licenseKey?: string | null
  vippsClientId?: string | null
  vippsClientSecret?: string | null
  vippsSubscriptionKey?: string | null
  vippsTestMode?: boolean
  invoiceAddress?: string | null
  invoicePhone?: string | null
  invoiceEmail?: string | null
  invoiceOrgNumber?: string | null
  invoiceBankAccount?: string | null
  invoiceNotes?: string | null
  isMvaRegistered?: boolean
  allowSelfMembershipClaim?: boolean
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [org, setOrg] = useState<Organization | null>(null)
  
  // Import/Export state
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const importFileRef = useRef<HTMLInputElement>(null)

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set())

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [logo, setLogo] = useState<string | null>(null)
  const [tagline, setTagline] = useState("Kalender")
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [secondaryColor, setSecondaryColor] = useState("#1e40af")
  const [requireUserApproval, setRequireUserApproval] = useState(true)
  const [allowSelfMembershipClaim, setAllowSelfMembershipClaim] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SMTP settings state
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [smtpFrom, setSmtpFrom] = useState("")
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  
  // SMTP test state
  const [isTestingSmtp, setIsTestingSmtp] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // License settings state
  const [licenseKey, setLicenseKey] = useState("")
  const [isTestingLicense, setIsTestingLicense] = useState(false)
  const [licenseTestResult, setLicenseTestResult] = useState<{ success: boolean; message: string; status?: string } | null>(null)
  
  // Vipps settings state
  const [vippsClientId, setVippsClientId] = useState("")
  const [vippsClientSecret, setVippsClientSecret] = useState("")
  const [vippsSubscriptionKey, setVippsSubscriptionKey] = useState("")
  const [vippsTestMode, setVippsTestMode] = useState(true)
  const [showVippsSecret, setShowVippsSecret] = useState(false)

  // Invoice template settings state
  const [invoiceAddress, setInvoiceAddress] = useState("")
  const [invoicePhone, setInvoicePhone] = useState("")
  const [invoiceEmail, setInvoiceEmail] = useState("")
  const [invoiceOrgNumber, setInvoiceOrgNumber] = useState("")
  const [invoiceBankAccount, setInvoiceBankAccount] = useState("")
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [isMvaRegistered, setIsMvaRegistered] = useState(false)
  const [licenseInfo, setLicenseInfo] = useState<{
    valid: boolean
    status: string
    expiresAt: string | null
    daysRemaining: number | null
    licenseType: string | null
    licenseTypeName?: string | null
    modules?: {
      booking?: boolean
      pricing?: boolean
      "match-setup"?: boolean
      [key: string]: boolean | undefined
    }
  } | null>(null)
  

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      // Load organization settings first (critical)
      fetch("/api/admin/settings")
        .then(res => {
          if (!res.ok) throw new Error("Failed to load settings")
          return res.json()
        })
        .then(orgData => {
          setOrg(orgData)
          setName(orgData.name || "")
          setSlug(orgData.slug || "")
          setLogo(orgData.logo || null)
          setTagline(orgData.tagline || "Kalender")
          setPrimaryColor(orgData.primaryColor || "#2563eb")
          setSecondaryColor(orgData.secondaryColor || "#1e40af")
          setRequireUserApproval(orgData.requireUserApproval !== false) // Default to true
          setAllowSelfMembershipClaim(orgData.allowSelfMembershipClaim === true) // Default to false
          
          // Load SMTP settings
          setSmtpHost(orgData.smtpHost || "")
          setSmtpPort(orgData.smtpPort?.toString() || "587")
          setSmtpUser(orgData.smtpUser || "")
          setSmtpPass(orgData.smtpPass || "")
          setSmtpFrom(orgData.smtpFrom || "")
          
          // Load license settings
          setLicenseKey(orgData.licenseKey || "")
          
          // Load Vipps settings
          setVippsClientId(orgData.vippsClientId || "")
          setVippsClientSecret(orgData.vippsClientSecret || "")
          setVippsSubscriptionKey(orgData.vippsSubscriptionKey || "")
          setVippsTestMode(orgData.vippsTestMode !== false) // Default to true
          
          // Load Invoice template settings
          setInvoiceAddress(orgData.invoiceAddress || "")
          setInvoicePhone(orgData.invoicePhone || "")
          setInvoiceEmail(orgData.invoiceEmail || "")
          setInvoiceOrgNumber(orgData.invoiceOrgNumber || "")
          setInvoiceBankAccount(orgData.invoiceBankAccount || "")
          setInvoiceNotes(orgData.invoiceNotes || "")
          setIsMvaRegistered(orgData.isMvaRegistered || false)
          
          setIsLoading(false)
          
          // Fetch license status info
          fetch("/api/license/status")
            .then(res => res.json())
            .then(data => setLicenseInfo(data))
            .catch(() => {})
        })
        .catch((error) => {
          console.error("Error loading settings:", error)
          setError("Kunne ikke laste innstillinger")
          setIsLoading(false)
        })

      // Load email templates
      fetchEmailTemplates()
    }
  }, [session])

  const fetchEmailTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const response = await fetch("/api/admin/email-templates")
      const data = await response.json()
      setEmailTemplates(data.templates || [])
    } catch (error) {
      console.error("Failed to fetch email templates:", error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleSaveEmailTemplate = async (template: any) => {
    const response = await fetch("/api/admin/email-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateType: template.templateType,
        subject: template.subject,
        htmlBody: template.htmlBody,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Kunne ikke lagre mal")
    }

    // Refresh templates
    await fetchEmailTemplates()
  }

  // Helper function to get template label
  const getTemplateLabel = (templateType: string) => {
    const labels: Record<string, { name: string; description: string }> = {
      new_booking: {
        name: "Ny bookingforespørsel",
        description: "Sendes til administratorer når en ny booking opprettes",
      },
      approved: {
        name: "Booking godkjent",
        description: "Sendes til brukeren når booking blir godkjent",
      },
      rejected: {
        name: "Booking avslått",
        description: "Sendes til brukeren når booking blir avslått",
      },
      cancelled_by_admin: {
        name: "Booking kansellert (av admin)",
        description: "Sendes til brukeren når admin kansellerer booking",
      },
      cancelled_by_user: {
        name: "Booking kansellert (av bruker)",
        description: "Sendes til administratorer når bruker kansellerer booking",
      },
    }
    return labels[templateType] || { name: templateType, description: "" }
  }

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true)
    setSmtpTestResult(null)
    
    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session?.user?.email || "",
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSmtpTestResult({
          success: true,
          message: data.message || "Test-e-post sendt!",
        })
      } else {
        setSmtpTestResult({
          success: false,
          message: data.message || "Kunne ikke sende test-e-post",
        })
      }
    } catch (error) {
      setSmtpTestResult({
        success: false,
        message: "Feil ved testing av e-post. Sjekk at SMTP-innstillingene er korrekte.",
      })
    } finally {
      setIsTestingSmtp(false)
    }
  }

  const handleRefreshLicense = async () => {
    try {
      // Tøm cache og hent ny lisensinfo
      await fetch("/api/license/clear-cache", { method: "POST" })
      const response = await fetch("/api/license/status")
      const data = await response.json()
      setLicenseInfo(data)
      setLicenseTestResult({
        success: true,
        message: "Lisensinfo oppdatert"
      })
    } catch (error) {
      setLicenseTestResult({
        success: false,
        message: "Kunne ikke oppdatere lisensinfo.",
      })
    }
  }

  const handleTestLicense = async () => {
    setIsTestingLicense(true)
    setLicenseTestResult(null)
    
    try {
      const response = await fetch("/api/license/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey,
        }),
      })
      
      const data = await response.json()
      
      if (data.valid) {
        setLicenseTestResult({
          success: true,
          status: data.status,
          message: `Organisasjon: ${data.organization}. ${data.daysRemaining ? `${data.daysRemaining} dager igjen.` : ''}`,
        })
        
        // Oppdater lisensinfo og tøm cache
        setLicenseInfo({
          valid: true,
          status: data.status,
          expiresAt: data.expiresAt || null,
          daysRemaining: data.daysRemaining || null,
          licenseType: data.licenseType || null,
          licenseTypeName: data.licenseTypeName || null,
          modules: data.modules || undefined
        })
        
        // Tøm lisens-cache på serveren og last siden på nytt etter 2 sekunder
        await fetch("/api/license/clear-cache", { method: "POST" })
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setLicenseTestResult({
          success: false,
          status: data.status,
          message: data.message || data.error || "Lisensen er ikke gyldig",
        })
      }
    } catch (error) {
      setLicenseTestResult({
        success: false,
        message: "Kunne ikke kontakte lisensserveren.",
      })
    } finally {
      setIsTestingLicense(false)
    }
  }

  const handleResetEmailTemplate = async (templateType: string) => {
    const response = await fetch(`/api/admin/email-templates?templateType=${templateType}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Kunne ikke tilbakestille")
    }

    // Refresh templates
    await fetchEmailTemplates()
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 500KB for base64 storage)
    if (file.size > 500 * 1024) {
      setError("Logoen er for stor. Maks 500KB.")
      return
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setError("Filen må være et bilde (PNG, JPG, SVG)")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogo(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setLogo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const saveAllSettings = async () => {
    setIsSubmitting(true)
    setError("")
    setSuccess(false)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          logo,
          tagline,
          primaryColor,
          secondaryColor,
          requireUserApproval,
          allowSelfMembershipClaim,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort || null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
          smtpFrom: smtpFrom || null,
          licenseKey: licenseKey || null,
          vippsClientId: vippsClientId || null,
          vippsClientSecret: vippsClientSecret || null,
          vippsSubscriptionKey: vippsSubscriptionKey || null,
          vippsTestMode: vippsTestMode,
          invoiceAddress: invoiceAddress || null,
          invoicePhone: invoicePhone || null,
          invoiceEmail: invoiceEmail || null,
          invoiceOrgNumber: invoiceOrgNumber || null,
          invoiceBankAccount: invoiceBankAccount || null,
          invoiceNotes: invoiceNotes || null,
          isMvaRegistered: isMvaRegistered,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunne ikke lagre innstillinger")
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveAllSettings()
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Floating success/error messages */}
      {(success || error) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4 animate-fade-in">
          {success && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2 shadow-lg">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Innstillingene er lagret!</span>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="ml-auto text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isSubmitting ? "Lagrer innstillinger..." : "Husk å lagre endringene dine"}
          </div>
          <button
            type="button"
            onClick={saveAllSettings}
            disabled={isSubmitting}
            className="btn btn-primary flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Lagrer...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Lagre alle innstillinger
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til dashboard
        </Link>

        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <Settings className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Innstillinger</h1>
              <p className="text-gray-500 text-sm">Tilpass klubben og utseendet</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Organization info */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                <Building className="w-5 h-5 text-gray-400" />
                Klubbinformasjon
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Klubbnavn *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="F.eks. Sportsklubben Lyn"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Klubbkode *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="input"
                  placeholder="lyn"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Brukes som kode for nye brukere å bli med i klubben. Kun små bokstaver, tall og bindestrek.
                </p>
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Klubblogo
                </label>
                
                {logo ? (
                  <div className="flex items-start gap-4">
                    <div className="relative w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-white flex items-center justify-center">
                      <Image
                        src={logo}
                        alt="Klubblogo"
                        width={96}
                        height={96}
                        className="object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary text-sm py-2"
                      >
                        <Upload className="w-4 h-4" />
                        Bytt logo
                      </button>
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Fjern logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Klikk for å laste opp logo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG eller SVG (maks 500KB)</p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Undertekst / Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="input"
                  placeholder="F.eks. Kalender, Booking, Fasiliteter"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vises under klubbnavnet i headeren (f.eks. &quot;Kalender&quot;)
                </p>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                <Palette className="w-5 h-5 text-gray-400" />
                Farger
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primærfarge
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="input flex-1"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sekundærfarge
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="input flex-1"
                      placeholder="#1e40af"
                    />
                  </div>
                </div>
              </div>

              {/* Color preview */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-3">Forhåndsvisning:</p>
                <div className="flex items-center gap-4">
                  {logo && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                      <Image src={logo} alt="Logo" width={48} height={48} className="object-contain" />
                    </div>
                  )}
                  <div 
                    className="w-20 h-10 rounded-lg"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Eksempel-knapp
                  </button>
                </div>
              </div>
            </div>

            {/* User Registration Settings */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Brukerregistrering
              </h2>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1 mr-4">
                  <h3 className="font-medium text-gray-900">Krev godkjenning av nye brukere</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {requireUserApproval 
                      ? "Nye brukere må godkjennes av admin før de kan logge inn"
                      : "Nye brukere får automatisk tilgang etter registrering"
                    }
                  </p>
                </div>
                <div
                  onClick={() => setRequireUserApproval(!requireUserApproval)}
                  className="relative cursor-pointer"
                  style={{ width: '44px', height: '24px' }}
                >
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 rounded-full transition-colors duration-200 ${
                      requireUserApproval ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md border border-gray-200 transition-all duration-200 ${
                      requireUserApproval ? 'left-6' : 'left-0'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1 mr-4">
                  <h3 className="font-medium text-gray-900">Tillat brukere å registrere seg som medlem</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {allowSelfMembershipClaim 
                      ? "Brukere kan selv velge om de er medlem ved registrering"
                      : "Kun admin kan sette medlemsstatus på brukere"
                    }
                  </p>
                </div>
                <div
                  onClick={() => setAllowSelfMembershipClaim(!allowSelfMembershipClaim)}
                  className="relative cursor-pointer"
                  style={{ width: '44px', height: '24px' }}
                >
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 rounded-full transition-colors duration-200 ${
                      allowSelfMembershipClaim ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md border border-gray-200 transition-all duration-200 ${
                      allowSelfMembershipClaim ? 'left-6' : 'left-0'
                    }`}
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

            {/* SMTP Settings */}
        <div className="card p-6 md:p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">E-postinnstillinger</h2>
              <p className="text-gray-500 text-sm">Konfigurer e-postserver for din organisasjon. Hvis ikke satt, brukes globale innstillinger.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Server
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.office365.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">F.eks. smtp.office365.com, smtp.gmail.com</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Vanligvis 587 (TLS) eller 465 (SSL)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brukernavn / E-post
                </label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="sportflow@idrettslag.no"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passord
                </label>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSmtpPassword ? "Skjul" : "Vis"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">App-passord hvis MFA er aktivert</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avsenderadresse (valgfritt)
                </label>
                <input
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="booking@idrettslag.no"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Hvis ikke satt, brukes brukernavn/e-post</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Tips:</strong> Hvis du ikke setter opp organisasjonsspesifikke innstillinger, vil systemet bruke globale SMTP-innstillinger. Dette er nyttig for å teste, men for produksjon bør hver organisasjon ha sine egne innstillinger.
              </p>
            </div>

            {/* SMTP actions */}
            <div className="border-t pt-4 mt-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">Lagre og teste e-postinnstillinger</h3>
                  <p className="text-sm text-gray-500">
                    Husk å lagre før du tester – både denne og knappen &quot;Lagre innstillinger&quot; øverst lagrer SMTP-oppsettet.
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-start">
                  <button
                    type="button"
                    onClick={saveAllSettings}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lagrer...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Lagre e-postinnstillinger
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingSmtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Tester...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send test-e-post
                      </>
                    )}
                  </button>
                </div>
              </div>

              {smtpTestResult && (
                <div
                  className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                    smtpTestResult.success
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  {smtpTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{smtpTestResult.success ? "Suksess!" : "Feil"}</p>
                    <p>{smtpTestResult.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmtpTestResult(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vipps Settings */}
        <div className="card p-6 md:p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Key className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Vipps-innstillinger</h2>
              <p className="text-gray-500 text-sm">Konfigurer Vipps for betalingshåndtering. Disse opplysningene får du fra Vipps.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vipps Client ID
                </label>
                <input
                  type="text"
                  value={vippsClientId}
                  onChange={(e) => setVippsClientId(e.target.value)}
                  placeholder="F.eks. 12345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Merchant Serial Number fra Vipps</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vipps Subscription Key
                </label>
                <input
                  type="text"
                  value={vippsSubscriptionKey}
                  onChange={(e) => setVippsSubscriptionKey(e.target.value)}
                  placeholder="F.eks. abc123..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Subscription Key fra Vipps Portal</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vipps Client Secret
              </label>
              <div className="relative">
                <input
                  type={showVippsSecret ? "text" : "password"}
                  value={vippsClientSecret}
                  onChange={(e) => setVippsClientSecret(e.target.value)}
                  placeholder="F.eks. secret123..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowVippsSecret(!showVippsSecret)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showVippsSecret ? "Skjul" : "Vis"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Client Secret fra Vipps Portal</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex-1 mr-4">
                <h3 className="font-medium text-gray-900">Testmodus</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {vippsTestMode 
                    ? "Bruker Vipps testmiljø (anbefalt for testing)"
                    : "Bruker Vipps produksjonsmiljø"
                  }
                </p>
              </div>
              <div
                onClick={() => setVippsTestMode(!vippsTestMode)}
                className="relative cursor-pointer"
                style={{ width: '44px', height: '24px' }}
              >
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 rounded-full transition-colors duration-200 ${
                    vippsTestMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md border border-gray-200 transition-all duration-200 ${
                    vippsTestMode ? 'left-6' : 'left-0'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="card p-6 md:p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Fakturainformasjon</h2>
              <p className="text-gray-500 text-sm">Informasjon som vises på fakturaer</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organisasjonsnummer
                </label>
                <input
                  type="text"
                  value={invoiceOrgNumber}
                  onChange={(e) => setInvoiceOrgNumber(e.target.value)}
                  placeholder="F.eks. 123 456 789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kontonummer
                </label>
                <input
                  type="text"
                  value={invoiceBankAccount}
                  onChange={(e) => setInvoiceBankAccount(e.target.value)}
                  placeholder="F.eks. 1234 56 78901"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fakturaadresse
                </label>
                <input
                  type="text"
                  value={invoiceAddress}
                  onChange={(e) => setInvoiceAddress(e.target.value)}
                  placeholder="Gateadresse 1, 0000 Sted"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  type="text"
                  value={invoicePhone}
                  onChange={(e) => setInvoicePhone(e.target.value)}
                  placeholder="F.eks. 12 34 56 78"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-post for fakturahenvendelser
                </label>
                <input
                  type="email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  placeholder="faktura@organisasjon.no"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Standardtekst på faktura (valgfritt)
                </label>
                <textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="F.eks. betalingsbetingelser, takk for handelen, etc."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* MVA Checkbox */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMvaRegistered}
                  onChange={(e) => setIsMvaRegistered(e.target.checked)}
                  className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Organisasjonen er MVA-registrert</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Aktiver dette hvis organisasjonen er registrert i Merverdiavgiftsregisteret. 
                    MVA (25%) vil da legges til på fakturaer og vises i betalingsoversikter.
                  </p>
                </div>
              </label>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                <strong>Tips:</strong> Denne informasjonen vises på alle fakturaer som genereres. Sørg for at organisasjonsnummer og kontonummer er korrekt.
              </p>
            </div>
          </div>
        </div>

        {/* Email Templates */}
        <div className="card p-6 md:p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">E-postmaler</h2>
              <p className="text-gray-500 text-sm">Tilpass automatiske e-poster som sendes ved bookinger</p>
            </div>
            {emailTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (expandedTemplates.size === emailTemplates.length) {
                    setExpandedTemplates(new Set())
                  } else {
                    setExpandedTemplates(new Set(emailTemplates.map(t => t.templateType)))
                  }
                }}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {expandedTemplates.size === emailTemplates.length ? "Lukk alle" : "Åpne alle"}
              </button>
            )}
          </div>

          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {emailTemplates.map((template) => {
                const isExpanded = expandedTemplates.has(template.templateType)
                const label = getTemplateLabel(template.templateType)
                
                return (
                  <div key={template.templateType} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        const newExpanded = new Set(expandedTemplates)
                        if (newExpanded.has(template.templateType)) {
                          newExpanded.delete(template.templateType)
                        } else {
                          newExpanded.add(template.templateType)
                        }
                        setExpandedTemplates(newExpanded)
                      }}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{label.name}</h3>
                          <p className="text-xs text-gray-500">{label.description}</p>
                        </div>
                      </div>
                      {template.isCustom && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                          Tilpasset
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        <EmailTemplateEditor
                          template={template}
                          onSave={handleSaveEmailTemplate}
                          onReset={() => handleResetEmailTemplate(template.templateType)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Data Export/Import */}
        <div className="card p-6 md:p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data</h2>
              <p className="text-gray-500 text-sm">Eksporter og importer klubbdata</p>
            </div>
          </div>

          {importMessage && (
            <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 ${
              importMessage.includes("Feil") 
                ? "bg-red-50 border border-red-100 text-red-700"
                : "bg-green-50 border border-green-100 text-green-700"
            }`}>
              {importMessage.includes("Feil") ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              )}
              {importMessage}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Export */}
            <div className="p-4 bg-blue-50 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">Eksporter data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Last ned alle fasiliteter, kategorier, brukere og bookinger som JSON-fil.
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eksporterer...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Eksporter JSON
                  </>
                )}
              </button>
            </div>

            {/* Import */}
            <div className="p-4 bg-amber-50 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">Importer data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Last opp en JSON-fil for å importere fasiliteter, kategorier og brukere.
              </p>
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting}
                className="btn bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importerer...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importer JSON
                  </>
                )}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            <strong>Tips:</strong> Bruk eksport som backup før du gjør store endringer. 
            Import vil ikke overskrive eksisterende data.
          </p>
        </div>

        {/* License Settings */}
        <div id="license" className="card p-6 md:p-8 mt-6 scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Key className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Lisens</h2>
              <p className="text-gray-500 text-sm">Koble til lisensserver for aktivering og validering</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lisensnøkkel
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Lim inn lisensnøkkelen her..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lisensnøkkelen du har fått tildelt. Kontakt leverandør hvis du ikke har en nøkkel.
              </p>
            </div>

            {!licenseKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>OBS:</strong> Appen krever en gyldig lisensnøkkel for å fungere i produksjon. 
                  Uten lisensnøkkel vil brukere ikke kunne logge inn.
                </p>
              </div>
            )}

            {licenseKey && licenseInfo && licenseInfo.status === "active" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-emerald-800 font-medium">
                      ✓ Lisens aktiv
                    </p>
                    {licenseInfo.expiresAt && (
                      <p className="text-sm text-emerald-700 mt-1">
                        Utløper: {new Date(licenseInfo.expiresAt).toLocaleDateString("nb-NO", { 
                          day: "numeric", 
                          month: "long", 
                          year: "numeric" 
                        })}
                        {licenseInfo.daysRemaining !== null && (
                          <span className="ml-2 text-emerald-600">
                            ({licenseInfo.daysRemaining} dager igjen)
                          </span>
                        )}
                      </p>
                    )}
                    {(() => {
                      // Bygg lisens-type streng med moduler
                      const typeParts: string[] = []
                      
                      // Bruk licenseTypeName hvis tilgjengelig, ellers formater licenseType
                      if (licenseInfo.licenseTypeName) {
                        typeParts.push(licenseInfo.licenseTypeName)
                      } else if (licenseInfo.licenseType) {
                        typeParts.push(licenseInfo.licenseType.charAt(0).toUpperCase() + licenseInfo.licenseType.slice(1))
                      }
                      
                      // Legg til aktive moduler (unntatt booking som alltid er aktiv)
                      if (licenseInfo.modules) {
                        const activeModules: string[] = []
                        if (licenseInfo.modules.pricing) {
                          activeModules.push("Betalingsmodul")
                        }
                        if (licenseInfo.modules["match-setup"]) {
                          activeModules.push("Kampoppsett")
                        }
                        if (licenseInfo.modules["asset-register"]) {
                          activeModules.push("Anleggsregister")
                        }
                        
                        if (activeModules.length > 0) {
                          typeParts.push(...activeModules)
                        }
                      }
                      
                      if (typeParts.length > 0) {
                        return (
                          <p className="text-xs text-emerald-600 mt-1">
                            Type: {typeParts.join(" + ")}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>
              </div>
            )}

            {licenseKey && licenseInfo && licenseInfo.daysRemaining !== null && licenseInfo.daysRemaining <= 14 && licenseInfo.daysRemaining > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Lisensen utløper snart!</strong> Kontakt din Sportflow Booking-leverandør for fornyelse.
                </p>
              </div>
            )}

            {licenseKey && !licenseInfo && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  <strong>✓</strong> Lisensnøkkel er konfigurert. Trykk &quot;Test lisens&quot; for å verifisere.
                </p>
              </div>
            )}

            {/* License actions */}
            <div className="border-t pt-4 mt-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">Lagre og teste lisens</h3>
                  <p className="text-sm text-gray-500">
                    Lagre først, deretter test at lisensnøkkelen er gyldig. Bruk "Oppdater lisens" for å tømme cache og hente ny lisensinfo raskt.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveAllSettings}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lagrer...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Lagre
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshLicense}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100"
                    title="Tøm cache og oppdater lisensinfo (nyttig i testfasen)"
                  >
                    <Settings className="w-4 h-4" />
                    Oppdater lisens
                  </button>
                  <button
                    type="button"
                    onClick={handleTestLicense}
                    disabled={isTestingLicense || !licenseKey}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingLicense ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Tester...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Test lisens
                      </>
                    )}
                  </button>
                </div>
              </div>

              {licenseTestResult && (
                <div
                  className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                    licenseTestResult.success
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  {licenseTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {licenseTestResult.success ? "Lisens gyldig!" : "Lisensfeil"}
                      {licenseTestResult.status && ` (${licenseTestResult.status})`}
                    </p>
                    <p>{licenseTestResult.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLicenseTestResult(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      <Footer />
    </div>
  )

  async function handleExport() {
    setIsExporting(true)
    setImportMessage("")
    try {
      const response = await fetch("/api/admin/data")
      const data = await response.json()
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${org?.slug || "sportflow-booking"}-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setImportMessage("Data eksportert!")
      setTimeout(() => setImportMessage(""), 3000)
    } catch {
      setImportMessage("Feil: Kunne ikke eksportere data")
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportMessage("")

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const response = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Import feilet")
      }

      setImportMessage(result.message || "Data importert!")
    } catch (err) {
      setImportMessage(`Feil: ${err instanceof Error ? err.message : "Kunne ikke importere"}`)
    } finally {
      setIsImporting(false)
      if (importFileRef.current) {
        importFileRef.current.value = ""
      }
    }
  }
}

