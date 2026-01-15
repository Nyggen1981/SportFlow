"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")

    if (!token) {
      setStatus("error")
      setMessage("Ingen verifiseringskode funnet i lenken.")
      return
    }

    // Verify email
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          setStatus("success")
          setMessage(data.message || "E-postadressen er nå verifisert!")
        } else {
          setStatus("error")
          setMessage(data.error || "Kunne ikke verifisere e-post")
        }
      })
      .catch((error) => {
        setStatus("error")
        setMessage("Noe gikk galt. Prøv igjen senere.")
        console.error("Verification error:", error)
      })
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        {status === "loading" && (
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifiserer e-post...</h1>
            <p className="text-gray-600">Vennligst vent mens vi verifiserer e-postadressen din.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">E-post verifisert!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Logg inn
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifisering feilet</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Gå til innlogging
              </Link>
              <Link
                href="/register"
                className="block text-blue-600 hover:text-blue-700 font-semibold"
              >
                Registrer deg på nytt
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Laster...</h1>
            <p className="text-gray-600">Vennligst vent.</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

