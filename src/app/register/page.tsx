"use client"

import { useState, Suspense, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { 
  Calendar, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  User,
  Mail,
  Lock,
  Phone,
  Building2
} from "lucide-react"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgSlug = searchParams.get("org")
  
  const [step, setStep] = useState<"loading" | "choose" | "join" | "create" | "success">("loading")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [orgExists, setOrgExists] = useState(false)
  const [existingOrgName, setExistingOrgName] = useState("")
  const [orgRequiresApproval, setOrgRequiresApproval] = useState(true) // Organization's setting
  const [orgAllowsSelfMembership, setOrgAllowsSelfMembership] = useState(false) // Can users claim membership?
  const [needsApproval, setNeedsApproval] = useState(true) // Result after registration

  // Check if organization exists on page load
  useEffect(() => {
    const checkOrg = async () => {
      try {
        // Use slug from URL if provided, otherwise fetch default
        // Add fresh=1 to bypass cache and get latest settings
        const baseUrl = orgSlug ? `/api/organization?slug=${orgSlug}` : "/api/organization"
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fresh=1`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data && data.name) {
            setOrgExists(true)
            setExistingOrgName(data.name)
            setOrgRequiresApproval(data.requireUserApproval !== false)
            setOrgAllowsSelfMembership(data.allowSelfMembershipClaim === true)
            setStep("join") // Organization exists, go to join
          } else {
            setOrgExists(false)
            setStep("create") // No organization, must create one
          }
        } else {
          setOrgExists(false)
          setStep("create") // No organization, must create one
        }
      } catch {
        setOrgExists(false)
        setStep("create") // Error checking, assume no org
      }
    }
    
    checkOrg()
  }, [orgSlug])

  // User form
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [claimsMembership, setClaimsMembership] = useState(false)

  // Organization form (for new clubs)
  const [orgName, setOrgName] = useState("")
  const [orgSlugInput, setOrgSlugInput] = useState("")

  // Join existing org
  const [joinCode, setJoinCode] = useState(orgSlug || "")

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError("Passordene matcher ikke")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Passordet må være minst 6 tegn")
      setIsLoading(false)
      return
    }

    if (!consentGiven) {
      setError("Du må godta personvernpolicyn for å registrere deg")
      setIsLoading(false)
      return
    }

    try {
      const endpoint = step === "create" 
        ? "/api/auth/register-with-org" 
        : "/api/auth/register"

      const body = step === "create" 
        ? { name, email, phone, password, orgName, orgSlug: orgSlugInput }
        : { name, email, phone, password, claimsMembership: orgAllowsSelfMembership ? claimsMembership : false }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke registrere")
      }

      // For new organizations (admin), show success message
      // Admin can log in after verifying email (admin bypasses email check, but we still want them to verify)
      if (step === "create") {
        setNeedsApproval(false)
        setStep("success")
        return
      }

      // For regular users joining a club
      // Check if approval is needed based on API response
      setNeedsApproval(data.needsApproval !== false)
      
      // Never auto-login - user must verify email first
      // Even if auto-approved, email verification is required

      // Show success message (either waiting for approval or confirming registration)
      setStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Calendar className="w-8 h-8 text-white" />
            </div>
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-white">
            {step === "loading" ? "Registrer deg" : orgRequiresApproval ? "Søk om tilgang" : "Registrer deg"}
          </h1>
          <p className="mt-2 text-emerald-100">
            {orgRequiresApproval ? "Registrer deg for å booke fasiliteter" : "Opprett konto for å booke fasiliteter"}
          </p>
        </div>

        {/* Loading state */}
        {step === "loading" && (
          <div className="card p-8 animate-fadeIn text-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Sjekker tilgjengelighet...</p>
          </div>
        )}

        {/* Success message after registration */}
        {step === "success" && (
          <div className="card p-8 animate-fadeIn text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {needsApproval ? "Søknad sendt!" : "Registrering fullført!"}
            </h2>
            <p className="text-gray-600 mb-6">
              {needsApproval 
                ? "Din registrering er mottatt og venter på godkjenning fra en administrator. Sjekk e-posten din for å verifisere kontoen. Du vil få tilgang til å logge inn og booke når søknaden er godkjent."
                : "Din konto er opprettet! Sjekk e-posten din for å verifisere kontoen før du logger inn. Du vil motta en verifiseringslenke på e-post."
              }
            </p>
            {needsApproval ? (
              <Link href="/" className="btn btn-primary">
                <Calendar className="w-5 h-5" />
                Tilbake til forsiden
              </Link>
            ) : (
              <Link href="/login" className="btn btn-primary">
                <User className="w-5 h-5" />
                Logg inn
              </Link>
            )}
          </div>
        )}

        {/* Join existing organization */}
        {step === "join" && (
          <div className="card p-8 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Registrer deg</h2>
                <p className="text-sm text-gray-500">
                  {existingOrgName ? `Bli med i ${existingOrgName}` : "Opprett din bruker"}
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Fullt navn *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Ola Nordmann"
                  required
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  E-postadresse *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="ola@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Telefon *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="99 88 77 66"
                  autoComplete="tel"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Brukes for fremtidig Vipps-betaling
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Passord *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                    placeholder="Minst 6 tegn"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Bekreft passord *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Skriv passordet på nytt"
                  required
                  autoComplete="new-password"
                />
              </div>

              {/* Membership status checkbox - only show if organization allows self-membership claims */}
              {orgAllowsSelfMembership && (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="membership-claim"
                    checked={claimsMembership}
                    onChange={(e) => setClaimsMembership(e.target.checked)}
                    className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="membership-claim" className="text-sm text-gray-700 cursor-pointer">
                    <span className="font-medium">Jeg er medlem av {existingOrgName || "idrettslaget"}</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Huk av hvis du allerede er medlem av klubben.
                    </p>
                  </label>
                </div>
              )}

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <input
                  type="checkbox"
                  id="consent-join"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  required
                />
                <label htmlFor="consent-join" className="text-sm text-gray-700 cursor-pointer">
                  Jeg godtar{" "}
                  <Link href="/personvern" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                    personvernpolicyn
                  </Link>
                  {" "}og samtykker til behandling av mine personopplysninger *
                </label>
              </div>

              {/* Info about approval - only show if org requires approval */}
              {orgRequiresApproval && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>Merk:</strong> Etter registrering må en administrator godkjenne kontoen din før du kan logge inn og booke.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-3 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {orgRequiresApproval ? "Sender søknad..." : "Registrerer..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {orgRequiresApproval ? "Send søknad" : "Registrer deg"}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {orgRequiresApproval ? "Allerede godkjent?" : "Har du allerede en konto?"}{" "}
                <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                  Logg inn
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Create new organization */}
        {step === "create" && (
          <div className="card p-8 animate-fadeIn">
            <button
              onClick={() => setStep("choose")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              ← Tilbake
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Opprett ny klubb</h2>
                <p className="text-sm text-gray-500">Du blir administrator</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Organization info */}
              <div className="p-4 bg-blue-50 rounded-xl space-y-4">
                <p className="text-sm font-medium text-blue-900">Klubbinformasjon</p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klubbnavn *
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="input"
                    placeholder="F.eks. Sportsklubben Lyn"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klubbkode (URL) *
                  </label>
                  <input
                    type="text"
                    value={orgSlugInput}
                    onChange={(e) => setOrgSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="input"
                    placeholder="lyn"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Brukes som kode for andre å bli med. Kun små bokstaver og tall.
                  </p>
                </div>
              </div>

              {/* Admin user info */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Din bruker (blir admin)</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Fullt navn *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="Ola Nordmann"
                    required
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4 inline mr-1" />
                    E-postadresse *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="ola@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="99 88 77 66"
                    autoComplete="tel"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Brukes for fremtidig Vipps-betaling
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Passord *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-12"
                      placeholder="Minst 6 tegn"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Bekreft passord *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Skriv passordet på nytt"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Membership status */}

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <input
                  type="checkbox"
                  id="consent-create"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  required
                />
                <label htmlFor="consent-create" className="text-sm text-gray-700 cursor-pointer">
                  Jeg godtar{" "}
                  <Link href="/personvern" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                    personvernpolicyn
                  </Link>
                  {" "}og samtykker til behandling av mine personopplysninger *
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Oppretter klubb...
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    Opprett klubb og konto
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Har du allerede en konto?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Logg inn
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}

