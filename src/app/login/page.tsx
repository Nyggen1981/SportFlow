"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Calendar, Eye, EyeOff, Loader2, AlertCircle, Mail } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/kalender"
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const [resendMessage, setResendMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // NextAuth returnerer feilmeldingen direkte når vi kaster Error i authorize
        // Hvis det er "CredentialsSignin" er det generisk feil, ellers vis spesifikk melding
        if (result.error === "CredentialsSignin") {
          setError("Feil e-post eller passord")
        } else {
          // Vis den faktiske feilmeldingen (f.eks. "Du må verifisere e-postadressen din...")
          setError(result.error)
        }
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      } else {
        setError("Noe gikk galt. Prøv igjen.")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Noe gikk galt. Prøv igjen.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError("Skriv inn e-postadressen din først")
      return
    }

    setIsResendingEmail(true)
    setResendMessage("")
    setError("")

    try {
      const response = await fetch("/api/auth/verify-email/resend-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage(data.message || "Verifiseringsmail er sendt. Sjekk e-posten din.")
      } else {
        setError(data.error || "Kunne ikke sende verifiseringsmail")
      }
    } catch (err) {
      setError("Kunne ikke sende verifiseringsmail. Prøv igjen senere.")
    } finally {
      setIsResendingEmail(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center p-4">
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
          <h1 className="mt-4 text-3xl font-bold text-white">Velkommen tilbake</h1>
          <p className="mt-2 text-blue-100">Logg inn for å booke fasiliteter</p>
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{error}</p>
                    {error.includes("verifisere") && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={isResendingEmail || !email}
                          className="text-xs text-red-600 hover:text-red-800 underline font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isResendingEmail ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Sender...
                            </>
                          ) : (
                            <>
                              <Mail className="w-3 h-3" />
                              Send ny verifiseringsmail
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {resendMessage && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 animate-fadeIn">
                <p className="text-sm">{resendMessage}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-postadresse
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="din@epost.no"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Passord
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logger inn...
                </>
              ) : (
                "Logg inn"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Har du ikke en konto?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Registrer deg
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
