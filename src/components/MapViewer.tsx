"use client"

import { useState } from "react"
import Image from "next/image"
import { MapPin, X } from "lucide-react"

interface Part {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  mapCoordinates?: string | null
}

interface Props {
  mapImage: string
  parts: Part[]
  resourceColor?: string
  onPartClick?: (partId: string) => void
  selectedPartId?: string | null
}

export function MapViewer({ mapImage, parts, resourceColor = "#3b82f6", onPartClick, selectedPartId }: Props) {
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState<{ partId: string; x: number; y: number } | null>(null)

  // Color palette
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

  const partsWithCoords = parts.filter(p => p.mapCoordinates).map((part, index) => {
    try {
      const coords = JSON.parse(part.mapCoordinates!)
      return {
        ...part,
        coords,
        color: colors[index % colors.length]
      }
    } catch {
      return null
    }
  }).filter(Boolean) as (Part & { coords: { x: number; y: number; width: number; height: number }; color: string })[]

  if (partsWithCoords.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        <Image
          src={mapImage}
          alt="Oversiktskart"
          width={800}
          height={500}
          className="w-full h-auto"
        />
        
        {/* Markers */}
        {partsWithCoords.map((part) => {
          const isSelected = selectedPartId === part.id
          const isHovered = hoveredPartId === part.id
          
          return (
            <button
              key={part.id}
              type="button"
              className={`absolute border-2 rounded-sm transition-all duration-200 ${
                isSelected ? "ring-2 ring-white ring-offset-2 z-20" : ""
              } ${isHovered ? "z-10" : ""}`}
              style={{
                left: `${part.coords.x}%`,
                top: `${part.coords.y}%`,
                width: `${part.coords.width}%`,
                height: `${part.coords.height}%`,
                borderColor: part.color,
                backgroundColor: isSelected || isHovered ? `${part.color}55` : `${part.color}33`,
                transform: isHovered && !isSelected ? "scale(1.02)" : "scale(1)",
                cursor: onPartClick ? "pointer" : "default"
              }}
              onClick={() => onPartClick?.(part.id)}
              onMouseEnter={(e) => {
                setHoveredPartId(part.id)
                const rect = e.currentTarget.getBoundingClientRect()
                const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                if (parentRect) {
                  setShowTooltip({
                    partId: part.id,
                    x: ((rect.left + rect.width / 2 - parentRect.left) / parentRect.width) * 100,
                    y: ((rect.top - parentRect.top) / parentRect.height) * 100
                  })
                }
              }}
              onMouseLeave={() => {
                setHoveredPartId(null)
                setShowTooltip(null)
              }}
            >
              {/* Label */}
              <div 
                className={`absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap transition-opacity ${
                  isHovered || isSelected ? "opacity-100" : "opacity-70"
                }`}
                style={{ backgroundColor: part.color }}
              >
                {part.name}
              </div>
            </button>
          )
        })}

        {/* Tooltip */}
        {showTooltip && (
          <div 
            className="absolute z-30 pointer-events-none"
            style={{
              left: `${showTooltip.x}%`,
              top: `${Math.max(showTooltip.y - 2, 8)}%`,
              transform: "translate(-50%, -100%)"
            }}
          >
            {(() => {
              const part = partsWithCoords.find(p => p.id === showTooltip.partId)
              if (!part) return null
              
              return (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[150px]">
                  <p className="font-semibold text-gray-900 text-sm">{part.name}</p>
                  {part.description && (
                    <p className="text-xs text-gray-500 mt-1">{part.description}</p>
                  )}
                  {part.capacity && (
                    <p className="text-xs text-gray-400 mt-1">
                      Kapasitet: {part.capacity} personer
                    </p>
                  )}
                  {onPartClick && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      Klikk for å velge
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        {partsWithCoords.map((part) => (
          <button
            key={part.id}
            type="button"
            onClick={() => onPartClick?.(part.id)}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
              selectedPartId === part.id 
                ? "bg-blue-50 ring-1 ring-blue-200" 
                : "hover:bg-gray-100"
            } ${onPartClick ? "cursor-pointer" : "cursor-default"}`}
          >
            <span 
              className="w-3 h-3 rounded-sm border-2"
              style={{ 
                backgroundColor: `${part.color}33`, 
                borderColor: part.color 
              }}
            />
            <span className={selectedPartId === part.id ? "font-medium text-blue-700" : "text-gray-700"}>
              {part.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

