import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"
import { createInvoiceForRegistration, sendRegistrationInvoiceEmail } from "@/lib/invoice"
import { sendEmail } from "@/lib/email"
import { formatInTimeZone } from "date-fns-tz"
import { nb } from "date-fns/locale"

const TIMEZONE = "Europe/Oslo"

// PATCH - Godkjenn eller avslå påmelding
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Sjekk om brukeren har tilgang til kampoppsett
    const hasAccess = await canAccessMatchSetup(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 })
    }
    
    // Sjekk om modulen er aktivert
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const { id: competitionId, registrationId } = await params
    const body = await request.json()
    const { action } = body
    
    if (!["confirm", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Ugyldig handling. Må være 'confirm' eller 'cancel'" },
        { status: 400 }
      )
    }
    
    // Hent påmeldingen og verifiser at den tilhører riktig konkurranse
    const registration = await prisma.competitionRegistration.findFirst({
      where: {
        id: registrationId,
        competitionId,
        organizationId: session.user.organizationId
      },
      include: {
        competition: true
      }
    })
    
    if (!registration) {
      return NextResponse.json(
        { error: "Påmelding ikke funnet" },
        { status: 404 }
      )
    }
    
    if (registration.status !== "PENDING") {
      return NextResponse.json(
        { error: "Påmeldingen er allerede behandlet" },
        { status: 400 }
      )
    }
    
    if (action === "confirm") {
      // Opprett lag fra påmeldingen
      const teamName = registration.teamName || registration.contactName
      
      // Sjekk om laget allerede finnes
      const existingTeam = await prisma.team.findFirst({
        where: {
          competitionId,
          name: teamName
        }
      })
      
      if (existingTeam) {
        return NextResponse.json(
          { error: `Et lag med navnet "${teamName}" finnes allerede` },
          { status: 400 }
        )
      }
      
      // Opprett lag og oppdater påmelding i en transaksjon
      await prisma.$transaction(async (tx) => {
        // Opprett laget
        await tx.team.create({
          data: {
            name: teamName,
            competitionId,
            contactName: registration.contactName,
            contactEmail: registration.contactEmail,
            contactPhone: registration.contactPhone,
            players: registration.participants as string[] || [],
            organizationId: session.user.organizationId
          }
        })
        
        // Oppdater påmeldingsstatus
        await tx.competitionRegistration.update({
          where: { id: registrationId },
          data: { 
            status: "CONFIRMED",
            confirmedAt: new Date()
          }
        })
      })
      
      // Send bekreftelsesmail og faktura (async, ikke blokker respons)
      const sendEmailsAsync = async () => {
        try {
          const org = await prisma.organization.findUnique({
            where: { id: session.user.organizationId },
            select: { name: true }
          })
          
          const startDate = formatInTimeZone(
            new Date(registration.competition.startDate), 
            TIMEZONE, 
            "d. MMMM yyyy", 
            { locale: nb }
          )
          
          // Sjekk om det er avgift som skal faktureres
          if (registration.paymentAmount && Number(registration.paymentAmount) > 0) {
            // Opprett og send faktura
            const { invoiceId } = await createInvoiceForRegistration(
              registrationId, 
              session.user.organizationId
            )
            await sendRegistrationInvoiceEmail(invoiceId, registrationId, session.user.organizationId)
          } else {
            // Ingen avgift - send bare bekreftelsesmail
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
                  .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
                  .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
                  .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">✅ Påmelding godkjent!</h1>
                  </div>
                  <div class="content">
                    <p>Hei ${registration.contactName},</p>
                    
                    <p>Vi er glade for å bekrefte at din påmelding til <strong>${registration.competition.name}</strong> er godkjent!</p>
                    
                    <div class="info-box">
                      <p><strong>Konkurranse:</strong> ${registration.competition.name}</p>
                      ${registration.teamName ? `<p><strong>Lag:</strong> ${registration.teamName}</p>` : ''}
                      <p><strong>Startdato:</strong> ${startDate}</p>
                      ${registration.competition.venue ? `<p><strong>Sted:</strong> ${registration.competition.venue}</p>` : ''}
                    </div>

                    <p>Vi gleder oss til å se deg på konkurransen! Mer informasjon vil bli sendt ut før start.</p>
                  </div>
                  <div class="footer">
                    <p>Med vennlig hilsen,<br/>${org?.name || 'Arrangøren'}</p>
                  </div>
                </div>
              </body>
              </html>
            `
            
            await sendEmail(session.user.organizationId, {
              to: registration.contactEmail,
              subject: `✅ Påmelding godkjent - ${registration.competition.name}`,
              html
            })
          }
        } catch (error) {
          console.error("[Registration] Failed to send confirmation email:", error)
        }
      }
      
      void sendEmailsAsync()
      
      return NextResponse.json({ 
        success: true, 
        message: "Påmelding godkjent og lag opprettet" 
      })
    } else {
      // Avslå påmelding
      await prisma.competitionRegistration.update({
        where: { id: registrationId },
        data: { 
          status: "REJECTED"
        }
      })
      
      // Send avslag-mail (async, ikke blokker respons)
      const sendRejectionEmail = async () => {
        try {
          const org = await prisma.organization.findUnique({
            where: { id: session.user.organizationId },
            select: { name: true }
          })
          
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
                .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #64748b; }
                .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">Påmelding ikke godkjent</h1>
                </div>
                <div class="content">
                  <p>Hei ${registration.contactName},</p>
                  
                  <p>Vi beklager å måtte meddele at din påmelding til <strong>${registration.competition.name}</strong> dessverre ikke ble godkjent.</p>
                  
                  <div class="info-box">
                    <p><strong>Konkurranse:</strong> ${registration.competition.name}</p>
                    ${registration.teamName ? `<p><strong>Lag:</strong> ${registration.teamName}</p>` : ''}
                  </div>

                  <p>Ta gjerne kontakt med arrangøren hvis du har spørsmål.</p>
                </div>
                <div class="footer">
                  <p>Med vennlig hilsen,<br/>${org?.name || 'Arrangøren'}</p>
                </div>
              </div>
            </body>
            </html>
          `
          
          await sendEmail(session.user.organizationId, {
            to: registration.contactEmail,
            subject: `Påmelding ikke godkjent - ${registration.competition.name}`,
            html
          })
        } catch (error) {
          console.error("[Registration] Failed to send rejection email:", error)
        }
      }
      
      void sendRejectionEmail()
      
      return NextResponse.json({ 
        success: true, 
        message: "Påmelding avslått" 
      })
    }
  } catch (error) {
    console.error("[Competition Registration PATCH] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke behandle påmelding" },
      { status: 500 }
    )
  }
}
