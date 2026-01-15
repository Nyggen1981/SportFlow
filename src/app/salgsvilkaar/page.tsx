import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { isPricingEnabled } from "@/lib/pricing"
import { FileText, Building2, Phone, Mail, MapPin, AlertCircle } from "lucide-react"
import Link from "next/link"

export default async function SalgsvilkårPage() {
  const session = await getServerSession(authOptions)
  
  // Sjekk om betalingsmodulen er aktivert
  const pricingEnabled = await isPricingEnabled()
  
  // Hvis modulen ikke er aktivert, vis melding
  if (!pricingEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        
        <main className="flex-grow">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="card p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Siden ikke tilgjengelig</h1>
                  <p className="text-gray-500 text-sm">Salgsvilkår-siden er kun tilgjengelig når betalingsmodulen er aktivert</p>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  Denne siden er kun synlig når betalingsmodulen er aktivert i systemet.
                </p>
              </div>
              
              <Link 
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tilbake til forsiden
              </Link>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    )
  }
  
  // Hent organisasjonsinformasjon (viktig for Vipps-krav - må være synlig for alle)
  let organization = null
  
  // Hvis bruker er logget inn, bruk deres organisasjon
  if (session?.user?.organizationId) {
    organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        name: true,
        invoiceOrgNumber: true,
        invoiceAddress: true,
        invoicePhone: true,
        invoiceEmail: true,
      }
    })
  }
  
  // Hvis ikke logget inn eller organisasjon ikke funnet, bruk standard organisasjon
  if (!organization) {
    const preferredSlug = process.env.PREFERRED_ORG_SLUG
    if (preferredSlug) {
      organization = await prisma.organization.findUnique({
        where: { slug: preferredSlug },
        select: {
          name: true,
          invoiceOrgNumber: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
        }
      })
    }
    
    // Fallback til første organisasjon
    if (!organization) {
      organization = await prisma.organization.findFirst({
        select: {
          name: true,
          invoiceOrgNumber: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Salgsvilkår</h1>
                <p className="text-gray-500 text-sm">Vilkår for booking og utleie av fasiliteter</p>
              </div>
            </div>

            <div className="prose prose-sm max-w-none">
              {/* Firma- og kontaktinformasjon - Viktig for Vipps-krav */}
              {organization && (
                <section className="mb-8 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Firma- og kontaktinformasjon
                  </h2>
                  {(!organization.invoiceOrgNumber && !organization.invoiceAddress) ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Viktig for Vipps:</strong> Organisasjonsnummer og adresse må være satt i Admin → Innstillinger → Fakturainformasjon for at informasjonen skal vises her.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                      {organization.name && (
                        <div>
                          <p className="font-medium text-gray-900">Organisasjon</p>
                          <p className="text-gray-600">{organization.name}</p>
                        </div>
                      )}
                      {organization.invoiceOrgNumber && (
                        <div>
                          <p className="font-medium text-gray-900">Organisasjonsnummer</p>
                          <p className="text-gray-600">{organization.invoiceOrgNumber}</p>
                        </div>
                      )}
                      {organization.invoiceAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">Adresse</p>
                            <p className="text-gray-600">{organization.invoiceAddress}</p>
                          </div>
                        </div>
                      )}
                      {organization.invoicePhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 flex-shrink-0 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">Telefon</p>
                            <p className="text-gray-600">{organization.invoicePhone}</p>
                          </div>
                        </div>
                      )}
                      {organization.invoiceEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 flex-shrink-0 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">E-post</p>
                            <p className="text-gray-600">{organization.invoiceEmail}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Parter */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Parter</h2>
                <p className="text-gray-700 mb-2">
                  Disse salgsvilkårene gjelder mellom:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li><strong>Utleier:</strong> {organization?.name || "Organisasjonen"}</li>
                  <li><strong>Leietaker:</strong> Den person eller organisasjon som bestiller og betaler for utleie av fasiliteter</li>
                </ul>
              </section>

              {/* Betaling */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Betaling</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    Betaling for booking av fasiliteter kan skje gjennom:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Vipps:</strong> Betaling via Vipps MobilePay</li>
                    <li><strong>Faktura:</strong> Faktura sendes per e-post etter godkjenning av booking</li>
                    <li><strong>Kortbetaling:</strong> Betaling med kredittkort eller debetkort</li>
                  </ul>
                  <p className="mt-4">
                    <strong>Betalingsfrist:</strong> Betaling skal skje i henhold til den valgte betalingsmetoden. 
                    For faktura gjelder betalingsfristen som angitt på fakturaen.
                  </p>
                  <p>
                    Ved manglende betaling kan booking bli kansellert, og organisasjonen forbeholder seg rett til å kreve erstatning for tapte inntekter.
                  </p>
                </div>
              </section>

              {/* Levering */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Levering</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    <strong>Utleie av fasiliteter:</strong> Booking av fasiliteter gir leietaker rett til å bruke den bookede fasiliteten 
                    i den angitte tidsperioden. Leietaker får tilgang til fasiliteten ved ankomst til det bookede tidspunktet.
                  </p>
                  <p>
                    <strong>Bekreftelse:</strong> Booking blir bekreftet via e-post når den er godkjent av organisasjonen. 
                    Leietaker mottar informasjon om bookingdetaljer, inkludert tidspunkt, lokasjon og eventuelle spesielle instruksjoner.
                  </p>
                </div>
              </section>

              {/* Angrerett */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">4. Angrerett</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    I henhold til forbrukerkjøpsloven har du som forbruker angrerett ved kjøp på nett. 
                    Angreretten gjelder i 14 dager fra bookingdato.
                  </p>
                  <p>
                    <strong>Angrerett gjelder ikke for:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Bookinger som skal utføres innen 14 dager fra bookingdato</li>
                    <li>Bookinger som allerede er gjennomført</li>
                    <li>Bookinger som er spesielt tilpasset dine behov</li>
                  </ul>
                  <p className="mt-4">
                    For å benytte deg av angreretten, må du gi tydelig beskjed om dette til organisasjonen. 
                    Du kan bruke angrerettskjemaet nedenfor eller sende en klar melding til oss.
                  </p>
                </div>
              </section>

              {/* Retur */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">5. Retur og avbestilling</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    <strong>Avbestilling av booking:</strong> Du kan avbestille booking i henhold til følgende regler:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Mer enn 48 timer før:</strong> Full refusjon</li>
                    <li><strong>24-48 timer før:</strong> 50% refusjon</li>
                    <li><strong>Mindre enn 24 timer før:</strong> Ingen refusjon</li>
                  </ul>
                  <p className="mt-4">
                    <strong>Ombooking:</strong> Ombooking kan gjøres inntil 24 timer før booket tidspunkt, 
                    avhengig av tilgjengelighet. Kontakt organisasjonen for å avtale ombooking.
                  </p>
                  <p>
                    <strong>Endring av booking:</strong> Endringer av booking må gjøres minst 24 timer før booket tidspunkt. 
                    Kontakt organisasjonen for å avtale endringer.
                  </p>
                </div>
              </section>

              {/* Reklamasjonshåndtering */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">6. Reklamasjonshåndtering</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    Hvis du opplever problemer med den bookede fasiliteten, må du kontakte organisasjonen umiddelbart. 
                    Vi vil søke å løse problemet raskt og til din tilfredshet.
                  </p>
                  <p>
                    <strong>Reklamasjon må sendes:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Innen rimelig tid etter at problemet oppstod</li>
                    <li>Til organisasjonens kontaktinformasjon (se over)</li>
                    <li>Med beskrivelse av problemet og ønsket løsning</li>
                  </ul>
                  <p className="mt-4">
                    Organisasjonen vil behandle reklamasjonen i henhold til gjeldende forbrukerrettigheter.
                  </p>
                </div>
              </section>

              {/* Konfliktløsning */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">7. Konfliktløsning</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    Eventuelle tvister skal løses gjennom forhandlinger mellom partene. 
                    Hvis enighet ikke kan oppnås, kan tvisten klages til Forbrukertilsynet.
                  </p>
                  <p>
                    <strong>Klageadgang:</strong> Du har rett til å klage til Forbrukertilsynet hvis du mener 
                    organisasjonen ikke har overholdt forbrukerrettighetene.
                  </p>
                  <p>
                    <strong>Forbrukertilsynet:</strong><br />
                    Postboks 4594 Nydalen<br />
                    0404 Oslo<br />
                    Telefon: 23 400 600<br />
                    E-post: post@forbrukertilsynet.no<br />
                    Web: www.forbrukertilsynet.no
                  </p>
                </div>
              </section>

              {/* Leieforhold - spesielt for utleie */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">8. Leieforhold</h2>
                <div className="text-gray-700 space-y-2">
                  <p>
                    <strong>Leieperiode:</strong> Leieforholdet starter ved booket tidspunkt og varer til utløp av booket periode.
                  </p>
                  <p>
                    <strong>Oppsigelse:</strong> Booking kan avbestilles i henhold til retningslinjene i punkt 5 (Retur og avbestilling).
                  </p>
                  <p>
                    <strong>Leietakers plikter:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Bruke fasiliteten i henhold til formålet</li>
                    <li>Behandle fasiliteten med forsiktighet</li>
                    <li>Rydde opp etter bruk</li>
                    <li>Betale leie i henhold til avtale</li>
                    <li>Følge organisasjonens regler og retningslinjer</li>
                  </ul>
                  <p className="mt-4">
                    <strong>Utleiers plikter:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Stille fasiliteten til disposisjon ved booket tidspunkt</li>
                    <li>Sikre at fasiliteten er i god stand</li>
                    <li>Gi nødvendig informasjon om bruk av fasiliteten</li>
                  </ul>
                </div>
              </section>

              {/* Endringer i vilkår */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">9. Endringer i vilkår</h2>
                <p className="text-gray-700">
                  Organisasjonen forbeholder seg rett til å endre disse salgsvilkårene. 
                  Endringer vil bli publisert på denne siden. Vedvarende bruk av tjenesten etter endringer 
                  anses som aksept av de nye vilkårene.
                </p>
              </section>

              {/* Gjeldende lovverk */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">10. Gjeldende lovverk</h2>
                <p className="text-gray-700">
                  Disse salgsvilkårene er utarbeidet i henhold til norsk forbrukerkjøpslov og 
                  forbrukerkjøpsloven. Forbrukerrettighetene kan ikke begrenses gjennom disse vilkårene.
                </p>
              </section>

              {/* Sist oppdatert */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

