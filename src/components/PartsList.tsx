"use client"

import { useState } from "react"
import { PartDetailModal } from "./PartDetailModal"

interface Part {
  id: string
  name: string
  description: string | null
  capacity: number | null
  image: string | null
  parentId: string | null
}

interface PartsListProps {
  parts: Part[]
  sortedParts: Part[]
}

export function PartsList({ parts, sortedParts }: PartsListProps) {
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)

  // Filtrer kun deler som har beskrivelse, kapasitet eller bilde
  const partsWithInfo = sortedParts.filter(
    (part) => part.description || part.capacity || part.image
  )

  // Hvis ingen deler har ekstra info, ikke vis kortet
  if (partsWithInfo.length === 0) {
    return null
  }

  return (
    <>
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Mer informasjon
        </h3>
        <div className="space-y-2">
          {partsWithInfo.map((part) => {
            const isChild = part.parentId !== null
            return (
              <div 
                key={part.id} 
                onClick={() => setSelectedPart(part)}
                className={`p-2 rounded-lg border cursor-pointer transition-colors bg-gray-50 border-gray-200 hover:bg-gray-100 ${
                  isChild ? 'ml-4' : ''
                }`}
              >
                <span className="text-sm font-medium text-gray-700">
                  {part.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <PartDetailModal 
        part={selectedPart}
        onClose={() => setSelectedPart(null)}
      />
    </>
  )
}
