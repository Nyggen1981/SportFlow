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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Mer informasjon
        </h2>
        <div className="space-y-1">
          {partsWithInfo.map((part) => {
            const isChild = part.parentId !== null
            return (
              <button 
                key={part.id} 
                onClick={() => setSelectedPart(part)}
                className={`block text-left w-full py-1 transition-colors ${
                  isChild 
                    ? 'ml-4 text-gray-600 hover:text-gray-900' 
                    : 'text-gray-700 hover:text-gray-900'
                } hover:underline cursor-pointer`}
              >
                <span className={`font-medium ${isChild ? '' : ''}`}>
                  {part.name}
                </span>
              </button>
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
