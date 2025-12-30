"use client"

import { useState } from "react"
import { X, Clock, Tag, Sparkles } from "lucide-react"

interface FixedPricePackage {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  price: number
  memberPrice?: number | null // Medlemspris for sammenligning (kun for ikke-medlemmer)
}

interface FixedPricePackagesListProps {
  packages: FixedPricePackage[]
  showMemberSavings?: boolean // Vis besparelser for ikke-medlemmer
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h} timer ${m} min`
  if (h > 0) return `${h} ${h === 1 ? 'time' : 'timer'}`
  return `${m} min`
}

export function FixedPricePackagesList({ packages, showMemberSavings = false }: FixedPricePackagesListProps) {
  const [selectedPackage, setSelectedPackage] = useState<FixedPricePackage | null>(null)

  if (packages.length === 0) return null

  return (
    <>
      <div className="flex flex-col gap-1">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg)}
            className="text-xs text-purple-700 hover:text-purple-900 hover:underline transition-colors cursor-pointer text-left"
            title="Klikk for mer info"
          >
            {pkg.name}: {Math.round(pkg.price)}kr
          </button>
        ))}
      </div>

      {/* Modal for package details */}
      {selectedPackage && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPackage(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedPackage.name}</h3>
                <p className="text-sm text-gray-500">Fastprispakke</p>
              </div>
              <button
                onClick={() => setSelectedPackage(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Tag className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Pris</p>
                  <p className="text-xl font-bold text-purple-900">{Math.round(selectedPackage.price)} kr</p>
                </div>
              </div>

              {/* Vis besparelser for ikke-medlemmer */}
              {showMemberSavings && selectedPackage.memberPrice != null && selectedPackage.memberPrice < selectedPackage.price && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Sparkles className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-green-700 font-medium">
                      Som medlem betaler du kun {Math.round(selectedPackage.memberPrice)} kr
                    </p>
                    <p className="text-xs text-green-600">
                      Spar {Math.round(selectedPackage.price - selectedPackage.memberPrice)} kr ved å bli medlem!
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Varighet</p>
                  <p className="text-lg font-semibold text-blue-900">{formatDuration(selectedPackage.durationMinutes)}</p>
                </div>
              </div>

              {selectedPackage.description && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Beskrivelse</p>
                  <p className="text-sm text-gray-700">{selectedPackage.description}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPackage(null)}
              className="w-full mt-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    </>
  )
}

