"use client"

import { X } from "lucide-react"
import Image from "next/image"

interface PartDetailModalProps {
  part: {
    id: string
    name: string
    description: string | null
    capacity: number | null
    image: string | null
  } | null
  onClose: () => void
}

export function PartDetailModal({ part, onClose }: PartDetailModalProps) {
  if (!part) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{part.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Lukk"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {part.image && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 shadow-lg">
              <Image
                src={part.image}
                alt={part.name}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                priority
              />
            </div>
          )}

          {/* Description */}
          {part.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Beskrivelse</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{part.description}</p>
            </div>
          )}

          {/* Capacity */}
          {part.capacity && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Kapasitet</h3>
              <p className="text-gray-600">{part.capacity} personer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

