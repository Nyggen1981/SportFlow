"use client"

import { useState, Suspense } from "react"
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
  
  const [step, setStep] = useState<"choose" | "join" | "create">(orgSlug ? "join" : "choose")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // User form
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

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

    try {
      const endpoint = step === "create" 
        ? "/api/auth/register-with-org" 
        : "/api/auth/register"

      const body = step === "create" 
        ? { name, email, phone, password, orgName, orgSlug: orgSlugInput }
        : { name, email, phone, password, orgSlug: joinCode }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke registrere")
      }

      // Auto-login
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        router.push("/login")
      } else {
        router.push("/")
        router.refresh()
      }
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
          <h1 className="mt-4 text-3xl font-bold text-white">Opprett konto</h1>
          <p className="mt-2 text-emerald-100">Bli med og book fasiliteter</p>
        </div>

        {/* Step chooser */}
        {step === "choose" && (
          <div className="card p-8 animate-fadeIn">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
              Hvordan vil du komme i gang?
            </h2>
            <div className="space-y-4">
              <button
                onClick={() => setStep("join")}
                className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <User className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Bli med i eksisterende klubb</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Klubben din bruker allerede Arena Booking
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep("create")}
                className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Opprett ny klubb</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Start Arena Booking for din klubb
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Har du allerede en konto?{" "}
                <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                  Logg inn
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Join existing organization */}
        {step === "join" && (
          <div className="card p-8 animate-fadeIn">
            <button
              onClick={() => setStep("choose")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              ← Tilbake
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Bli med i klubb</h2>
                <p className="text-sm text-gray-500">Registrer deg som bruker</p>
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
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Klubbkode *
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
                  className="input"
                  placeholder="f.eks. lyn"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Spør klubben din om deres kode
                </p>
              </div>

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
                  Telefon
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="99 88 77 66"
                  autoComplete="tel"
                />
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-3 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registrerer...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Opprett konto
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Har du allerede en konto?{" "}
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
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="99 88 77 66"
                    autoComplete="tel"
                  />
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

