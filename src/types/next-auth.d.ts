import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      organizationId: string
      organizationName: string
      organizationSlug: string
      organizationLogo: string | null
      organizationColor: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: string
    organizationId: string
    organizationName: string
    organizationSlug: string
    organizationLogo: string | null
    organizationColor: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    organizationId: string
    organizationName: string
    organizationSlug: string
    organizationLogo: string | null
    organizationColor: string
  }
}

