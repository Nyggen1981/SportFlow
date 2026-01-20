"use client"

import { useState } from "react"
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Upload,
  X,
  ImageIcon,
  Users,
  FileText,
  Layers
} from "lucide-react"

export interface HierarchicalPart {
  id?: string
  tempId?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
  adminNote?: string | null
  image?: string | null
  parentId?: string | null
  children?: HierarchicalPart[]
  isNew?: boolean
  pricingRules?: any[]
}

interface Props {
  parts: HierarchicalPart[]
  onPartsChange: (parts: HierarchicalPart[]) => void
}

export function PartsHierarchyEditor({ parts, onPartsChange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingPart, setEditingPart] = useState<HierarchicalPart | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
      image: null,
      parentId,
      isNew: true
    }
    
    onPartsChange([...parts, newPart])
    setEditingPart(newPart)
    
    // Expand parent if adding child
    if (parentId) {
      setExpandedIds(new Set([...expandedIds, parentId]))
    }
  }

  const handleImageUpload = (file: File) => {
    if (!editingPart) return
    
    if (file.size > 1024 * 1024) {
      alert("Bildet er for stort. Maks 1MB.")
      return
    }

    if (!file.type.startsWith("image/")) {
      alert("Filen må være et bilde")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditingPart({ ...editingPart, image: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const saveEditingPart = () => {
    if (!editingPart) return
    
    const id = editingPart.id || editingPart.tempId
    const updated = parts.map(p => {
      const partId = p.id || p.tempId || ''
      if (partId === id) {
        return { ...editingPart }
      }
      return p
    })
    
    // Check if it's a new part
    const exists = parts.some(p => (p.id || p.tempId) === id)
    if (!exists) {
      onPartsChange([...parts, editingPart])
    } else {
      onPartsChange(updated)
    }
    
    setEditingPart(null)
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

    return (
      <div key={id}>
        {/* Part Card */}
        <div 
          className={`
            bg-white border rounded-xl p-4 transition-all hover:shadow-md
            ${level === 0 ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'}
            ${level > 0 ? 'ml-8 mt-2' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            {/* Expand button for children - only show if has children */}
            <button
              type="button"
              onClick={() => hasChildren && toggleExpand(id)}
              className={`
                mt-1 p-1 rounded-lg transition-colors flex-shrink-0
                ${hasChildren 
                  ? 'hover:bg-gray-100 cursor-pointer text-gray-600' 
                  : 'text-gray-300 cursor-default'
                }
              `}
              disabled={!hasChildren}
              title={hasChildren ? (isExpanded ? "Skjul underdeler" : "Vis underdeler") : "Ingen underdeler"}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )
              ) : (
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                </div>
              )}
            </button>

            {/* Main content - clickable to edit */}
            <div 
              className="flex-1 min-w-0 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
              onClick={() => {
                const fullPart = parts.find(p => (p.id || p.tempId) === id) || part
                setEditingPart({ ...fullPart })
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900">
                  {part.name || <span className="text-gray-400 italic">Uten navn</span>}
                </h4>
                
                {/* Badges */}
                {part.capacity && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    <Users className="w-3 h-3" />
                    {part.capacity}
                  </span>
                )}
                {part.image && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                    <ImageIcon className="w-3 h-3" />
                    Bilde
                  </span>
                )}
                {part.adminNote && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                    <FileText className="w-3 h-3" />
                    Notat
                  </span>
                )}
                {hasChildren && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                    <Layers className="w-3 h-3" />
                    {part.children!.length} underdel{part.children!.length > 1 ? 'er' : ''}
                  </span>
                )}
              </div>
              
              {part.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{part.description}</p>
              )}
            </div>

            {/* Action buttons - always visible */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => addPart(id)}
                className="p-2 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
                title="Legg til underdel"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(id)}
                className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                title="Slett"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Children - rendered with indent */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Vertical line connecting children */}
            <div className="absolute left-6 top-0 bottom-4 w-px bg-blue-200" />
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
      {/* Edit Modal */}
      {editingPart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingPart.isNew ? "Ny del" : "Rediger del"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal content */}
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Navn på del <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingPart.name}
                  onChange={(e) => setEditingPart({ ...editingPart, name: e.target.value })}
                  placeholder="F.eks. Bane 1, Sal A, Møterom Nord..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Beskrivelse
                </label>
                <input
                  type="text"
                  value={editingPart.description || ""}
                  onChange={(e) => setEditingPart({ ...editingPart, description: e.target.value })}
                  placeholder="Kort beskrivelse av delen (valgfritt)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kapasitet (antall personer)
                </label>
                <input
                  type="number"
                  value={editingPart.capacity || ""}
                  onChange={(e) => setEditingPart({ ...editingPart, capacity: e.target.value })}
                  placeholder="F.eks. 20"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bilde
                </label>
                {editingPart.image ? (
                  <div className="relative">
                    <img 
                      src={editingPart.image} 
                      alt={editingPart.name}
                      className="w-full h-40 object-cover rounded-xl border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingPart({ ...editingPart, image: null })}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      title="Fjern bilde"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-500">Klikk for å laste opp bilde</span>
                    <span className="text-xs text-gray-400">Maks 1MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file)
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin-notat
                </label>
                <textarea
                  value={editingPart.adminNote || ""}
                  onChange={(e) => setEditingPart({ ...editingPart, adminNote: e.target.value })}
                  placeholder="F.eks. 'Nøkler hentes i resepsjonen' - vises i godkjent booking-epost"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dette notatet vises til brukeren når bookingen er godkjent
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                type="button"
                onClick={() => setEditingPart(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={saveEditingPart}
                disabled={!editingPart.name.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingPart.isNew ? "Legg til" : "Lagre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Slette del?</h3>
            <p className="text-gray-600 text-center mb-6">
              Er du sikker på at du vil slette <strong>{getPartName(deleteConfirmId)}</strong>?
              {countChildren(deleteConfirmId) > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Dette vil også slette {countChildren(deleteConfirmId)} underdel{countChildren(deleteConfirmId) > 1 ? 'er' : ''}!
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePart(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Ja, slett
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parts list */}
      {tree.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">Ingen deler lagt til ennå</p>
          <p className="text-sm text-gray-400">Legg til deler for å la brukere booke spesifikke områder</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map(part => renderPart(part))}
        </div>
      )}

      {/* Add root part button */}
      <button
        type="button"
        onClick={() => addPart(null)}
        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-5 h-5" />
        Legg til ny del
      </button>

      {/* Help text */}
      {tree.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">💡 Tips</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Klikk på en del</strong> for å redigere den</li>
            <li>• Klikk <strong>+</strong> for å legge til underdeler</li>
            <li>• Hoveddeler blokkerer automatisk alle underdeler når de bookes</li>
            <li>• Klikk på pilen for å se/skjule underdeler</li>
          </ul>
        </div>
      )}
    </div>
  )
}
