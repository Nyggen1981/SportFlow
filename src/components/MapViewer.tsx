"use client"

import { useState } from "react"
import Image from "next/image"

interface Part {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  mapCoordinates?: string | null
}

interface Point {
  x: number
  y: number
}

interface Props {
  mapImage: string
  parts: Part[]
  resourceColor?: string
  onPartClick?: (partId: string) => void
  selectedPartId?: string | null
  selectedPartIds?: string[] // For multi-select
  lockedPartIds?: string[] // Parts that are locked due to hierarchy
}

export function MapViewer({ mapImage, parts, onPartClick, selectedPartId, selectedPartIds, lockedPartIds = [] }: Props) {
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)

  // Color palette
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

  const partsWithCoords = parts.filter(p => p.mapCoordinates).map((part, index) => {
    try {
      const coords = JSON.parse(part.mapCoordinates!)
      let points: Point[]
      
      // Support both polygon format and old rect format
      if (coords.points) {
        points = coords.points
      } else if (coords.x !== undefined) {
        // Convert old rect format to polygon
        points = [
          { x: coords.x, y: coords.y },
          { x: coords.x + coords.width, y: coords.y },
          { x: coords.x + coords.width, y: coords.y + coords.height },
          { x: coords.x, y: coords.y + coords.height }
        ]
      } else {
        return null
      }
      
      return {
        ...part,
        points,
        color: colors[index % colors.length]
      }
    } catch {
      return null
    }
  }).filter(Boolean) as (Part & { points: Point[]; color: string })[]

  if (partsWithCoords.length === 0) {
    return null
  }

  // Generate SVG path from points
  const getPolygonPath = (points: Point[]) => {
    if (points.length < 2) return ""
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
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
        
        {/* SVG overlay for polygons */}
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ pointerEvents: "none" }} // Disable pointer events on SVG, let labels handle clicks
        >
          {partsWithCoords.map((part) => {
            const isSelected = selectedPartIds ? selectedPartIds.includes(part.id) : selectedPartId === part.id
            const isHovered = hoveredPartId === part.id
            const isLocked = lockedPartIds.includes(part.id)
            // Fade if something is hovered OR selected (and this is not the hovered/selected one)
            const hasSelection = (selectedPartIds && selectedPartIds.length > 0) || selectedPartId
            const hasHover = hoveredPartId !== null
            const isFaded = (hasHover || hasSelection) && !isHovered && !isSelected
            
            return (
              <path
                key={part.id}
                d={getPolygonPath(part.points)}
                fill={isLocked ? `${part.color}11` : isSelected || isHovered ? `${part.color}66` : isFaded ? `${part.color}15` : `${part.color}33`}
                stroke={isLocked ? "#9ca3af" : isFaded ? `${part.color}66` : part.color}
                strokeWidth={isSelected || isHovered ? "0.5" : "0.2"}
                strokeDasharray={isLocked ? "2,2" : "none"}
                className="transition-all duration-200"
                style={{ opacity: isFaded ? 0.4 : 1 }}
              />
            )
          })}
        </svg>

        {/* Labels - centered in polygons - these are the primary click targets */}
        {partsWithCoords.map((part) => {
          const centerX = part.points.reduce((sum, p) => sum + p.x, 0) / part.points.length
          const centerY = part.points.reduce((sum, p) => sum + p.y, 0) / part.points.length
          const isSelected = selectedPartIds ? selectedPartIds.includes(part.id) : selectedPartId === part.id
          const isHovered = hoveredPartId === part.id
          const isLocked = lockedPartIds.includes(part.id)
          // Fade if something is hovered OR selected (and this is not the hovered/selected one)
          const hasSelection = (selectedPartIds && selectedPartIds.length > 0) || selectedPartId
          const hasHover = hoveredPartId !== null
          const isFaded = (hasHover || hasSelection) && !isHovered && !isSelected
          
          return (
            <div
              key={`label-${part.id}`}
              className={`absolute px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                onPartClick && !isLocked ? "cursor-pointer hover:scale-105" : isLocked ? "cursor-not-allowed" : "pointer-events-none"
              } ${
                isSelected ? "scale-110 shadow-lg ring-2 ring-white ring-offset-1" : ""
              } ${isHovered && !isSelected ? "scale-105 shadow-md" : ""}`}
              style={{ 
                left: `${centerX}%`, 
                top: `${centerY}%`,
                backgroundColor: isLocked ? "#9ca3af" : part.color,
                opacity: isLocked ? 0.4 : isFaded ? 0.4 : 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                zIndex: isSelected ? 20 : isHovered ? 15 : 10
              }}
              onClick={() => !isLocked && onPartClick?.(part.id)}
              onMouseEnter={() => !isLocked && setHoveredPartId(part.id)}
              onMouseLeave={() => setHoveredPartId(null)}
            >
              {part.name}
            </div>
          )
        })}

      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        {partsWithCoords.map((part) => {
          const isSelected = selectedPartIds ? selectedPartIds.includes(part.id) : selectedPartId === part.id
          const isLocked = lockedPartIds.includes(part.id)
          
          return (
            <button
              key={part.id}
              type="button"
              onClick={() => !isLocked && onPartClick?.(part.id)}
              disabled={isLocked}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                isLocked 
                  ? "opacity-50 cursor-not-allowed bg-gray-100"
                  : isSelected 
                    ? "bg-blue-50 ring-1 ring-blue-200" 
                    : "hover:bg-gray-100"
              } ${onPartClick && !isLocked ? "cursor-pointer" : "cursor-default"}`}
              onMouseEnter={() => !isLocked && setHoveredPartId(part.id)}
              onMouseLeave={() => setHoveredPartId(null)}
            >
              <span 
                className="w-3 h-3 rounded-sm border-2"
                style={{ 
                  backgroundColor: isLocked ? "#9ca3af33" : `${part.color}33`, 
                  borderColor: isLocked ? "#9ca3af" : part.color 
                }}
              />
              <span className={isLocked ? "text-gray-400" : isSelected ? "font-medium text-blue-700" : "text-gray-700"}>
                {part.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
