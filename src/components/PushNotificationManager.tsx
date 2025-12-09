"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Bell, BellOff, X, Smartphone } from "lucide-react"

export function PushNotificationManager() {
  const { data: session } = useSession()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return
    }

    setPermission(Notification.permission)

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)

      // Show prompt for admins who haven't decided yet
      if (isAdmin && Notification.permission === "default") {
        setTimeout(() => setShowPrompt(true), 3000)
      }
    })
  }, [isAdmin])

  const subscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push-varsler støttes ikke i denne nettleseren")
      return
    }

    setIsLoading(true)

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      setPermission(permission)

      if (permission !== "granted") {
        setShowPrompt(false)
        setIsLoading(false)
        return
      }

      // Register service worker if not already
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Get VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error("VAPID public key not configured")
        setIsLoading(false)
        return
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })

      // Send subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      })

      if (response.ok) {
        setIsSubscribed(true)
        setShowPrompt(false)
      }
    } catch (error) {
      console.error("Failed to subscribe:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const unsubscribe = async () => {
    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        })
      }

      setIsSubscribed(false)
    } catch (error) {
      console.error("Failed to unsubscribe:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Only show for admins
  if (!isAdmin) return null

  // Prompt card for first-time setup
  if (showPrompt && permission === "default") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slideUp">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5" />
              <span className="font-medium">Push-varsler</span>
            </div>
            <button 
              onClick={() => setShowPrompt(false)}
              className="text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm mb-4">
              Få varsel på mobilen når noen sender en ny bookingforespørsel!
            </p>
            <div className="flex gap-2">
              <button
                onClick={subscribe}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? "Aktiverer..." : "Aktiver varsler"}
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Senere
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Settings toggle in navbar (optional)
  return null
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Export a button component for use in settings
export function PushNotificationToggle() {
  const { data: session } = useSession()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>("default")

  const isAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setIsLoading(false)
      return
    }

    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [])

  if (!isAdmin || !("Notification" in window)) {
    return null
  }

  const toggle = async () => {
    if (isSubscribed) {
      // Unsubscribe logic
      setIsLoading(true)
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          })
        }
        setIsSubscribed(false)
      } finally {
        setIsLoading(false)
      }
    } else {
      // Subscribe logic
      setIsLoading(true)
      try {
        const perm = await Notification.requestPermission()
        setPermission(perm)
        if (perm !== "granted") {
          setIsLoading(false)
          return
        }

        const registration = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          setIsLoading(false)
          return
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        })

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON())
        })

        if (response.ok) {
          setIsSubscribed(true)
        }
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={isLoading || permission === "denied"}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isSubscribed
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : permission === "denied"
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
      }`}
    >
      {isSubscribed ? (
        <>
          <Bell className="w-4 h-4" />
          Varsler aktivert
        </>
      ) : permission === "denied" ? (
        <>
          <BellOff className="w-4 h-4" />
          Varsler blokkert
        </>
      ) : (
        <>
          <Bell className="w-4 h-4" />
          {isLoading ? "Aktiverer..." : "Aktiver varsler"}
        </>
      )}
    </button>
  )
}

