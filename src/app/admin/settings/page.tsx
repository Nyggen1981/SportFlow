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
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
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

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [logo, setLogo] = useState<string | null>(null)
  const [tagline, setTagline] = useState("Kalender")
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [secondaryColor, setSecondaryColor] = useState("#1e40af")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SMTP settings state
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [smtpFrom, setSmtpFrom] = useState("")
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetch("/api/admin/settings")
        .then(res => res.json())
        .then(data => {
          setOrg(data)
          setName(data.name || "")
          setSlug(data.slug || "")
          setLogo(data.logo || null)
          setTagline(data.tagline || "Kalender")
          setPrimaryColor(data.primaryColor || "#2563eb")
          setSecondaryColor(data.secondaryColor || "#1e40af")
          
          // Load SMTP settings
          setSmtpHost(data.smtpHost || "")
          setSmtpPort(data.smtpPort?.toString() || "587")
          setSmtpUser(data.smtpUser || "")
          setSmtpPass(data.smtpPass || "")
          setSmtpFrom(data.smtpFrom || "")
          
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          smtpHost: smtpHost || null,
          smtpPort: smtpPort || null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
          smtpFrom: smtpFrom || null,
        })
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Innstillingene er lagret!
              </div>
            )}

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

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre innstillinger
                  </>
                )}
              </button>
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
                  placeholder="arena-booking@idrettslag.no"
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
                <strong>Tips:</strong> Hvis du ikke setter opp organisasjonsspesifikke innstillinger, vil systemet bruke globale SMTP-innstillinger fra Vercel. Dette er nyttig for å teste, men for produksjon bør hver organisasjon ha sine egne innstillinger.
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
            <div>
              <h2 className="text-xl font-bold text-gray-900">E-postmaler</h2>
              <p className="text-gray-500 text-sm">Tilpass automatiske e-poster som sendes ved bookinger</p>
            </div>
          </div>

          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {emailTemplates.map((template) => (
                <EmailTemplateEditor
                  key={template.templateType}
                  template={template}
                  onSave={handleSaveEmailTemplate}
                  onReset={() => handleResetEmailTemplate(template.templateType)}
                />
              ))}
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
      a.download = `${org?.slug || "arena-booking"}-export-${new Date().toISOString().split("T")[0]}.json`
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

