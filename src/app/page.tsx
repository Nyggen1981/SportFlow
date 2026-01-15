import { redirect } from "next/navigation"

export default async function PublicHomePage() {
  // Redirect to kalender which now serves as both public and authenticated calendar
  redirect("/kalender")
}
