"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { 
  Upload, 
  Trash2, 
  MousePointer2, 
  Square, 
  X,
  Check,
  Move,
  ZoomIn,
  ZoomOut
} from "lucide-react"

interface Part {
  id?: string
  name: string
  mapCoordinates?: string | null
}

interface MapMarker {
  partId: string | null
  partName: string
  x: number      // percentage 0-100
  y: number      // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
  color: string
}

interface Props {
  mapImage: string | null
  parts: Part[]
  onMapImageChange: (image: string | null) => void
  onPartsUpdate: (parts: Part[]) => void
}

export function MapEditor({ mapImage, parts, onMapImageChange, onPartsUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [tool, setTool] = useState<"select" | "draw">("select")
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)

  // Color palette for markers
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

  // Load existing markers from parts
  useEffect(() => {
    const existingMarkers: MapMarker[] = []
    parts.forEach((part, index) => {
      if (part.mapCoordinates) {
        try {
          const coords = JSON.parse(part.mapCoordinates)
          existingMarkers.push({
            partId: part.id || `temp-${index}`,
            partName: part.name,
            x: coords.x,
            y: coords.y,
            width: coords.width,
            height: coords.height,
            color: colors[index % colors.length]
          })
        } catch {
          // Invalid JSON, skip
        }
      }
    })
    setMarkers(existingMarkers)
  }, []) // Only on mount

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert("Bildet er for stort. Maks 2MB.")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      onMapImageChange(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100 / zoom
    const y = ((e.clientY - rect.top) / rect.height) * 100 / zoom
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [zoom])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== "draw" || !mapImage) return
    
    const pos = getRelativePosition(e)
    setDrawStart(pos)
    setIsDrawing(true)
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return
    
    const pos = getRelativePosition(e)
    const x = Math.min(drawStart.x, pos.x)
    const y = Math.min(drawStart.y, pos.y)
    const width = Math.abs(pos.x - drawStart.x)
    const height = Math.abs(pos.y - drawStart.y)
    
    setCurrentRect({ x, y, width, height })
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) {
      setIsDrawing(false)
      return
    }
    
    // Only create marker if it has some size
    if (currentRect.width > 2 && currentRect.height > 2) {
      // Show part selection for this marker
      setSelectedPartId(null)
    } else {
      setCurrentRect(null)
    }
    
    setIsDrawing(false)
    setDrawStart(null)
  }

  const assignPartToMarker = (partId: string) => {
    if (!currentRect) return
    
    const part = parts.find(p => (p.id || `temp-${parts.indexOf(p)}`) === partId)
    if (!part) return

    const partIndex = parts.indexOf(part)
    
    // Remove any existing marker for this part
    const filteredMarkers = markers.filter(m => m.partId !== partId)
    
    const newMarker: MapMarker = {
      partId,
      partName: part.name,
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.width,
      height: currentRect.height,
      color: colors[partIndex % colors.length]
    }
    
    const updatedMarkers = [...filteredMarkers, newMarker]
    setMarkers(updatedMarkers)
    setCurrentRect(null)
    setTool("select")
    
    // Update parts with coordinates
    updatePartsWithMarkers(updatedMarkers)
  }

  const updatePartsWithMarkers = (updatedMarkers: MapMarker[]) => {
    const updatedParts = parts.map((part, index) => {
      const partId = part.id || `temp-${index}`
      const marker = updatedMarkers.find(m => m.partId === partId)
      
      if (marker) {
        return {
          ...part,
          mapCoordinates: JSON.stringify({
            x: marker.x,
            y: marker.y,
            width: marker.width,
            height: marker.height
          })
        }
      } else {
        return { ...part, mapCoordinates: null }
      }
    })
    
    onPartsUpdate(updatedParts)
  }

  const deleteMarker = (index: number) => {
    const updatedMarkers = markers.filter((_, i) => i !== index)
    setMarkers(updatedMarkers)
    setSelectedMarkerIndex(null)
    updatePartsWithMarkers(updatedMarkers)
  }

  const cancelDrawing = () => {
    setCurrentRect(null)
    setIsDrawing(false)
    setDrawStart(null)
    setTool("select")
  }

  // Parts without markers
  const unassignedParts = parts.filter((part, index) => {
    const partId = part.id || `temp-${index}`
    return !markers.some(m => m.partId === partId)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Oversiktskart</h3>
        {mapImage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Zoom ut"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(2, z + 0.25))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Zoom inn"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {!mapImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Last opp oversiktskart</p>
          <p className="text-sm text-gray-400 mt-1">PNG, JPG eller SVG (maks 2MB)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTool("select")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tool === "select" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              Velg
            </button>
            <button
              type="button"
              onClick={() => setTool("draw")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tool === "draw" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
              disabled={parts.length === 0}
              title={parts.length === 0 ? "Legg til deler først" : "Tegn markering"}
            >
              <Square className="w-4 h-4" />
              Tegn område
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Bytt bilde
            </button>
            <button
              type="button"
              onClick={() => {
                onMapImageChange(null)
                setMarkers([])
                updatePartsWithMarkers([])
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Fjern
            </button>
          </div>

          {/* Map container */}
          <div className="relative overflow-auto border border-gray-200 rounded-xl bg-gray-100" style={{ maxHeight: '500px' }}>
            <div
              ref={containerRef}
              className="relative"
              style={{ 
                width: `${100 * zoom}%`,
                cursor: tool === "draw" ? "crosshair" : "default"
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => isDrawing && handleMouseUp()}
            >
              <Image
                src={mapImage}
                alt="Oversiktskart"
                width={1000}
                height={600}
                className="w-full h-auto select-none pointer-events-none"
                draggable={false}
              />
              
              {/* Existing markers */}
              {markers.map((marker, index) => (
                <div
                  key={index}
                  className={`absolute border-2 rounded-sm transition-all ${
                    selectedMarkerIndex === index ? "ring-2 ring-white ring-offset-1" : ""
                  }`}
                  style={{
                    left: `${marker.x}%`,
                    top: `${marker.y}%`,
                    width: `${marker.width}%`,
                    height: `${marker.height}%`,
                    borderColor: marker.color,
                    backgroundColor: `${marker.color}33`,
                    cursor: tool === "select" ? "pointer" : "crosshair"
                  }}
                  onClick={(e) => {
                    if (tool === "select") {
                      e.stopPropagation()
                      setSelectedMarkerIndex(selectedMarkerIndex === index ? null : index)
                    }
                  }}
                >
                  <div 
                    className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
                    style={{ backgroundColor: marker.color }}
                  >
                    {marker.partName}
                  </div>
                  {selectedMarkerIndex === index && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMarker(index)
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Current drawing rectangle */}
              {currentRect && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 rounded-sm pointer-events-none"
                  style={{
                    left: `${currentRect.x}%`,
                    top: `${currentRect.y}%`,
                    width: `${currentRect.width}%`,
                    height: `${currentRect.height}%`
                  }}
                />
              )}
            </div>
          </div>

          {/* Part assignment dialog */}
          {currentRect && !isDrawing && currentRect.width > 2 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-medium text-blue-900 mb-3">Knytt området til en del:</p>
              <div className="flex flex-wrap gap-2">
                {parts.map((part, index) => {
                  const partId = part.id || `temp-${index}`
                  const hasMarker = markers.some(m => m.partId === partId)
                  
                  return (
                    <button
                      key={partId}
                      type="button"
                      onClick={() => assignPartToMarker(partId)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        hasMarker 
                          ? "bg-gray-200 text-gray-500" 
                          : "bg-white border border-gray-300 hover:border-blue-500 hover:bg-blue-50"
                      }`}
                      style={hasMarker ? {} : { borderColor: colors[index % colors.length] }}
                    >
                      <span 
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      {part.name}
                      {hasMarker && " ✓"}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={cancelDrawing}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          {markers.length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-gray-500">Markerte deler:</span>
              {markers.map((marker, index) => (
                <span key={index} className="flex items-center gap-1.5">
                  <span 
                    className="w-3 h-3 rounded-sm border"
                    style={{ backgroundColor: `${marker.color}33`, borderColor: marker.color }}
                  />
                  {marker.partName}
                </span>
              ))}
            </div>
          )}

          {/* Help text */}
          {tool === "draw" && (
            <p className="text-sm text-gray-500">
              Klikk og dra for å tegne et rektangel rundt en del av fasiliteten
            </p>
          )}
          
          {parts.length === 0 && (
            <p className="text-sm text-amber-600">
              Legg til deler av fasiliteten nedenfor før du kan markere dem i kartet
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  )
}

