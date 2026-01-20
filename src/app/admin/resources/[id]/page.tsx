"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import Image from "next/image"
import { 
  ArrowLeft,
  Loader2,
  Save,
  Building2,
  Upload,
  X,
  ImageIcon,
  Map,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Info,
  Calendar,
  DollarSign,
  Layers,
  Settings
} from "lucide-react"
import { MapEditor } from "@/components/MapEditor"
import { PartsHierarchyEditor, HierarchicalPart } from "@/components/PartsHierarchyEditor"
import FixedPricePackagesEditor from "@/components/FixedPricePackagesEditor"
import DurationPricingEditor, { PricingRule } from "@/components/DurationPricingEditor"

interface FixedPricePackage {
  id?: string
  name: string
  description: string
  durationMinutes: number
  price: number
  isActive: boolean
  sortOrder: number
  forRoles?: string[]
}

interface Category {
  id: string
  name: string
  color: string
}

interface Part {
  id?: string
  tempId?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
  adminNote?: string | null
  image?: string | null
  parentId?: string | null
  isNew?: boolean
  pricingRules?: PricingRule[]
}

interface Props {
  params: Promise<{ id: string }>
}

export default function EditResourcePage({ params }: Props) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"basic" | "booking" | "parts" | "pricing" | "moderators">("basic")

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [color, setColor] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [limitDuration, setLimitDuration] = useState(false)
  const [minBookingMinutes, setMinBookingMinutes] = useState("60")
  const [maxBookingMinutes, setMaxBookingMinutes] = useState("240")
  const [minBookingHours, setMinBookingHours] = useState<string>("")
  const [limitMinBookingHours, setLimitMinBookingHours] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(true)
  const [limitAdvanceBooking, setLimitAdvanceBooking] = useState(true)
  const [advanceBookingDays, setAdvanceBookingDays] = useState("30")
  const [showOnPublicCalendar, setShowOnPublicCalendar] = useState(true)
  const [visDelinfoKort, setVisDelinfoKort] = useState(true)
  const [allowWholeBooking, setAllowWholeBooking] = useState(true)
  const [mapImage, setMapImage] = useState<string | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [prisInfo, setPrisInfo] = useState("")
  const [visPrisInfo, setVisPrisInfo] = useState(false)
  const [visPrislogikk, setVisPrislogikk] = useState(false)
  
  // Pricing state (kun aktiv hvis lisensserver tillater det)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string }>>([])
  
  // Moderators state
  const [moderators, setModerators] = useState<Array<{
    id: string
    user: { id: string; name: string | null; email: string; role: string }
  }>>([])
  const [availableModerators, setAvailableModerators] = useState<Array<{
    id: string
    name: string | null
    email: string
  }>>([])
  const [showAddModerator, setShowAddModerator] = useState(false)
  const [selectedModeratorId, setSelectedModeratorId] = useState("")
  
  // Fixed price packages state
  const [fixedPricePackages, setFixedPricePackages] = useState<FixedPricePackage[]>([])
  const [partFixedPricePackages, setPartFixedPricePackages] = useState<Record<string, FixedPricePackage[]>>({})

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    // Helper to safely fetch arrays - returns empty array on error or non-array response
    const fetchArray = async (url: string) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data) ? data : []
      } catch {
        return []
      }
    }
    
    Promise.all([
      fetch("/api/admin/categories").then(res => res.json()),
      fetch(`/api/admin/resources/${id}`).then(res => res.json()),
      fetchArray(`/api/admin/resources/${id}/moderators`),
      fetchArray("/api/admin/users"),
      fetchArray("/api/admin/roles"),
      fetch("/api/pricing/status").then(res => res.json()).catch(() => ({ enabled: false }))
    ]).then(async ([cats, resource, mods, users, roles, pricingStatus]) => {
      setCategories(Array.isArray(cats) ? cats : [])
      
      setName(resource.name || "")
      setDescription(resource.description || "")
      setLocation(resource.location || "")
      setCategoryId(resource.categoryId || "")
      setColor(resource.color || "")
      setImage(resource.image || null)
      // Check for 0/9999 or null to determine if duration is limited
      const hasLimit = resource.minBookingMinutes !== null && 
                       resource.maxBookingMinutes !== null &&
                       resource.minBookingMinutes !== 0 && 
                       resource.maxBookingMinutes !== 9999
      setLimitDuration(hasLimit)
      setMinBookingMinutes(String(resource.minBookingMinutes || 60))
      setMaxBookingMinutes(String(resource.maxBookingMinutes || 240))
      setMinBookingHours(resource.minBookingHours ? String(resource.minBookingHours) : "")
      setLimitMinBookingHours(!!resource.minBookingHours && Number(resource.minBookingHours) > 0)
      setRequiresApproval(resource.requiresApproval ?? true)
      setLimitAdvanceBooking(resource.advanceBookingDays !== null)
      setAdvanceBookingDays(String(resource.advanceBookingDays || 30))
      setShowOnPublicCalendar(resource.showOnPublicCalendar ?? true)
      setVisDelinfoKort(resource.visDelinfoKort ?? true)
      setAllowWholeBooking(resource.allowWholeBooking ?? true)
      setMapImage(resource.mapImage || null)
      setPrisInfo(resource.prisInfo || "")
      setVisPrisInfo(resource.visPrisInfo ?? false)
      setVisPrislogikk(resource.visPrislogikk ?? false)
      
      // Pricing configuration (kun hvis aktivert)
      setPricingEnabled(pricingStatus.enabled || false)
      if (pricingStatus.enabled) {
        setCustomRoles(roles || [])
        
        // Hent pricingRules hvis satt, ellers konverter legacy format
        if (resource.pricingRules) {
          try {
            const rules = JSON.parse(resource.pricingRules)
            // Konverter gamle member/nonMember regler til separate regler
            const migratedRules: typeof pricingRules = []
            for (const r of rules) {
              const hasMemberPrice = r.memberPricePerHour || r.memberPricePerDay || r.memberFixedPrice
              const hasNonMemberPrice = r.nonMemberPricePerHour || r.nonMemberPricePerDay || r.nonMemberFixedPrice
              const hasNewPrice = r.pricePerHour || r.pricePerDay || r.fixedPrice
              
              if (hasNewPrice || (!hasMemberPrice && !hasNonMemberPrice)) {
                // Allerede nytt format eller ingen priser satt
                migratedRules.push({
                  forRoles: r.forRoles || [],
                  model: r.model || "FREE",
                  pricePerHour: r.pricePerHour ? String(r.pricePerHour) : "",
                  pricePerDay: r.pricePerDay ? String(r.pricePerDay) : "",
                  fixedPrice: r.fixedPrice ? String(r.fixedPrice) : "",
                  fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                })
              } else {
                // Konverter legacy format til separate regler
                if (hasMemberPrice) {
                  migratedRules.push({
                    forRoles: ["member"],
                    model: r.model || "HOURLY",
                    pricePerHour: r.memberPricePerHour ? String(r.memberPricePerHour) : "",
                    pricePerDay: r.memberPricePerDay ? String(r.memberPricePerDay) : "",
                    fixedPrice: r.memberFixedPrice ? String(r.memberFixedPrice) : "",
                    fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                  })
                }
                if (hasNonMemberPrice) {
                  migratedRules.push({
                    forRoles: ["user"],
                    model: r.model || "HOURLY",
                    pricePerHour: r.nonMemberPricePerHour ? String(r.nonMemberPricePerHour) : "",
                    pricePerDay: r.nonMemberPricePerDay ? String(r.nonMemberPricePerDay) : "",
                    fixedPrice: r.nonMemberFixedPrice ? String(r.nonMemberFixedPrice) : "",
                    fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                  })
                }
              }
            }
            setPricingRules(migratedRules)
          } catch (e) {
            // Hvis parsing feiler, start med tom liste
            setPricingRules([])
          }
        } else {
          // Legacy format - konverter til nytt format
          const legacyModel = resource.pricingModel || "FREE"
          const legacyFreeForRoles = resource.freeForRoles ? JSON.parse(resource.freeForRoles) : []
          
          const rules: typeof pricingRules = []
          
          // Hvis det er roller med gratis tilgang, legg til regel for dem
          if (legacyFreeForRoles.length > 0) {
            rules.push({
              forRoles: legacyFreeForRoles,
              model: "FREE"
            })
          }
          
          // Legg til standard regel for alle andre
          rules.push({
            forRoles: [],
            model: legacyModel as any,
            pricePerHour: resource.pricePerHour ? String(resource.pricePerHour) : "",
            pricePerDay: resource.pricePerDay ? String(resource.pricePerDay) : "",
            fixedPrice: resource.fixedPrice ? String(resource.fixedPrice) : "",
            fixedPriceDuration: resource.fixedPriceDuration ? String(resource.fixedPriceDuration) : ""
          })
          
          setPricingRules(rules)
        }
      }
      
      setParts(resource.parts?.map((p: any) => {
        let pricingRules: Part["pricingRules"] = []
        if (p.pricingRules) {
          try {
            const parsed = JSON.parse(p.pricingRules)
            // Konverter gamle member/nonMember regler til separate regler
            for (const r of parsed) {
              const hasMemberPrice = r.memberPricePerHour || r.memberPricePerDay || r.memberFixedPrice
              const hasNonMemberPrice = r.nonMemberPricePerHour || r.nonMemberPricePerDay || r.nonMemberFixedPrice
              const hasNewPrice = r.pricePerHour || r.pricePerDay || r.fixedPrice
              
              if (hasNewPrice || (!hasMemberPrice && !hasNonMemberPrice)) {
                pricingRules.push({
                  forRoles: r.forRoles || [],
                  model: r.model || "FREE",
                  pricePerHour: r.pricePerHour ? String(r.pricePerHour) : "",
                  pricePerDay: r.pricePerDay ? String(r.pricePerDay) : "",
                  fixedPrice: r.fixedPrice ? String(r.fixedPrice) : "",
                  fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                })
              } else {
                if (hasMemberPrice) {
                  pricingRules.push({
                    forRoles: ["member"],
                    model: r.model || "HOURLY",
                    pricePerHour: r.memberPricePerHour ? String(r.memberPricePerHour) : "",
                    pricePerDay: r.memberPricePerDay ? String(r.memberPricePerDay) : "",
                    fixedPrice: r.memberFixedPrice ? String(r.memberFixedPrice) : "",
                    fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                  })
                }
                if (hasNonMemberPrice) {
                  pricingRules.push({
                    forRoles: ["user"],
                    model: r.model || "HOURLY",
                    pricePerHour: r.nonMemberPricePerHour ? String(r.nonMemberPricePerHour) : "",
                    pricePerDay: r.nonMemberPricePerDay ? String(r.nonMemberPricePerDay) : "",
                    fixedPrice: r.nonMemberFixedPrice ? String(r.nonMemberFixedPrice) : "",
                    fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
                  })
                }
              }
            }
          } catch (e) {
            console.error("Error parsing part pricingRules:", e)
          }
        }
        return {
        id: p.id,
        name: p.name,
        description: p.description || "",
        capacity: p.capacity ? String(p.capacity) : "",
        mapCoordinates: p.mapCoordinates || null,
        adminNote: p.adminNote || null,
        image: p.image || null,
          parentId: p.parentId || null,
          pricingRules
        }
      }) || [])
      
      // Set moderators
      setModerators(mods || [])
      
      // Set available moderators (users with moderator role who aren't already moderators)
      const moderatorUserIds = (mods || []).map((m: any) => m.user.id)
      const available = (users || []).filter((u: any) => 
        u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
      )
      setAvailableModerators(available)
      
      // Load fixed price packages for resource (if pricing is enabled)
      if (pricingStatus.enabled) {
        try {
          // Load packages for the resource itself
          const resourcePackages = await fetch(`/api/admin/fixed-price-packages?resourceId=${id}`).then(res => res.json())
          setFixedPricePackages(Array.isArray(resourcePackages) ? resourcePackages.map((p: any) => ({
            ...p,
            price: Number(p.price)
          })) : [])
          
          // Load packages for each part
          const partPackagesMap: Record<string, FixedPricePackage[]> = {}
          for (const part of resource.parts || []) {
            if (part.id) {
              const partPackages = await fetch(`/api/admin/fixed-price-packages?resourcePartId=${part.id}`).then(res => res.json())
              if (Array.isArray(partPackages) && partPackages.length > 0) {
                partPackagesMap[part.id] = partPackages.map((p: any) => ({
                  ...p,
                  price: Number(p.price)
                }))
              }
            }
          }
          setPartFixedPricePackages(partPackagesMap)
        } catch (e) {
          console.error("Error loading fixed price packages:", e)
        }
      }
      
      setIsLoading(false)
    }).catch(() => {
      setError("Kunne ikke laste fasilitet")
      setIsLoading(false)
    })
  }, [id])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      setError("Bildet er for stort. Maks 1MB.")
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("Filen må være et bilde")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImage(reader.result as string)
      setError("")
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          location,
          image,
          mapImage,
          color: color || null,
          categoryId: categoryId || null,
          minBookingMinutes: limitDuration ? parseInt(minBookingMinutes) : null,
          maxBookingMinutes: limitDuration ? parseInt(maxBookingMinutes) : null,
          minBookingHours: minBookingHours && minBookingHours.trim() !== "" ? parseFloat(minBookingHours) : null,
          requiresApproval,
          advanceBookingDays: limitAdvanceBooking ? parseInt(advanceBookingDays) : null,
          showOnPublicCalendar,
          visDelinfoKort,
          allowWholeBooking,
          prisInfo: visPrisInfo ? prisInfo : null,
          visPrisInfo,
          // Pricing fields (kun hvis aktivert)
          ...(pricingEnabled && {
            pricingRules: allowWholeBooking ? JSON.stringify(pricingRules.map(r => ({
              forRoles: r.forRoles,
              model: r.model,
              pricePerHour: r.pricePerHour ? parseFloat(r.pricePerHour) : null,
              pricePerDay: r.pricePerDay ? parseFloat(r.pricePerDay) : null,
              fixedPrice: r.fixedPrice ? parseFloat(r.fixedPrice) : null,
              fixedPriceDuration: r.fixedPriceDuration ? parseInt(r.fixedPriceDuration) : null
            }))) : null,
            visPrislogikk
          }),
          parts: parts.filter(p => p.name.trim()).map(p => ({
            id: p.id,
            tempId: p.tempId,
            name: p.name,
            description: p.description || null,
            capacity: p.capacity ? parseInt(p.capacity) : null,
            mapCoordinates: p.mapCoordinates || null,
            adminNote: p.adminNote || null,
            image: p.image || null,
            parentId: p.parentId || null,
            // Pricing rules for deler (alltid send, selv om pricingEnabled er false, for å bevare eksisterende regler)
            pricingRules: pricingEnabled && p.pricingRules && p.pricingRules.length > 0 
              ? JSON.stringify(p.pricingRules.map(r => ({
                  forRoles: r.forRoles,
                  model: r.model,
                  pricePerHour: r.pricePerHour ? parseFloat(r.pricePerHour) : null,
                  pricePerDay: r.pricePerDay ? parseFloat(r.pricePerDay) : null,
                  fixedPrice: r.fixedPrice ? parseFloat(r.fixedPrice) : null,
                  fixedPriceDuration: r.fixedPriceDuration ? parseInt(r.fixedPriceDuration) : null
                })))
              : null
          }))
        })
      })

      if (!response.ok) {
        throw new Error("Kunne ikke oppdatere fasilitet")
      }

      // Reload data to reflect saved state
      const updatedResource = await fetch(`/api/admin/resources/${id}`).then(res => res.json())
      // Check for 0/9999 or null to determine if duration is limited
      const hasLimit = updatedResource.minBookingMinutes !== null && 
                       updatedResource.maxBookingMinutes !== null &&
                       updatedResource.minBookingMinutes !== 0 && 
                       updatedResource.maxBookingMinutes !== 9999
      setLimitDuration(hasLimit)
      setMinBookingMinutes(String(updatedResource.minBookingMinutes || 60))
      setMaxBookingMinutes(String(updatedResource.maxBookingMinutes || 240))
      setMinBookingHours(updatedResource.minBookingHours ? String(updatedResource.minBookingHours) : "")
      setPrisInfo(updatedResource.prisInfo || "")
      setVisPrisInfo(updatedResource.visPrisInfo ?? false)
      setParts(updatedResource.parts?.map((p: any) => {
        let pricingRules: Part["pricingRules"] = []
        if (p.pricingRules) {
          try {
            const rules = JSON.parse(p.pricingRules)
            pricingRules = rules.map((r: any) => ({
              forRoles: r.forRoles || [],
              model: r.model || "FREE",
              pricePerHour: r.pricePerHour ? String(r.pricePerHour) : "",
              pricePerDay: r.pricePerDay ? String(r.pricePerDay) : "",
              fixedPrice: r.fixedPrice ? String(r.fixedPrice) : "",
              fixedPriceDuration: r.fixedPriceDuration ? String(r.fixedPriceDuration) : ""
            }))
          } catch (e) {
            // Hvis parsing feiler, start med tom liste
            pricingRules = []
          }
        }
        
        return {
        id: p.id,
        name: p.name,
        description: p.description || "",
        capacity: p.capacity ? String(p.capacity) : "",
        mapCoordinates: p.mapCoordinates || null,
        adminNote: p.adminNote || null,
        image: p.image || null,
          parentId: p.parentId || null,
          pricingRules
        }
      }) || [])

      // Save fixed price packages (if pricing is enabled)
      if (pricingEnabled) {
        try {
          // Save resource-level packages
          await fetch("/api/admin/fixed-price-packages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resourceId: id,
              packages: fixedPricePackages
            })
          })
          
          // Save part-level packages
          for (const partId of Object.keys(partFixedPricePackages)) {
            await fetch("/api/admin/fixed-price-packages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                resourcePartId: partId,
                packages: partFixedPricePackages[partId]
              })
            })
          }
        } catch (e) {
          console.error("Error saving fixed price packages:", e)
        }
      }

      // Show success message
      setSuccessMessage("Endringene ble lagret!")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Link href="/admin/resources" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til fasiliteter
        </Link>

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rediger fasilitet</h1>
            <p className="text-gray-500 text-sm">{name || "Oppdater informasjon om fasiliteten"}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "basic"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Info className="w-4 h-4 inline mr-1.5" />
            Grunnleggende
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("booking")}
            className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "booking"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1.5" />
            Booking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("parts")}
            className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "parts"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Layers className="w-4 h-4 inline mr-1.5" />
            Deler & Kart
          </button>
          {pricingEnabled && (
            <button
              type="button"
              onClick={() => setActiveTab("pricing")}
              className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "pricing"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-1.5" />
              Prising
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("moderators")}
            className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "moderators"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Moderatorer
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </div>
        )}

        {/* Tab Content */}
        <form id="resource-form" onSubmit={handleSubmit}>

          {/* BASIC TAB */}
          {activeTab === "basic" && (
          <div className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMessage}
              </div>
            )}

            {/* Basic info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Grunnleggende informasjon</h2>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Navn *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="F.eks. Hovedstadion"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="Beskriv fasiliteten..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lokasjon
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input"
                    placeholder="F.eks. Idrettsveien 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input"
                  >
                    <option value="">Velg kategori...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Egen farge for kalender (valgfritt)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color || "#3b82f6"}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="input max-w-[150px]"
                    placeholder="#3b82f6"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor("")}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Bruk kategorifarge
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Brukes for å skille fasiliteter i hovedkalenderen. Uten egen farge brukes kategorifargen.
                </p>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Bilde av fasilitet
                </label>
                
                {image ? (
                  <div className="flex items-start gap-4">
                    <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-gray-100">
                      <Image
                        src={image}
                        alt="Fasilitetsbilde"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary text-sm py-2"
                      >
                        <Upload className="w-4 h-4" />
                        Bytt bilde
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Fjern bilde
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Klikk for å laste opp bilde</p>
                    <p className="text-xs text-gray-400 mt-1">PNG eller JPG (maks 1MB)</p>
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
            </div>

            {/* Save button for Basic tab */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
                  </>
                )}
              </button>
            </div>
          </div>
          )}

          {/* BOOKING TAB */}
          {activeTab === "booking" && (
          <div className="space-y-6">
            {/* Booking settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Booking-innstillinger</h2>
              </div>
              
              {/* Minimum antall timer (uavhengig av lisens) */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limitMinBookingHours"
                    checked={limitMinBookingHours}
                    onChange={(e) => {
                      setLimitMinBookingHours(e.target.checked)
                      if (!e.target.checked) setMinBookingHours("")
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="limitMinBookingHours" className="text-sm font-medium text-gray-700">
                    Minimum antall timer en fasilitet kan bookes
                  </label>
                </div>
                
                {limitMinBookingHours && (
                  <div className="ml-8 mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Antall timer
                    </label>
                    <input
                      type="number"
                      value={minBookingHours}
                      onChange={(e) => setMinBookingHours(e.target.value)}
                      className="input max-w-[200px]"
                      min="0.5"
                      step="0.5"
                      placeholder="F.eks. 2"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limitDuration"
                    checked={limitDuration}
                    onChange={(e) => setLimitDuration(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="limitDuration" className="text-sm font-medium text-gray-700">
                    Begrens varighet på bookinger
                  </label>
                </div>
                
                {limitDuration && (
                  <div className="ml-8 grid md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min. varighet (minutter)
                      </label>
                      <input
                        type="number"
                        value={minBookingMinutes}
                        onChange={(e) => setMinBookingMinutes(e.target.value)}
                        className="input"
                        min="15"
                        step="15"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maks. varighet (minutter)
                      </label>
                      <input
                        type="number"
                        value={maxBookingMinutes}
                        onChange={(e) => setMaxBookingMinutes(e.target.value)}
                        className="input"
                        min="15"
                        step="15"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Forhåndsbestilling */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limitAdvanceBooking"
                    checked={limitAdvanceBooking}
                    onChange={(e) => setLimitAdvanceBooking(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="limitAdvanceBooking" className="text-sm font-medium text-gray-700">
                    Begrens hvor langt frem i tid man kan booke
                  </label>
                </div>
                
                {limitAdvanceBooking && (
                  <div className="ml-8 mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maks antall dager frem
                    </label>
                    <input
                      type="number"
                      value={advanceBookingDays}
                      onChange={(e) => setAdvanceBookingDays(e.target.value)}
                      className="input max-w-[200px]"
                      min="1"
                    />
                  </div>
                )}
              </div>

              {/* Godkjenning og synlighet */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                  <label htmlFor="requiresApproval" className="text-sm font-medium text-gray-700">
                  Krever godkjenning fra admin før booking er bekreftet
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showOnPublicCalendar"
                  checked={showOnPublicCalendar}
                  onChange={(e) => setShowOnPublicCalendar(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="showOnPublicCalendar" className="text-sm font-medium text-gray-700">
                  Vis fasiliteten på offentlig kalender (forsiden)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="visDelinfoKort"
                  checked={visDelinfoKort}
                  onChange={(e) => setVisDelinfoKort(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="visDelinfoKort" className="text-sm font-medium text-gray-700">
                  Vis &quot;Mer informasjon&quot;-kort på fasilitetssiden
                </label>
              </div>
              </div>
            </div>

            {/* Price info - Kun for standardlisens (ikke betalingsmodul) */}
            {!pricingEnabled && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Prisinfo</h2>
                </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="visPrisInfo"
                  checked={visPrisInfo}
                  onChange={(e) => setVisPrisInfo(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="visPrisInfo" className="text-sm font-medium text-gray-700">
                  Vis prisinfo på fasilitetssiden
                </label>
              </div>

              {visPrisInfo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prisinformasjon
                  </label>
                  <textarea
                    value={prisInfo}
                    onChange={(e) => setPrisInfo(e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="F.eks. 500 kr/time, 300 kr/time for medlemmer..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Denne informasjonen vises under "Booking-info" på fasilitetssiden
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Save button for Booking tab */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
                  </>
                )}
              </button>
            </div>
          </div>
          )}

          {/* PARTS & MAP TAB */}
          {activeTab === "parts" && (
          <div className="space-y-6">
            {/* Parts - Hierarchical */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Deler som kan bookes</h2>
              </div>
              
              <PartsHierarchyEditor
                parts={parts}
                onPartsChange={setParts}
              />

              {parts.length > 0 && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="allowWholeBookingParts"
                    checked={allowWholeBooking}
                    onChange={(e) => setAllowWholeBooking(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allowWholeBookingParts" className="text-sm text-gray-700">
                    Tillat booking av hele fasiliteten (i tillegg til deler)
                  </label>
                </div>
              )}
            </div>

            {/* Map Editor */}
            {parts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                  <Map className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Oversiktskart</h2>
                </div>
                
                {parts.some(p => !p.id) ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800">
                      <strong>Tips:</strong> Lagre endringene først for å kunne markere delene på et oversiktskart.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      Last opp et bilde av fasiliteten og marker hvor de ulike delene befinner seg.
                    </p>
                    <MapEditor
                      mapImage={mapImage}
                      parts={parts}
                      onMapImageChange={setMapImage}
                      onPartsUpdate={setParts}
                    />
                  </>
                )}
              </div>
            )}

            {/* Save button for Parts tab */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
                  </>
                )}
              </button>
            </div>
          </div>
          )}

          {/* PRICING TAB */}
          {activeTab === "pricing" && pricingEnabled && (
          <div className="space-y-6">
            {/* Pricing Configuration - Samlet for fasilitet og deler */}
            <div className="bg-white rounded-xl border-2 border-blue-200 bg-blue-50/30 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-blue-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Prislogikk</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Konfigurer prising for hele fasiliteten og hver del. Deler uten egen prislogikk bruker fasilitetens prislogikk.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Vis prisinfo checkbox */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="visPrislogikkTab"
                  checked={visPrislogikk}
                  onChange={(e) => setVisPrislogikk(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="visPrislogikkTab" className="text-sm font-medium text-gray-700">
                  Vis prisinfo på fasilitetssiden
                </label>
              </div>

              {/* Hele fasiliteten - Prising */}
              {allowWholeBooking && (
                <div className="space-y-6">
                  <div className="border-b border-gray-200 pb-2">
                    <h3 className="font-semibold text-gray-900">Hele fasiliteten</h3>
                  </div>
                  
                  <DurationPricingEditor
                    rules={pricingRules}
                    onChange={setPricingRules}
                    customRoles={customRoles}
                  />

                  <FixedPricePackagesEditor
                    resourceId={id}
                    packages={fixedPricePackages}
                    onChange={setFixedPricePackages}
                    customRoles={customRoles}
                  />
                </div>
              )}

              {/* Deler prislogikk */}
              {parts.length > 0 && (
                <div className="space-y-4 pt-6 border-t-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Deler</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Konfigurer prising for hver del. Hvis ingen prislogikk er satt for en del, brukes fasilitetens prislogikk.
                    <span className="text-xs text-gray-400 ml-2">({parts.length} deler totalt)</span>
                  </p>
                  
                  {(() => {
                    const buildHierarchy = (parentId: string | null, level: number): Array<{ part: Part; partIndex: number; level: number }> => {
                      const children = parts.filter(p => {
                        const pParentId = p.parentId || null
                        if (parentId === null) return pParentId === null
                        return pParentId === parentId
                      })
                      const sortedChildren = [...children].sort((a, b) => a.name.localeCompare(b.name, 'no'))
                      
                      const result: Array<{ part: Part; partIndex: number; level: number }> = []
                      for (const child of sortedChildren) {
                        const childIndex = parts.findIndex(p => (p.id && p.id === child.id) || (p.tempId && p.tempId === child.tempId))
                        result.push({ part: child, partIndex: childIndex, level })
                        const childId = child.id || child.tempId || null
                        if (childId) {
                          result.push(...buildHierarchy(childId, level + 1))
                        }
                      }
                      return result
                    }
                    
                    const sortedParts = buildHierarchy(null, 0)
                    
                    return sortedParts.map(({ part, partIndex, level }) => (
                      <div 
                        key={part.id || part.tempId || partIndex} 
                        className={`p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 ${level > 0 ? 'border-l-4' : ''} ${level === 1 ? 'ml-6 border-l-blue-300' : ''} ${level === 2 ? 'ml-12 border-l-green-300' : ''} ${level >= 3 ? 'ml-16 border-l-purple-300' : ''}`}
                      >
                        <div className="border-b border-gray-200 pb-2">
                          <h4 className="font-medium text-gray-900">{part.name}</h4>
                          <p className="text-xs text-gray-500">{level === 0 ? "Hoveddel" : level === 1 ? "Underdel" : `Nivå ${level + 1}`}</p>
                        </div>
                      
                        <DurationPricingEditor
                          rules={part.pricingRules || []}
                          onChange={(newRules) => {
                            const newParts = [...parts]
                            newParts[partIndex].pricingRules = newRules
                            setParts(newParts)
                          }}
                          customRoles={customRoles}
                        />
                      
                        {part.id ? (
                          <FixedPricePackagesEditor
                            resourcePartId={part.id}
                            packages={partFixedPricePackages[part.id] || []}
                            onChange={(newPackages) => {
                              setPartFixedPricePackages(prev => ({
                                ...prev,
                                [part.id!]: newPackages
                              }))
                            }}
                            customRoles={customRoles}
                          />
                        ) : (
                          <p className="text-xs text-gray-500 italic">
                            Lagre fasiliteten først for å kunne legge til fastprispakker på denne delen.
                          </p>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>

            {/* Save button for Pricing tab */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
                  </>
                )}
              </button>
            </div>
          </div>
          )}

          {/* MODERATORS TAB */}
          {activeTab === "moderators" && (
          <div className="space-y-6">
            {/* Moderators */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Moderatorer</h2>
              </div>
              
              <p className="text-sm text-gray-500">
                Moderatorer kan godkjenne og avslå bookinger for denne fasiliteten. De kan også opprette bookinger selv.
              </p>

              <div className="space-y-2">
                {moderators.map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{mod.user.name || "Uten navn"}</p>
                        <p className="text-xs text-gray-500">{mod.user.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/resources/${id}/moderators?userId=${mod.user.id}`, {
                          method: "DELETE"
                        })
                        const modsRes = await fetch(`/api/admin/resources/${id}/moderators`)
                        const updated = modsRes.ok ? await modsRes.json() : []
                        setModerators(Array.isArray(updated) ? updated : [])
                        const usersRes = await fetch("/api/admin/users")
                        const users = usersRes.ok ? await usersRes.json() : []
                        const usersArray = Array.isArray(users) ? users : []
                        const moderatorUserIds = (Array.isArray(updated) ? updated : []).map((m: any) => m.user.id)
                        const available = usersArray.filter((u: any) => 
                          u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
                        )
                        setAvailableModerators(available)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {moderators.length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
                    Ingen moderatorer tildelt denne fasiliteten
                  </div>
                )}
              </div>

              {availableModerators.length > 0 && (
                <div>
                  {!showAddModerator ? (
                    <button
                      type="button"
                      onClick={() => setShowAddModerator(true)}
                      className="btn btn-secondary text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Legg til moderator
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={selectedModeratorId}
                        onChange={(e) => setSelectedModeratorId(e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">Velg moderator...</option>
                        {availableModerators.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || "Uten navn"} ({user.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedModeratorId) return
                          
                          await fetch(`/api/admin/resources/${id}/moderators`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: selectedModeratorId })
                          })
                          
                          const modsRes = await fetch(`/api/admin/resources/${id}/moderators`)
                          const updated = modsRes.ok ? await modsRes.json() : []
                          setModerators(Array.isArray(updated) ? updated : [])
                          
                          const usersRes = await fetch("/api/admin/users")
                          const users = usersRes.ok ? await usersRes.json() : []
                          const usersArray = Array.isArray(users) ? users : []
                          const moderatorUserIds = (Array.isArray(updated) ? updated : []).map((m: any) => m.user.id)
                          const available = usersArray.filter((u: any) => 
                            u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
                          )
                          setAvailableModerators(available)
                          
                          setShowAddModerator(false)
                          setSelectedModeratorId("")
                        }}
                        disabled={!selectedModeratorId}
                        className="btn btn-primary text-sm disabled:opacity-50"
                      >
                        Legg til
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModerator(false)
                          setSelectedModeratorId("")
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Avbryt
                      </button>
                    </div>
                  )}
                </div>
              )}

              {availableModerators.length === 0 && moderators.length > 0 && (
                <p className="text-xs text-gray-500">
                  Alle tilgjengelige moderatorer er allerede tildelt denne fasiliteten.
                </p>
              )}

              {availableModerators.length === 0 && moderators.length === 0 && (
                <p className="text-xs text-gray-500">
                  Det finnes ingen brukere med moderator-rolle. Gå til <Link href="/admin/users" className="text-blue-600 hover:underline">Brukere</Link> for å opprette en moderator.
                </p>
              )}
            </div>

            {/* Save button for Moderators tab */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
                  </>
                )}
              </button>
            </div>
          </div>
          )}

        </form>
      </div>
      <Footer />
    </div>
  )
}

