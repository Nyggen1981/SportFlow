"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, Edit2, Save, X, Clock, DollarSign } from "lucide-react"

interface FixedPricePackage {
  id?: string
  name: string
  description: string
  durationMinutes: number
  price: number
  isActive: boolean
  sortOrder: number
  forRoles?: string[]  // Role IDs that can use this package (empty = all roles)
}

interface CustomRole {
  id: string
  name: string
}

interface FixedPricePackagesEditorProps {
  resourceId?: string
  resourcePartId?: string
  packages: FixedPricePackage[]
  onChange: (packages: FixedPricePackage[]) => void
  disabled?: boolean
  customRoles?: CustomRole[]  // Available custom roles for selection
}

export default function FixedPricePackagesEditor({
  resourceId,
  resourcePartId,
  packages,
  onChange,
  disabled = false,
  customRoles = []
}: FixedPricePackagesEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FixedPricePackage | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPackage, setNewPackage] = useState<FixedPricePackage>({
    name: "",
    description: "",
    durationMinutes: 120,
    price: 0,
    isActive: true,
    sortOrder: packages.length,
    forRoles: []
  })

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins} min`
    if (mins === 0) return `${hours} ${hours === 1 ? "time" : "timer"}`
    return `${hours} ${hours === 1 ? "time" : "timer"} ${mins} min`
  }

  // Parse duration input (e.g., "2t30m" or "150" minutes)
  const parseDurationInput = (value: string): number => {
    // Try parsing as just minutes
    const asMinutes = parseInt(value)
    if (!isNaN(asMinutes)) return asMinutes
    return 0
  }

  const handleAdd = () => {
    if (!newPackage.name.trim() || newPackage.price < 0) return

    const updatedPackages = [
      ...packages,
      { ...newPackage, sortOrder: packages.length }
    ]
    onChange(updatedPackages)
    setNewPackage({
      name: "",
      description: "",
      durationMinutes: 120,
      price: 0,
      isActive: true,
      sortOrder: packages.length + 1,
      forRoles: []
    })
    setShowAddForm(false)
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...packages[index] })
  }

  const handleSaveEdit = () => {
    if (editingIndex === null || !editForm) return
    if (!editForm.name.trim() || editForm.price < 0) return

    const updatedPackages = [...packages]
    updatedPackages[editingIndex] = editForm
    onChange(updatedPackages)
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleDelete = (index: number) => {
    const updatedPackages = packages.filter((_, i) => i !== index)
    // Update sort order
    updatedPackages.forEach((pkg, i) => {
      pkg.sortOrder = i
    })
    onChange(updatedPackages)
  }

  const handleToggleActive = (index: number) => {
    const updatedPackages = [...packages]
    updatedPackages[index] = {
      ...updatedPackages[index],
      isActive: !updatedPackages[index].isActive
    }
    onChange(updatedPackages)
  }

  // Duration presets in minutes
  const durationPresets = [
    { label: "30 min", value: 30 },
    { label: "1 time", value: 60 },
    { label: "1,5 time", value: 90 },
    { label: "2 timer", value: 120 },
    { label: "3 timer", value: 180 },
    { label: "4 timer", value: 240 },
    { label: "1 dag (8t)", value: 480 },
    { label: "1 døgn", value: 1440 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Fastprispakker</h4>
        {!disabled && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4" />
            Legg til pakke
          </button>
        )}
      </div>

      {packages.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-500 italic">
          Ingen fastprispakker lagt til. Brukere vil velge start- og sluttid manuelt.
        </p>
      )}

      {/* Existing packages */}
      <div className="space-y-2">
        {packages.map((pkg, index) => (
          <div
            key={pkg.id || index}
            className={`border rounded-lg p-3 ${
              pkg.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-60"
            }`}
          >
            {editingIndex === index && editForm ? (
              // Edit mode
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Navn *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="F.eks. Barneselskap"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pris (NOK) *</label>
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Valgfri beskrivelse"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Varighet</label>
                  <div className="flex flex-wrap gap-2">
                    {durationPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, durationMinutes: preset.value })}
                        className={`px-2 py-1 text-xs rounded-md ${
                          editForm.durationMinutes === preset.value
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Eller angi minutter:</span>
                    <input
                      type="number"
                      value={editForm.durationMinutes}
                      onChange={(e) => setEditForm({ ...editForm, durationMinutes: parseInt(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="15"
                      step="15"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tilgjengelig for roller</label>
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.forRoles?.includes("admin") ?? false}
                        onChange={(e) => {
                          const currentRoles = editForm.forRoles || []
                          if (e.target.checked) {
                            setEditForm({ ...editForm, forRoles: [...currentRoles, "admin"] })
                          } else {
                            setEditForm({ ...editForm, forRoles: currentRoles.filter(r => r !== "admin") })
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Administrator</span>
                    </label>
                    <label className="flex items-center gap-2" title="Godkjente medlemmer av organisasjonen">
                      <input
                        type="checkbox"
                        checked={editForm.forRoles?.includes("member") ?? false}
                        onChange={(e) => {
                          const currentRoles = editForm.forRoles || []
                          if (e.target.checked) {
                            setEditForm({ ...editForm, forRoles: [...currentRoles, "member"] })
                          } else {
                            setEditForm({ ...editForm, forRoles: currentRoles.filter(r => r !== "member") })
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Medlem</span>
                    </label>
                    <label className="flex items-center gap-2" title="Innloggede brukere som ikke er godkjent som medlemmer">
                      <input
                        type="checkbox"
                        checked={editForm.forRoles?.includes("user") ?? false}
                        onChange={(e) => {
                          const currentRoles = editForm.forRoles || []
                          if (e.target.checked) {
                            setEditForm({ ...editForm, forRoles: [...currentRoles, "user"] })
                          } else {
                            setEditForm({ ...editForm, forRoles: currentRoles.filter(r => r !== "user") })
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Ikke medlem</span>
                    </label>
                    {customRoles.map(role => (
                      <label key={role.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.forRoles?.includes(role.id) ?? false}
                          onChange={(e) => {
                            const currentRoles = editForm.forRoles || []
                            if (e.target.checked) {
                              setEditForm({ ...editForm, forRoles: [...currentRoles, role.id] })
                            } else {
                              setEditForm({ ...editForm, forRoles: currentRoles.filter(r => r !== role.id) })
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{role.name}</span>
                      </label>
                    ))}
                    {(!editForm.forRoles || editForm.forRoles.length === 0) && (
                      <p className="text-xs text-gray-500 italic">
                        Ingen roller valgt - pakken er tilgjengelig for alle
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    <X className="h-4 w-4" />
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4" />
                    Lagre
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{pkg.name}</span>
                    {pkg.description && (
                      <span className="text-xs text-gray-500">{pkg.description}</span>
                    )}
                    {pkg.forRoles && pkg.forRoles.length > 0 && (
                      <span className="text-xs text-blue-600">
                        Kun for: {pkg.forRoles.map(r => {
                          if (r === "admin") return "Administrator"
                          if (r === "member") return "Medlem"
                          if (r === "user") return "Ikke medlem"
                          const role = customRoles.find(cr => cr.id === r)
                          return role?.name || r
                        }).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {formatDuration(pkg.durationMinutes)}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                    {pkg.price.toFixed(0)} kr
                  </div>
                  {!disabled && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(index)}
                        className={`px-2 py-1 text-xs rounded ${
                          pkg.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {pkg.isActive ? "Aktiv" : "Inaktiv"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(index)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Rediger"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Slett"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new package form */}
      {showAddForm && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-medium text-blue-800">Ny fastprispakke</h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Navn *</label>
              <input
                type="text"
                value={newPackage.name}
                onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="F.eks. Barneselskap"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pris (NOK) *</label>
              <input
                type="number"
                value={newPackage.price}
                onChange={(e) => setNewPackage({ ...newPackage, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
            <input
              type="text"
              value={newPackage.description}
              onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Valgfri beskrivelse"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Varighet</label>
            <div className="flex flex-wrap gap-2">
              {durationPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setNewPackage({ ...newPackage, durationMinutes: preset.value })}
                  className={`px-2 py-1 text-xs rounded-md ${
                    newPackage.durationMinutes === preset.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Eller angi minutter:</span>
              <input
                type="number"
                value={newPackage.durationMinutes}
                onChange={(e) => setNewPackage({ ...newPackage, durationMinutes: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="15"
                step="15"
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tilgjengelig for roller</label>
            <div className="space-y-2 p-3 bg-white rounded-lg border border-blue-200 max-h-40 overflow-y-auto">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPackage.forRoles?.includes("admin") ?? false}
                  onChange={(e) => {
                    const currentRoles = newPackage.forRoles || []
                    if (e.target.checked) {
                      setNewPackage({ ...newPackage, forRoles: [...currentRoles, "admin"] })
                    } else {
                      setNewPackage({ ...newPackage, forRoles: currentRoles.filter(r => r !== "admin") })
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Administrator</span>
              </label>
              <label className="flex items-center gap-2" title="Godkjente medlemmer av organisasjonen">
                <input
                  type="checkbox"
                  checked={newPackage.forRoles?.includes("member") ?? false}
                  onChange={(e) => {
                    const currentRoles = newPackage.forRoles || []
                    if (e.target.checked) {
                      setNewPackage({ ...newPackage, forRoles: [...currentRoles, "member"] })
                    } else {
                      setNewPackage({ ...newPackage, forRoles: currentRoles.filter(r => r !== "member") })
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Medlem</span>
              </label>
              <label className="flex items-center gap-2" title="Innloggede brukere som ikke er godkjent som medlemmer">
                <input
                  type="checkbox"
                  checked={newPackage.forRoles?.includes("user") ?? false}
                  onChange={(e) => {
                    const currentRoles = newPackage.forRoles || []
                    if (e.target.checked) {
                      setNewPackage({ ...newPackage, forRoles: [...currentRoles, "user"] })
                    } else {
                      setNewPackage({ ...newPackage, forRoles: currentRoles.filter(r => r !== "user") })
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Ikke medlem</span>
              </label>
              {customRoles.map(role => (
                <label key={role.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newPackage.forRoles?.includes(role.id) ?? false}
                    onChange={(e) => {
                      const currentRoles = newPackage.forRoles || []
                      if (e.target.checked) {
                        setNewPackage({ ...newPackage, forRoles: [...currentRoles, role.id] })
                      } else {
                        setNewPackage({ ...newPackage, forRoles: currentRoles.filter(r => r !== role.id) })
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{role.name}</span>
                </label>
              ))}
              {(!newPackage.forRoles || newPackage.forRoles.length === 0) && (
                <p className="text-xs text-gray-500 italic">
                  Ingen roller valgt - pakken er tilgjengelig for alle
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-blue-200">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewPackage({
                  name: "",
                  description: "",
                  durationMinutes: 120,
                  price: 0,
                  isActive: true,
                  sortOrder: packages.length,
                  forRoles: []
                })
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newPackage.name.trim() || newPackage.price < 0}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Legg til
            </button>
          </div>
        </div>
      )}

      {packages.length > 0 && (
        <p className="text-xs text-gray-500">
          Når fastprispakker er definert, vil brukere kunne velge en pakke ved booking.
          Sluttid beregnes automatisk basert på valgt pakke og starttid.
        </p>
      )}
    </div>
  )
}

