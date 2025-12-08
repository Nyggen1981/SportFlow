"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { 
  Upload, 
  Trash2, 
  MousePointer2, 
  PenTool, 
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react"

interface Part {
  id?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
  isNew?: boolean
}

interface Point {
  x: number  // percentage 0-100
  y: number  // percentage 0-100
}

interface MapMarker {
  partId: string | null
  partName: string
  points: Point[]
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
  const [currentPoints, setCurrentPoints] = useState<Point[]>([])
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [tool, setTool] = useState<"select" | "draw">("select")
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null)
  const [draggingPoint, setDraggingPoint] = useState<{ markerIndex: number; pointIndex: number } | null>(null)
  const [editingMarkerIndex, setEditingMarkerIndex] = useState<number | null>(null)
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
          // Support both old rect format and new polygon format
          let points: Point[]
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
            return
          }
          existingMarkers.push({
            partId: part.id || `temp-${index}`,
            partName: part.name,
            points,
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
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [])

  const handleMapClick = (e: React.MouseEvent) => {
    if (tool !== "draw" || !mapImage) return
    
    // Don't add point if clicking on existing point
    if ((e.target as HTMLElement).classList.contains('marker-point')) return
    
    const pos = getRelativePosition(e)
    setCurrentPoints([...currentPoints, pos])
  }

  const handlePointDragStart = (e: React.MouseEvent, markerIndex: number, pointIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingPoint({ markerIndex, pointIndex })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPoint) return
    
    const pos = getRelativePosition(e)
    
    if (draggingPoint.markerIndex === -1) {
      // Dragging point in current drawing
      const newPoints = [...currentPoints]
      newPoints[draggingPoint.pointIndex] = pos
      setCurrentPoints(newPoints)
    } else {
      // Dragging point in existing marker
      const newMarkers = [...markers]
      newMarkers[draggingPoint.markerIndex].points[draggingPoint.pointIndex] = pos
      setMarkers(newMarkers)
    }
  }

  const handleMouseUp = () => {
    if (draggingPoint && draggingPoint.markerIndex !== -1) {
      // Update parts after dragging existing marker point
      updatePartsWithMarkers(markers)
    }
    setDraggingPoint(null)
  }

  const handlePointRightClick = (e: React.MouseEvent, markerIndex: number, pointIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (markerIndex === -1) {
      // Delete point from current drawing
      if (currentPoints.length > 1) {
        const newPoints = currentPoints.filter((_, i) => i !== pointIndex)
        setCurrentPoints(newPoints)
      }
    } else {
      // Delete point from existing marker (minimum 3 points for polygon)
      const marker = markers[markerIndex]
      if (marker.points.length > 3) {
        const newMarkers = [...markers]
        newMarkers[markerIndex].points = marker.points.filter((_, i) => i !== pointIndex)
        setMarkers(newMarkers)
        updatePartsWithMarkers(newMarkers)
      }
    }
  }

  const assignPartToMarker = (partId: string) => {
    if (currentPoints.length < 3) return
    
    const part = parts.find(p => (p.id || `temp-${parts.indexOf(p)}`) === partId)
    if (!part) return

    const partIndex = parts.indexOf(part)
    
    // Remove any existing marker for this part
    const filteredMarkers = markers.filter(m => m.partId !== partId)
    
    const newMarker: MapMarker = {
      partId,
      partName: part.name,
      points: currentPoints,
      color: colors[partIndex % colors.length]
    }
    
    const updatedMarkers = [...filteredMarkers, newMarker]
    setMarkers(updatedMarkers)
    setCurrentPoints([])
    setTool("select")
    
    updatePartsWithMarkers(updatedMarkers)
  }

  const updatePartsWithMarkers = (updatedMarkers: MapMarker[]) => {
    const updatedParts = parts.map((part, index) => {
      const partId = part.id || `temp-${index}`
      const marker = updatedMarkers.find(m => m.partId === partId)
      
      if (marker) {
        return {
          ...part,
          mapCoordinates: JSON.stringify({ points: marker.points })
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
    setEditingMarkerIndex(null)
    updatePartsWithMarkers(updatedMarkers)
  }

  const cancelDrawing = () => {
    setCurrentPoints([])
    setTool("select")
  }

  // Generate SVG path from points
  const getPolygonPath = (points: Point[]) => {
    if (points.length < 2) return ""
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  }

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
              onClick={() => { setTool("select"); setCurrentPoints([]) }}
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
              title={parts.length === 0 ? "Legg til deler først" : "Tegn polygon"}
            >
              <PenTool className="w-4 h-4" />
              Tegn område
            </button>
            {currentPoints.length > 0 && (
              <button
                type="button"
                onClick={() => setCurrentPoints([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-amber-600 hover:bg-amber-50"
              >
                <RotateCcw className="w-4 h-4" />
                Nullstill
              </button>
            )}
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
                setCurrentPoints([])
                updatePartsWithMarkers([])
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Fjern
            </button>
          </div>

          {/* Map container */}
          <div 
            className="relative overflow-auto border border-gray-200 rounded-xl bg-gray-100" 
            style={{ maxHeight: '500px' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={containerRef}
              className="relative"
              style={{ 
                width: `${100 * zoom}%`,
                cursor: tool === "draw" ? "crosshair" : "default"
              }}
              onClick={handleMapClick}
            >
              <Image
                src={mapImage}
                alt="Oversiktskart"
                width={1000}
                height={600}
                className="w-full h-auto select-none pointer-events-none"
                draggable={false}
              />
              
              {/* SVG overlay for polygons */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Existing markers */}
                {markers.map((marker, index) => (
                  <g key={index}>
                    <path
                      d={getPolygonPath(marker.points)}
                      fill={`${marker.color}33`}
                      stroke={marker.color}
                      strokeWidth={selectedMarkerIndex === index || editingMarkerIndex === index ? "0.4" : "0.2"}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (tool === "select") {
                          setSelectedMarkerIndex(selectedMarkerIndex === index ? null : index)
                        }
                      }}
                    />
                  </g>
                ))}

                {/* Current drawing polygon */}
                {currentPoints.length >= 2 && (
                  <path
                    d={getPolygonPath(currentPoints)}
                    fill="#3b82f633"
                    stroke="#3b82f6"
                    strokeWidth="0.3"
                    strokeDasharray="0.5"
                  />
                )}
              </svg>

              {/* Marker labels and controls */}
              {markers.map((marker, index) => {
                const centerX = marker.points.reduce((sum, p) => sum + p.x, 0) / marker.points.length
                const centerY = marker.points.reduce((sum, p) => sum + p.y, 0) / marker.points.length
                
                return (
                  <div key={`label-${index}`}>
                    {/* Label - centered in polygon */}
                    <div 
                      className={`absolute px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-sm ${
                        selectedMarkerIndex === index ? "ring-2 ring-white ring-offset-1" : ""
                      }`}
                      style={{ 
                        left: `${centerX}%`, 
                        top: `${centerY}%`,
                        backgroundColor: marker.color,
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      {marker.partName}
                    </div>

                    {/* Delete button when selected - top right of center */}
                    {selectedMarkerIndex === index && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMarker(index)
                        }}
                        className="absolute w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
                        style={{ 
                          left: `${centerX + 5}%`, 
                          top: `${centerY - 5}%`
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {/* Edit points for selected marker */}
                    {(selectedMarkerIndex === index || editingMarkerIndex === index) && marker.points.map((point, pointIndex) => (
                      <div
                        key={`point-${index}-${pointIndex}`}
                        className="marker-point absolute w-3 h-3 rounded-full border-2 border-white cursor-move transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
                        style={{ 
                          left: `${point.x}%`, 
                          top: `${point.y}%`,
                          backgroundColor: marker.color
                        }}
                        onMouseDown={(e) => handlePointDragStart(e, index, pointIndex)}
                        onContextMenu={(e) => handlePointRightClick(e, index, pointIndex)}
                        title="Dra for å flytte, høyreklikk for å slette"
                      />
                    ))}
                  </div>
                )
              })}

              {/* Current drawing points */}
              {currentPoints.map((point, index) => (
                <div
                  key={`current-${index}`}
                  className="marker-point absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white cursor-move transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onMouseDown={(e) => handlePointDragStart(e, -1, index)}
                  onContextMenu={(e) => handlePointRightClick(e, -1, index)}
                  title="Dra for å flytte, høyreklikk for å slette"
                />
              ))}
            </div>
          </div>

          {/* Part assignment dialog */}
          {currentPoints.length >= 3 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-medium text-blue-900 mb-3">
                {currentPoints.length} punkter tegnet. Knytt området til en del:
              </p>
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
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedMarkerIndex(selectedMarkerIndex === index ? null : index)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                    selectedMarkerIndex === index ? "bg-gray-200" : "hover:bg-gray-100"
                  }`}
                >
                  <span 
                    className="w-3 h-3 rounded-sm border"
                    style={{ backgroundColor: `${marker.color}33`, borderColor: marker.color }}
                  />
                  {marker.partName}
                </button>
              ))}
            </div>
          )}

          {/* Help text */}
          {tool === "draw" && (
            <div className="text-sm text-gray-500 space-y-1">
              <p><strong>Klikk</strong> på kartet for å legge til punkt</p>
              <p><strong>Dra</strong> punkt for å flytte</p>
              <p><strong>Høyreklikk</strong> på punkt for å slette</p>
              <p>Minst 3 punkter for å lage et område</p>
            </div>
          )}

          {tool === "select" && selectedMarkerIndex !== null && (
            <div className="text-sm text-gray-500">
              <p>Dra i punktene for å justere formen. Høyreklikk på punkt for å slette.</p>
            </div>
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
