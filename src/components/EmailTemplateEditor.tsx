"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, Loader2, Save, RotateCcw, AlertCircle, CheckCircle2, Info, Code, Eye, Bold, Italic, Underline, List, AlignLeft } from "lucide-react"

interface EmailTemplate {
  templateType: string
  subject: string
  htmlBody: string
  isCustom: boolean
  customId: string | null
}

interface EmailTemplateEditorProps {
  template: EmailTemplate
  onSave: (template: EmailTemplate) => Promise<void>
  onReset: () => Promise<void>
}

const templateLabels: Record<string, { name: string; description: string }> = {
  new_booking: {
    name: "Ny bookingforespørsel",
    description: "Sendes til administratorer når en ny booking opprettes",
  },
  approved: {
    name: "Booking godkjent",
    description: "Sendes til brukeren når booking blir godkjent",
  },
  rejected: {
    name: "Booking avslått",
    description: "Sendes til brukeren når booking blir avslått",
  },
  cancelled_by_admin: {
    name: "Booking kansellert (av admin)",
    description: "Sendes til brukeren når admin kansellerer booking",
  },
  cancelled_by_user: {
    name: "Booking kansellert (av bruker)",
    description: "Sendes til administratorer når bruker kansellerer booking",
  },
}

const availableVariables = [
  { name: "bookingTitle", description: "Arrangementets navn" },
  { name: "resourceName", description: "Navn på fasilitet" },
  { name: "date", description: "Dato for booking" },
  { name: "time", description: "Tidspunkt for booking" },
  { name: "userName", description: "Navn på bruker" },
  { name: "userEmail", description: "E-post til bruker" },
  { name: "description", description: "Beskrivelse av booking (valgfritt)" },
  { name: "reason", description: "Årsak til avslag/kansellering (valgfritt)" },
]

export function EmailTemplateEditor({ template, onSave, onReset }: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(template.subject)
  const [htmlBody, setHtmlBody] = useState(template.htmlBody)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showVariables, setShowVariables] = useState(false)
  const [editorMode, setEditorMode] = useState<"html" | "wysiwyg">("html")
  const wysiwygRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSubject(template.subject)
    setHtmlBody(template.htmlBody)
  }, [template])

  // Sync WYSIWYG editor with HTML when switching modes
  useEffect(() => {
    if (editorMode === "wysiwyg" && wysiwygRef.current) {
      wysiwygRef.current.innerHTML = htmlBody
    }
  }, [editorMode, htmlBody])

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await onSave({
        ...template,
        subject,
        htmlBody,
      })
      setMessage({ type: "success", text: "E-postmal lagret!" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: "error", text: "Kunne ikke lagre e-postmal" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Er du sikker på at du vil tilbakestille til standardmal?")) {
      return
    }
    setIsResetting(true)
    setMessage(null)
    try {
      await onReset()
      setMessage({ type: "success", text: "E-postmal tilbakestilt til standard" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: "error", text: "Kunne ikke tilbakestille" })
    } finally {
      setIsResetting(false)
    }
  }

  const insertVariable = (varName: string) => {
    if (editorMode === "html") {
      const textarea = document.getElementById(`htmlBody-${template.templateType}`) as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value
        const before = text.substring(0, start)
        const after = text.substring(end)
        const variable = `{{${varName}}}`
        setHtmlBody(before + variable + after)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + variable.length, start + variable.length)
        }, 0)
      }
    } else {
      // WYSIWYG mode - insert variable at cursor position
      if (wysiwygRef.current) {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const variableNode = document.createTextNode(`{{${varName}}}`)
          range.insertNode(variableNode)
          range.setStartAfter(variableNode)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          
          // Update HTML body
          setHtmlBody(wysiwygRef.current.innerHTML)
        }
      }
    }
  }

  const handleWysiwygChange = () => {
    if (wysiwygRef.current) {
      setHtmlBody(wysiwygRef.current.innerHTML)
    }
  }

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (wysiwygRef.current) {
      wysiwygRef.current.focus()
      setHtmlBody(wysiwygRef.current.innerHTML)
    }
  }

  const toggleEditorMode = () => {
    if (editorMode === "html") {
      // Switching to WYSIWYG - set content
      setEditorMode("wysiwyg")
      if (wysiwygRef.current) {
        wysiwygRef.current.innerHTML = htmlBody
      }
    } else {
      // Switching to HTML - get content from WYSIWYG
      if (wysiwygRef.current) {
        setHtmlBody(wysiwygRef.current.innerHTML)
      }
      setEditorMode("html")
    }
  }

  const label = templateLabels[template.templateType] || {
    name: template.templateType,
    description: "",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {template.isCustom && (
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isResetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Tilbakestill
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Lagre
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            E-post emne *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input w-full"
            placeholder="F.eks. Booking godkjent: {{bookingTitle}}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Bruk variabler som <code className="bg-gray-100 px-1 rounded">{"{{bookingTitle}}"}</code> for dynamisk innhold
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              E-post innhold *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Info className="w-3 h-3" />
                {showVariables ? "Skjul" : "Vis"} variabler
              </button>
              <button
                type="button"
                onClick={toggleEditorMode}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                title={editorMode === "html" ? "Bytt til tekst" : "Bytt til HTML"}
              >
                {editorMode === "html" ? (
                  <>
                    <Eye className="w-3 h-3" />
                    Tekst
                  </>
                ) : (
                  <>
                    <Code className="w-3 h-3" />
                    HTML
                  </>
                )}
              </button>
            </div>
          </div>

          {showVariables && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-2">Tilgjengelige variabler:</p>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    onClick={() => insertVariable(variable.name)}
                    className="px-2 py-1 text-xs bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                    title={variable.description}
                  >
                    {"{{" + variable.name + "}}"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Klikk på en variabel for å sette den inn i malen
              </p>
            </div>
          )}

          {editorMode === "html" ? (
            <>
              <textarea
                id={`htmlBody-${template.templateType}`}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                className="input w-full font-mono text-sm"
                rows={15}
                placeholder="HTML-innhold for e-posten..."
              />
              <p className="text-xs text-gray-500 mt-1">
                HTML-format. Bruk variabler som <code className="bg-gray-100 px-1 rounded">{"{{variableName}}"}</code> for dynamisk innhold
              </p>
            </>
          ) : (
            <>
              {/* WYSIWYG Toolbar */}
              <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg border-b-0">
                <button
                  type="button"
                  onClick={() => applyFormat("bold")}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Fet"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("italic")}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Kursiv"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("underline")}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Understreket"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => applyFormat("insertUnorderedList")}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Punktliste"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("justifyLeft")}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Venstrejuster"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
              </div>
              
              {/* WYSIWYG Editor */}
              <div
                ref={wysiwygRef}
                contentEditable
                onInput={handleWysiwygChange}
                className="input w-full min-h-[300px] p-4 bg-white border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent prose prose-sm max-w-none"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
                suppressContentEditableWarning
              />
              <p className="text-xs text-gray-500 mt-1">
                Tekst-redigering. Variabler som <code className="bg-gray-100 px-1 rounded">{"{{variableName}}"}</code> vil vises som tekst, men fungerer i e-posten
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

