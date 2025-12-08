"use client"

import { useState } from "react"
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  GripVertical,
  FolderOpen,
  Folder,
  CornerDownRight
} from "lucide-react"

export interface HierarchicalPart {
  id?: string
  tempId?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
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

  // Flatten tree back to list
  const flattenTree = (tree: HierarchicalPart[], parentId: string | null = null): HierarchicalPart[] => {
    const result: HierarchicalPart[] = []
    
    tree.forEach(node => {
      const { children, ...partData } = node
      result.push({ ...partData, parentId })
      
      if (children && children.length > 0) {
        result.push(...flattenTree(children, node.id || node.tempId))
      }
    })
    
    return result
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
      const partId = p.id || p.tempId
      if (partId === id) {
        return { ...p, [field]: value }
      }
      return p
    })
    onPartsChange(updated)
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

  const renderPart = (part: HierarchicalPart, level: number = 0) => {
    const id = part.id || part.tempId || ''
    const hasChildren = part.children && part.children.length > 0
    const isExpanded = expandedIds.has(id)
    const isEditing = editingId === id

    return (
      <div key={id} className="select-none">
        <div 
          className={`p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors ${
            level > 0 ? 'ml-6 mt-2' : 'mt-2'
          }`}
        >
          {/* Header row */}
          <div className="flex items-center gap-2 group">
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

            {/* Action buttons */}
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
                onClick={() => deletePart(id)}
                className="p-1.5 rounded hover:bg-red-100 text-red-600"
                title="Slett"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details row - always visible when name exists */}
          {part.name && (
            <div className="grid grid-cols-2 gap-2 mt-2 ml-7">
              <input
                type="text"
                value={part.description}
                onChange={(e) => updatePart(id, "description", e.target.value)}
                placeholder="Beskrivelse (valgfri)"
                className="px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300"
              />
              <input
                type="number"
                value={part.capacity}
                onChange={(e) => updatePart(id, "capacity", e.target.value)}
                placeholder="Kapasitet"
                className="px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300"
              />
            </div>
          )}
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

  return (
    <div className="space-y-3">
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
        <p><strong>Hvordan det fungerer:</strong></p>
        <p>• <strong>Hoveddeler</strong> (øverste nivå) blokkerer alle sine underdeler når de bookes</p>
        <p>• Klikk <Plus className="w-3 h-3 inline" /> på en del for å legge til underdel</p>
        <p>• Eksempel: "Hele banen" → "Bane 1", "Bane 2" → "Bane 1A", "Bane 1B"</p>
      </div>
    </div>
  )
}

