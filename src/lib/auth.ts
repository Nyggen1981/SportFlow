import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { validateLicense } from "./license"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing credentials")
          return null
        }

        console.log("[Auth] Attempting login for:", credentials.email)

          // Use select instead of include to avoid relation validation issues
        // Normalize email to lowercase for case-insensitive lookup
        const normalizedEmail = credentials.email.toLowerCase().trim()
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              password: true,
              systemRole: true,
              customRoleId: true,
              customRole: {
                select: {
                  id: true,
                  name: true,
                  hasModeratorAccess: true
                }
              },
              role: true, // Legacy field
              isApproved: true,
              emailVerified: true,
              isMember: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  tagline: true,
                  primaryColor: true
                }
              }
            }
        })

        if (!user) {
          console.log("[Auth] User not found:", credentials.email)
          return null
        }

        console.log("[Auth] User found, checking password...")
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          console.log("[Auth] Invalid password for:", credentials.email)
          return null
        }

        console.log("[Auth] Password valid, checking permissions...")

        // Check if user is approved (admins and organization creators are always approved)
        // Sjekk både systemRole og role (legacy) for bakoverkompatibilitet
        const isAdmin = user.systemRole === "admin" || user.role === "admin"
        if (!user.isApproved && !isAdmin) {
          throw new Error("Din konto venter på godkjenning fra administrator")
        }

        // Check if email is verified (admins skip this check)
        if (!user.emailVerified && !isAdmin) {
          throw new Error("Du må verifisere e-postadressen din før du kan logge inn. Sjekk e-posten din for verifiseringslenken.")
        }

          if (!user.organization) {
            console.error("User has no organization:", user.id)
            return null
          }

        // Sjekk lisens ved hver innlogging (testfase)
        // Admin får alltid logge inn for å kunne konfigurere lisens
        if (!isAdmin) {
          try {
            const license = await validateLicense(true) // Force refresh
            if (!license.valid) {
              const errorMsg = license.status === "expired" 
                ? "Abonnementet har utløpt. Kontakt din klubb for mer informasjon."
                : license.status === "suspended"
                  ? "Lisensen er suspendert. Kontakt din klubb."
                  : "Tjenesten er midlertidig utilgjengelig. Kontakt din klubb."
              throw new Error(errorMsg)
            }
          } catch (licenseError) {
            // Hvis lisenssjekk feiler, kast feilen videre
            if (licenseError instanceof Error) {
              throw licenseError
            }
            throw new Error("Kunne ikke verifisere lisens. Kontakt din klubb.")
          }
        }

        // Bestem rolle for session (bruk custom role navn hvis tilgjengelig, ellers systemRole)
        // Fallback til user.role hvis systemRole ikke er satt (for bakoverkompatibilitet)
        const systemRole = user.systemRole || (user.role === "admin" ? "admin" : "user")
        const roleName = user.customRole?.name || systemRole
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          systemRole: systemRole as "admin" | "user",
          customRoleId: user.customRoleId,
          customRoleName: user.customRole?.name || null,
          hasModeratorAccess: systemRole === "admin" || (user.customRole?.hasModeratorAccess ?? false),
          role: roleName, // Legacy: beholder for bakoverkompatibilitet
          emailVerified: Boolean(user.emailVerified),
          isMember: Boolean(user.isMember),
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          organizationSlug: user.organization.slug,
          organizationTagline: user.organization.tagline || "Kalender",
          organizationColor: user.organization.primaryColor,
          }
        } catch (error) {
          // Re-throw specific error messages so they show to the user
          if (error instanceof Error) {
            // Lisensfeil, godkjenningsfeil og e-postverifiseringsfeil skal vises direkte
            if (
              error.message.includes("godkjenning") || 
              error.message.includes("utilgjengelig") ||
              error.message.includes("utløpt") ||
              error.message.includes("suspendert") ||
              error.message.includes("lisens") ||
              error.message.includes("verifisere") ||
              error.message.includes("verifisert")
            ) {
              throw error
            }
            // For lokal utvikling, log alle feil detaljert
            if (process.env.NODE_ENV === "development") {
              console.error("[Auth] Detailed error:", {
                message: error.message,
                stack: error.stack,
                name: error.name
              })
            }
          }
          // Log other errors but show generic message
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = (user as any).phone
        token.systemRole = (user as any).systemRole
        token.customRoleId = (user as any).customRoleId
        token.customRoleName = (user as any).customRoleName
        token.hasModeratorAccess = (user as any).hasModeratorAccess
        token.role = user.role // Legacy
        token.emailVerified = Boolean(user.emailVerified)
        token.isMember = Boolean(user.isMember)
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.organizationSlug = user.organizationSlug
        token.organizationTagline = user.organizationTagline
        token.organizationColor = user.organizationColor
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.phone = token.phone as string | null
        session.user.systemRole = token.systemRole as "admin" | "user"
        session.user.customRoleId = token.customRoleId as string | null
        session.user.customRoleName = token.customRoleName as string | null
        session.user.hasModeratorAccess = token.hasModeratorAccess as boolean
        session.user.role = token.role as string // Legacy
        session.user.emailVerified = token.emailVerified as boolean
        session.user.isMember = token.isMember as boolean
        session.user.organizationId = token.organizationId as string
        session.user.organizationName = token.organizationName as string
        session.user.organizationSlug = token.organizationSlug as string
        session.user.organizationTagline = token.organizationTagline as string
        session.user.organizationColor = token.organizationColor as string
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}

/**
 * Hjelpefunksjoner for rolle-sjekk (brukes i API-ruter)
 */
export function isAdminUser(session: any): boolean {
  return session?.user?.systemRole === "admin"
}

export function canModerateUser(session: any): boolean {
  return session?.user?.systemRole === "admin" || session?.user?.hasModeratorAccess === true
}

