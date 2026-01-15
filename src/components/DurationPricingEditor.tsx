"use client"

import { useState } from "react"
import { Plus, Trash2, Edit2, X, DollarSign } from "lucide-react"

export interface PricingRule {
  forRoles: string[]
  model: "FREE" | "HOURLY" | "DAILY" | "FIXED_DURATION"
  pricePerHour?: string
  pricePerDay?: string
  fixedPrice?: string
  fixedPriceDuration?: string
}

interface CustomRole {
  id: string
  name: string
}

interface DurationPricingEditorProps {
  rules: PricingRule[]
  onChange: (rules: PricingRule[]) => void
  customRoles?: CustomRole[]
  disabled?: boolean
}

// Helper: Get display name for a role
function getRoleName(roleId: string, customRoles: CustomRole[]): string {
  if (roleId === "admin") return "Administrator"
  if (roleId === "member") return "Medlem"
  if (roleId === "user") return "Ikke medlem"
  const customRole = customRoles.find(r => r.id === roleId)
  return customRole?.name || roleId
}

// Helper: Get price description
function getPriceDescription(rule: PricingRule): string {
  switch (rule.model) {
    case "FREE":
      return "Gratis"
    case "HOURLY":
      const hourlyPrice = rule.pricePerHour ? parseFloat(rule.pricePerHour) : 0
      return hourlyPrice > 0 ? `${Math.round(hourlyPrice)} kr/time` : "Timepris (ikke satt)"
    case "DAILY":
      const dailyPrice = rule.pricePerDay ? parseFloat(rule.pricePerDay) : 0
      return dailyPrice > 0 ? `${Math.round(dailyPrice)} kr/døgn` : "Døgnpris (ikke satt)"
    case "FIXED_DURATION":
      const fixedPrice = rule.fixedPrice ? parseFloat(rule.fixedPrice) : 0
      const duration = rule.fixedPriceDuration ? parseInt(rule.fixedPriceDuration) : 0
      const hours = Math.floor(duration / 60)
      const mins = duration % 60
      const durationStr = hours > 0 && mins > 0 
        ? `${hours}t ${mins}m` 
        : hours > 0 ? `${hours}t` : `${mins}m`
      return fixedPrice > 0 ? `${Math.round(fixedPrice)} kr / ${durationStr}` : "Fast pris (ikke satt)"
    default:
      return "Ukjent"
  }
}

// Helper: Get roles description
function getRolesDescription(rule: PricingRule, customRoles: CustomRole[]): string {
  if (rule.forRoles.length === 0) {
    return "Alle (standard)"
  }
  return rule.forRoles.map(r => getRoleName(r, customRoles)).join(", ")
}

export default function DurationPricingEditor({
  rules,
  onChange,
  customRoles = [],
  disabled = false
}: DurationPricingEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<PricingRule | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRule, setNewRule] = useState<PricingRule>({
    forRoles: [],
    model: "HOURLY",
    pricePerHour: "",
    pricePerDay: "",
    fixedPrice: "",
    fixedPriceDuration: ""
  })

  const handleAdd = () => {
    onChange([...rules, { ...newRule }])
    setNewRule({
      forRoles: [],
      model: "HOURLY",
      pricePerHour: "",
      pricePerDay: "",
      fixedPrice: "",
      fixedPriceDuration: ""
    })
    setShowAddForm(false)
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...rules[index] })
  }

  const handleSaveEdit = () => {
    if (editingIndex === null || !editForm) return
    const updatedRules = [...rules]
    updatedRules[editingIndex] = editForm
    onChange(updatedRules)
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleDelete = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  const toggleRole = (rule: PricingRule, roleId: string): PricingRule => {
    const newRoles = rule.forRoles.includes(roleId)
      ? rule.forRoles.filter(r => r !== roleId)
      : [...rule.forRoles, roleId]
    return { ...rule, forRoles: newRoles }
  }

  // All available roles
  const allRoles = [
    { id: "admin", name: "Administrator" },
    { id: "member", name: "Medlem" },
    ...customRoles,
    { id: "user", name: "Ikke medlem" }
  ]

  // Render role checkboxes
  const renderRoleCheckboxes = (rule: PricingRule, setRule: (r: PricingRule) => void) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Gjelder for roller
      </label>
      <div className="space-y-1.5 p-3 bg-gray-50 rounded-lg">
        {allRoles.map(role => (
          <label key={role.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.forRoles.includes(role.id)}
              onChange={() => setRule(toggleRole(rule, role.id))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={disabled}
            />
            <span className="text-sm text-gray-700">{role.name}</span>
          </label>
        ))}
        {rule.forRoles.length === 0 && (
          <p className="text-xs text-gray-500 italic pt-1">
            Ingen roller valgt = standard for alle som ikke matcher andre regler
          </p>
        )}
      </div>
    </div>
  )

  // Render price input based on model
  const renderPriceInput = (rule: PricingRule, setRule: (r: PricingRule) => void) => {
    switch (rule.model) {
      case "FREE":
        return (
          <p className="text-sm text-gray-500 italic">
            Gratis tilgang - ingen pris å sette
          </p>
        )
      case "HOURLY":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pris per time (NOK)
            </label>
            <input
              type="number"
              value={rule.pricePerHour || ""}
              onChange={(e) => setRule({ ...rule, pricePerHour: e.target.value })}
              className="input max-w-[150px]"
              placeholder="500"
              min="0"
              step="1"
              disabled={disabled}
            />
          </div>
        )
      case "DAILY":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pris per døgn (NOK)
            </label>
            <input
              type="number"
              value={rule.pricePerDay || ""}
              onChange={(e) => setRule({ ...rule, pricePerDay: e.target.value })}
              className="input max-w-[150px]"
              placeholder="2000"
              min="0"
              step="1"
              disabled={disabled}
            />
          </div>
        )
      case "FIXED_DURATION":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fast pris (NOK)
              </label>
              <input
                type="number"
                value={rule.fixedPrice || ""}
                onChange={(e) => setRule({ ...rule, fixedPrice: e.target.value })}
                className="input"
                placeholder="1000"
                min="0"
                step="1"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Varighet (min)
              </label>
              <input
                type="number"
                value={rule.fixedPriceDuration || ""}
                onChange={(e) => setRule({ ...rule, fixedPriceDuration: e.target.value })}
                className="input"
                placeholder="120"
                min="1"
                disabled={disabled}
              />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Render form (used for both add and edit)
  const renderForm = (
    rule: PricingRule, 
    setRule: (r: PricingRule) => void,
    onSave: () => void,
    onCancel: () => void,
    isNew: boolean
  ) => (
    <div className="p-4 bg-white border-2 border-blue-300 rounded-lg space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h4 className="font-medium text-gray-900">
          {isNew ? "Ny varighetspris" : "Rediger varighetspris"}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type
        </label>
        <select
          value={rule.model}
          onChange={(e) => setRule({ ...rule, model: e.target.value as PricingRule["model"] })}
          className="input max-w-[200px]"
          disabled={disabled}
        >
          <option value="FREE">Gratis</option>
          <option value="HOURLY">Timepris</option>
          <option value="DAILY">Døgnpris</option>
          <option value="FIXED_DURATION">Fast pris (med varighet)</option>
        </select>
      </div>

      {renderPriceInput(rule, setRule)}
      {renderRoleCheckboxes(rule, setRule)}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary text-sm py-1.5"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={onSave}
          className="btn btn-primary text-sm py-1.5"
          disabled={disabled}
        >
          {isNew ? "Legg til" : "Lagre"}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Varighetspriser
        </h4>
        {!disabled && !showAddForm && editingIndex === null && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4" />
            Legg til
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && renderForm(
        newRule,
        setNewRule,
        handleAdd,
        () => setShowAddForm(false),
        true
      )}

      {/* Rules list */}
      {rules.length === 0 && !showAddForm && (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
          Ingen varighetspriser satt. Klikk "Legg til" for å begynne.
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule, index) => {
          // Edit mode
          if (editingIndex === index && editForm) {
            return (
              <div key={index}>
                {renderForm(
                  editForm,
                  setEditForm,
                  handleSaveEdit,
                  handleCancelEdit,
                  false
                )}
              </div>
            )
          }

          // View mode - compact card
          const priceDesc = getPriceDescription(rule)
          const rolesDesc = getRolesDescription(rule, customRoles)
          const isWarning = rule.model !== "FREE" && 
            !rule.pricePerHour && !rule.pricePerDay && !rule.fixedPrice

          return (
            <div
              key={index}
              className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                isWarning 
                  ? "bg-red-50 border-red-200 hover:bg-red-100" 
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => !disabled && handleEdit(index)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  rule.model === "FREE" ? "bg-green-100" : "bg-blue-100"
                }`}>
                  {rule.model === "FREE" ? (
                    <span className="text-green-600 text-xs font-bold">🆓</span>
                  ) : (
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`font-medium truncate ${
                    isWarning ? "text-red-700" : "text-gray-900"
                  }`}>
                    {priceDesc}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {rolesDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(index)
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Rediger"
                  disabled={disabled}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(index)
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Slett"
                  disabled={disabled}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

