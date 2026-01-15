import Link from "next/link"
import Image from "next/image"
import { Calendar } from "lucide-react"
import { prisma } from "@/lib/prisma"

async function getOrganization() {
  try {
    return await prisma.organization.findFirst()
  } catch {
    return null
  }
}

interface HeaderProps {
  children?: React.ReactNode
}

export async function Header({ children }: HeaderProps) {
  const organization = await getOrganization()
  const primaryColor = organization?.primaryColor || "#2563eb"

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Organization branding */}
          <Link href="/" className="flex items-center gap-3">
            {organization?.logo ? (
              <Image
                src={organization.logo}
                alt={organization.name || "Logo"}
                width={40}
                height={40}
                className="rounded-lg"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Calendar className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-gray-900">
                {organization?.name || "Sportflow Booking"}
              </h1>
              <p className="text-xs text-gray-500">
                {(organization as { tagline?: string })?.tagline || "Kalender"}
              </p>
            </div>
          </Link>

          {/* Navigation passed as children */}
          {children}
        </div>
      </div>
    </header>
  )
}





