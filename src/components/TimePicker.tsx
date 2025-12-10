"use client"

import { useState, useRef, useEffect } from "react"
import { Clock, ChevronUp, ChevronDown } from "lucide-react"

interface TimePickerProps {
  value: string
  onChange: (time: string) => void
  label?: string
  required?: boolean
  minTime?: string // Optional minimum time (HH:mm format)
}

export function TimePicker({ value, onChange, label, required, minTime }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Parse current value
  const [hour, minute] = value ? value.split(":").map(Number) : [-1, -1]
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const setTime = (h: number, m: number) => {
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    onChange(timeStr)
  }

  const adjustHour = (delta: number) => {
    const newHour = hour === -1 ? (delta > 0 ? 0 : 23) : (hour + delta + 24) % 24
    const newMinute = minute === -1 ? 0 : minute
    setTime(newHour, newMinute)
  }

  const adjustMinute = (delta: number) => {
    if (hour === -1) {
      setTime(0, delta > 0 ? 0 : 45)
      return
    }
    const minutes = [0, 15, 30, 45]
    const currentIdx = minutes.indexOf(minute)
    const newIdx = currentIdx === -1 ? 0 : (currentIdx + delta + 4) % 4
    setTime(hour, minutes[newIdx])
  }

  // Check if a time is valid based on minTime
  const isTimeValid = (h: number, m: number) => {
    if (!minTime) return true
    const [minH, minM] = minTime.split(":").map(Number)
    return h > minH || (h === minH && m >= minM)
  }

  // Quick select buttons for common times
  const quickTimes = [
    { label: "Morgen", times: [7, 8, 9, 10] },
    { label: "Midt på dagen", times: [11, 12, 13, 14] },
    { label: "Ettermiddag", times: [15, 16, 17, 18] },
    { label: "Kveld", times: [19, 20, 21, 22] },
  ]

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Clock className="w-4 h-4 inline mr-1" />
          {label} {required && "*"}
        </label>
      )}
      
      {/* Display field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full text-left flex items-center justify-between"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value || "Velg tid"}
        </span>
        <Clock className="w-4 h-4 text-gray-400" />
      </button>

      {/* Picker popup */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72 animate-in fade-in slide-in-from-top-2">
          {/* Spinner style picker */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {/* Hour */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => adjustHour(1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronUp className="w-5 h-5 text-gray-500" />
              </button>
              <div className="text-3xl font-bold text-gray-900 w-14 text-center py-2">
                {hour === -1 ? "--" : hour.toString().padStart(2, "0")}
              </div>
              <button
                type="button"
                onClick={() => adjustHour(-1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronDown className="w-5 h-5 text-gray-500" />
              </button>
              <span className="text-xs text-gray-500 mt-1">Time</span>
            </div>

            <span className="text-3xl font-bold text-gray-300">:</span>

            {/* Minute */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => adjustMinute(1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronUp className="w-5 h-5 text-gray-500" />
              </button>
              <div className="text-3xl font-bold text-gray-900 w-14 text-center py-2">
                {minute === -1 ? "--" : minute.toString().padStart(2, "0")}
              </div>
              <button
                type="button"
                onClick={() => adjustMinute(-1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronDown className="w-5 h-5 text-gray-500" />
              </button>
              <span className="text-xs text-gray-500 mt-1">Minutt</span>
            </div>
          </div>

          {/* Quick minute buttons */}
          <div className="flex gap-2 mb-4 justify-center">
            {[0, 15, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (hour !== -1) setTime(hour, m)
                }}
                disabled={hour === -1}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  minute === m && hour !== -1
                    ? "bg-blue-600 text-white"
                    : hour === -1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                :{m.toString().padStart(2, "0")}
              </button>
            ))}
          </div>

          {/* Quick time grid */}
          <div className="space-y-2">
            {quickTimes.map((group) => (
              <div key={group.label}>
                <p className="text-xs text-gray-500 mb-1">{group.label}</p>
                <div className="flex gap-1">
                  {group.times.map((h) => {
                    const m = minute === -1 ? 0 : minute
                    const isValid = isTimeValid(h, m)
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setTime(h, m)}
                        disabled={!isValid}
                        className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                          hour === h
                            ? "bg-blue-600 text-white"
                            : !isValid
                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                            : "bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
                        }`}
                      >
                        {h.toString().padStart(2, "0")}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={hour === -1 || minute === -1}
            className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Ferdig
          </button>
        </div>
      )}
    </div>
  )
}

