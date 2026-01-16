"use client"

import { useState, useRef } from "react"
import { Bug, X, Send, Upload, Loader2, CheckCircle2 } from "lucide-react"
import { useSession } from "next-auth/react"

export function ReportBugButton() {
  const { data: session } = useSession()
  
  // All hooks must be called before any conditional returns
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Kun vis for innloggede med moderator/admin-tilgang (lagledere, trenere, admin)
  const canReportBugs = session?.user && (
    session.user.systemRole === "admin" || 
    session.user.hasModeratorAccess === true ||
    session.user.customRoleId // Alle med egendefinert rolle
  )

  if (!canReportBugs) {
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Bildet er for stort (maks 5MB)")
        return
      }
      
      const reader = new FileReader()
      reader.onload = () => {
        setScreenshot(reader.result as string)
        setScreenshotName(file.name)
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Vennligst beskriv feilen")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          screenshot,
          userEmail: session?.user?.email || "Ikke innlogget",
          userName: session?.user?.name || "Ukjent bruker",
          currentUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        throw new Error("Kunne ikke sende rapporten")
      }

      setIsSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        setDescription("")
        setScreenshot(null)
        setScreenshotName(null)
        setIsSuccess(false)
      }, 2000)
    } catch {
      setError("Noe gikk galt. Prøv igjen senere.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false)
      setDescription("")
      setScreenshot(null)
      setScreenshotName(null)
      setError(null)
      setIsSuccess(false)
    }
  }

  return (
    <>
      {/* Floating Button - positioned above version number */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-12 right-4 z-40 hidden md:flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-full shadow-lg transition-all hover:scale-105"
        title="Rapporter en feil"
      >
        <Bug className="w-4 h-4" />
        <span className="hidden sm:inline">Rapporter feil</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Rapporter en feil</h2>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900">Takk for rapporten!</h3>
                  <p className="text-gray-500">Vi ser på det så snart som mulig.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beskriv feilen <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Hva skjedde? Hva forventet du skulle skje?"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Skjermbilde (valgfritt)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                      disabled={isSubmitting}
                    />
                    
                    {screenshot ? (
                      <div className="relative">
                        <img
                          src={screenshot}
                          alt="Skjermbilde"
                          className="w-full h-40 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={() => {
                            setScreenshot(null)
                            setScreenshotName(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                          disabled={isSubmitting}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-gray-500 mt-1 truncate">{screenshotName}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
                      >
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-500">Klikk for å laste opp bilde</span>
                        <span className="text-xs text-gray-400">Maks 5MB</span>
                      </button>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    Din e-post og nåværende URL vil bli inkludert i rapporten.
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            {!isSuccess && (
              <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sender...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send rapport
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

