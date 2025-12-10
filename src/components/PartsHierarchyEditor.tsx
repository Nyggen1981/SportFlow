"use client"

import { useState } from "react"
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  GripVertical,
  FolderOpen
} from "lucide-react"

export interface HierarchicalPart {
  id?: string
  tempId?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
  adminNote?: string | null
  parentId?: string | null
  children?: HierarchicalPart[]
  isNew?: boolean
}

interface Props {
  parts: HierarchicalPart[]
  onPartsChange: (parts: HierarchicalPart[]) => void
}

export function PartsHierarchyEditor({ parts, onPartsChange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Build tree structure from flat list
  const buildTree = (flatParts: HierarchicalPart[]): HierarchicalPart[] => {
    const map = new Map<string, HierarchicalPart>()
    const roots: HierarchicalPart[] = []

    // First pass: create map with tempIds for new parts
    flatParts.forEach((part, index) => {
      const id = part.id || part.tempId || `temp-${index}`
      map.set(id, { ...part, tempId: id, children: [] })
    })

    // Second pass: build tree
    flatParts.forEach((part, index) => {
      const id = part.id || part.tempId || `temp-${index}`
      const node = map.get(id)!
      
      if (part.parentId && map.has(part.parentId)) {
        const parent = map.get(part.parentId)!
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  const tree = buildTree(parts)

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const addPart = (parentId: string | null = null) => {
    const newPart: HierarchicalPart = {
      tempId: `new-${Date.now()}`,
      name: "",
      description: "",
      capacity: "",
      adminNote: "",
      parentId,
      isNew: true
    }
    
    onPartsChange([...parts, newPart])
    setEditingId(newPart.tempId!)
    
    // Expand parent if adding child
    if (parentId) {
      setExpandedIds(new Set([...expandedIds, parentId]))
    }
  }

  const updatePart = (id: string, field: keyof HierarchicalPart, value: string) => {
    const updated = parts.map(p => {
      const partId = p.id || p.tempId || ''
      if (partId === id) {
        const updatedPart = { ...p, [field]: value }
        return updatedPart
      }
      return p
    })
    onPartsChange([...updated])
  }

  const deletePart = (id: string) => {
    // Delete part and all its children
    const idsToDelete = new Set<string>([id])
    
    const findChildren = (parentId: string) => {
      parts.forEach(p => {
        const partId = p.id || p.tempId
        if (p.parentId === parentId && partId) {
          idsToDelete.add(partId)
          findChildren(partId)
        }
      })
    }
    findChildren(id)
    
    const updated = parts.filter(p => {
      const partId = p.id || p.tempId
      return partId && !idsToDelete.has(partId)
    })
    onPartsChange(updated)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId !== id) {
      setDragOverId(id)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    // Reorder parts - move dragged item before target
    const draggedIndex = parts.findIndex(p => (p.id || p.tempId) === draggedId)
    const targetIndex = parts.findIndex(p => (p.id || p.tempId) === targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    // Get the parts with same parent as target (for reordering within same level)
    const draggedPart = parts[draggedIndex]
    const targetPart = parts[targetIndex]

    // Only reorder if they have the same parent
    if (draggedPart.parentId === targetPart.parentId) {
      const newParts = [...parts]
      const [removed] = newParts.splice(draggedIndex, 1)
      
      // Recalculate target index after removal
      const newTargetIndex = newParts.findIndex(p => (p.id || p.tempId) === targetId)
      newParts.splice(newTargetIndex, 0, removed)
      
      onPartsChange(newParts)
    }

    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const renderPart = (part: HierarchicalPart, level: number = 0) => {
    const id = part.id || part.tempId || ''
    const hasChildren = part.children && part.children.length > 0
    const isExpanded = expandedIds.has(id)
    const isEditing = editingId === id
    const isDragging = draggedId === id
    const isDragOver = dragOverId === id

    return (
      <div key={id} className="select-none">
        <div 
          className={`p-3 rounded-lg border bg-white transition-all ${
            level > 0 ? 'ml-6 mt-2' : 'mt-2'
          } ${isDragging ? 'opacity-50 border-blue-300' : 'border-gray-200 hover:border-gray-300'} ${
            isDragOver ? 'border-blue-500 border-2 bg-blue-50' : ''
          }`}
          draggable
          onDragStart={(e) => handleDragStart(e, id)}
          onDragOver={(e) => handleDragOver(e, id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, id)}
          onDragEnd={handleDragEnd}
        >
          {/* Header row */}
          <div className="flex items-center gap-2 group">
            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Expand/collapse button */}
            <button
              type="button"
              onClick={() => toggleExpand(id)}
              className={`p-1 rounded hover:bg-gray-100 ${hasChildren ? '' : 'invisible'}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {/* Folder icon */}
            {hasChildren ? (
              <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 flex-shrink-0" />
            )}

            {/* Name input */}
            {isEditing || !part.name ? (
              <input
                type="text"
                value={part.name}
                onChange={(e) => updatePart(id, "name", e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                placeholder="Navn på del..."
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                autoFocus
              />
            ) : (
              <span
                onClick={() => setEditingId(id)}
                className="flex-1 text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
              >
                {part.name}
              </span>
            )}

            {/* Action buttons - show on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => addPart(id)}
                className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                title="Legg til underdel"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(id)}
                className="p-1.5 rounded hover:bg-red-100 text-red-500"
                title="Slett"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details row - always visible */}
          <div className="mt-2 ml-9 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={part.description || ""}
                onChange={(e) => updatePart(id, "description", e.target.value)}
                placeholder="Beskrivelse (valgfri)"
                className="px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300"
              />
              <input
                type="number"
                value={part.capacity || ""}
                onChange={(e) => updatePart(id, "capacity", e.target.value)}
                placeholder="Kapasitet"
                className="px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300"
              />
            </div>
            <textarea
              value={part.adminNote || ""}
              onChange={(e) => updatePart(id, "adminNote", e.target.value)}
              placeholder="Admin notat (f.eks. 'Nøkler hentes i resepsjonen' - vises i godkjent e-post)"
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300 resize-none"
            />
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-gray-200 ml-4">
            {part.children!.map(child => renderPart(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Get part name for delete confirmation
  const getPartName = (id: string): string => {
    const part = parts.find(p => (p.id || p.tempId) === id)
    return part?.name || 'denne delen'
  }

  // Count children for delete confirmation
  const countChildren = (id: string): number => {
    let count = 0
    const findChildren = (parentId: string) => {
      parts.forEach(p => {
        if (p.parentId === parentId) {
          count++
          findChildren(p.id || p.tempId || '')
        }
      })
    }
    findChildren(id)
    return count
  }

  return (
    <div className="space-y-3">
      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Slette del?</h3>
            <p className="text-gray-600 mb-4">
              Er du sikker på at du vil slette <strong>{getPartName(deleteConfirmId)}</strong>?
              {countChildren(deleteConfirmId) > 0 && (
                <span className="block mt-2 text-red-600">
                  ⚠️ Dette vil også slette {countChildren(deleteConfirmId)} underdel{countChildren(deleteConfirmId) > 1 ? 'er' : ''}.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePart(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Ja, slett
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tree view */}
      <div className="border border-gray-200 rounded-xl p-3 min-h-[100px] bg-white">
        {tree.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Ingen deler lagt til ennå
          </p>
        ) : (
          <div className="space-y-1">
            {tree.map(part => renderPart(part))}
          </div>
        )}
      </div>

      {/* Add root part button */}
      <button
        type="button"
        onClick={() => addPart(null)}
        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Legg til hoveddel
      </button>

      {/* Help text */}
      <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
        <p><strong>Tips:</strong></p>
        <p>• Dra i <GripVertical className="w-3 h-3 inline" /> for å endre rekkefølgen</p>
        <p>• Klikk <Plus className="w-3 h-3 inline" /> på en del for å legge til underdel</p>
        <p>• <strong>Hoveddeler</strong> blokkerer alle sine underdeler når de bookes</p>
      </div>
    </div>
  )
}
