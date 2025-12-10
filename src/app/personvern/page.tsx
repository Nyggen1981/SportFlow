import { PageLayout } from "@/components/PageLayout"
import { Shield, FileText, Database, Mail, Lock, Trash2, Download } from "lucide-react"
import Link from "next/link"

export default function PersonvernPage() {
  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 md:p-12">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Personvernpolicy</h1>
              <p className="text-gray-600 mt-1">Sist oppdatert: {new Date().toLocaleDateString("nb-NO", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            {/* Introduksjon */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduksjon</h2>
              <p className="text-gray-700 leading-relaxed">
                Arena Booking respekterer ditt personvern og er forpliktet til å beskytte dine personopplysninger. 
                Denne personvernpolicyn forklarer hvordan vi samler inn, bruker, lagrer og beskytter dine personopplysninger 
                i henhold til GDPR (General Data Protection Regulation).
              </p>
            </section>

            {/* Dataansvarlig */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database className="w-6 h-6" />
                2. Dataansvarlig
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dataansvarlig for behandlingen av personopplysninger er din organisasjon/klubb som bruker Arena Booking-systemet.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Hvis du har spørsmål om personvern eller ønsker å utøve dine rettigheter, kan du kontakte din organisasjons administrator.
              </p>
            </section>

            {/* Hvilke data samler vi inn */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                3. Hvilke personopplysninger samler vi inn?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi samler inn og behandler følgende personopplysninger:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Kontaktinformasjon:</strong> Navn, e-postadresse og telefonnummer</li>
                <li><strong>Brukerdata:</strong> Passord (kryptert), rolle (admin/bruker) og godkjenningsstatus</li>
                <li><strong>Bookingdata:</strong> Informasjon om bookinger du har opprettet, inkludert tid, sted og beskrivelse</li>
                <li><strong>Teknisk data:</strong> IP-adresse, nettlesertype og tidspunkt for innlogging (for sikkerhet)</li>
                <li><strong>Preferanser:</strong> Kalendervisning og andre brukerpreferanser</li>
              </ul>
            </section>

            {/* Formål med behandlingen */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Formål med behandlingen</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi behandler personopplysningene dine for følgende formål:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Å tilby og administrere bookingsystemet</li>
                <li>Å behandle og administrere bookinger</li>
                <li>Å sende e-postvarsler om bookinger (godkjenning, avslag, kansellering)</li>
                <li>Å sikre systemets sikkerhet og forhindre misbruk</li>
                <li>Å oppfylle juridiske forpliktelser</li>
              </ul>
            </section>

            {/* Rettighetsgrunnlag */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Rettighetsgrunnlag</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Behandlingen av dine personopplysninger er basert på:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Samtykke:</strong> Du samtykker til behandlingen ved å registrere deg og bruke systemet</li>
                <li><strong>Avtale:</strong> Behandlingen er nødvendig for å oppfylle avtalen om å tilby bookingsystemet</li>
                <li><strong>Legitim interesse:</strong> For å sikre systemets funksjonalitet og sikkerhet</li>
              </ul>
            </section>

            {/* Dine rettigheter */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="w-6 h-6" />
                6. Dine rettigheter
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                I henhold til GDPR har du følgende rettigheter:
              </p>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Download className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">Rett til innsyn</h3>
                      <p className="text-sm text-blue-800">
                        Du har rett til å få innsyn i hvilke personopplysninger vi behandler om deg. 
                        Du kan eksportere alle dine data via innstillinger-siden.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900 mb-1">Rett til retting</h3>
                      <p className="text-sm text-green-800">
                        Du har rett til å få rettet feilaktige eller ufullstendige personopplysninger.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-1">Rett til sletting</h3>
                      <p className="text-sm text-red-800">
                        Du har rett til å få slettet dine personopplysninger ("right to be forgotten"). 
                        Du kan slette din konto via innstillinger-siden.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-purple-900 mb-1">Rett til dataportabilitet</h3>
                      <p className="text-sm text-purple-800">
                        Du har rett til å få utlevert dine personopplysninger i et strukturt, vanlig og maskinlesbart format.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Rett til å klage</h3>
                      <p className="text-sm text-amber-800">
                        Du har rett til å klage til Datatilsynet hvis du mener behandlingen av dine personopplysninger 
                        strider mot personvernregelverket.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Databehandlere */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Databehandlere</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi bruker følgende tjenester som databehandlere:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Vercel:</strong> Hosting av nettsiden (personopplysninger kan lagres i serverless-funksjoner)</li>
                <li><strong>Supabase/PostgreSQL:</strong> Database for lagring av alle data</li>
                <li><strong>E-posttjeneste (SMTP):</strong> For sending av e-postvarsler</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Alle databehandlere er forpliktet til å overholde GDPR og har databehandleravtaler på plass.
              </p>
            </section>

            {/* Lagringstid */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Lagringstid</h2>
              <p className="text-gray-700 leading-relaxed">
                Vi lagrer dine personopplysninger så lenge det er nødvendig for å oppfylle formålet med behandlingen, 
                eller så lenge vi har en juridisk forpliktelse til å lagre dem. Når du sletter din konto, 
                vil alle dine personopplysninger bli slettet, med unntak av data vi er juridisk forpliktet til å beholde.
              </p>
            </section>

            {/* Sikkerhet */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Sikkerhet</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi har implementert passende tekniske og organisatoriske tiltak for å beskytte dine personopplysninger:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Kryptering av passord (bcrypt)</li>
                <li>Sikker autentisering (NextAuth.js)</li>
                <li>HTTPS-kryptering for all datatrafikk</li>
                <li>Begrenset tilgang til personopplysninger (kun autoriserte brukere)</li>
                <li>Regelmessige sikkerhetsoppdateringer</li>
              </ul>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Cookies</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi bruker cookies for å:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Autentisering:</strong> For å holde deg innlogget (nødvendig cookie)</li>
                <li><strong>Sikkerhet:</strong> For å beskytte mot uautorisert tilgang</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Disse cookies er nødvendige for at systemet skal fungere og kan ikke deaktiveres.
              </p>
            </section>

            {/* Kontakt */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-6 h-6" />
                11. Kontakt oss
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Hvis du har spørsmål om denne personvernpolicyn eller ønsker å utøve dine rettigheter, 
                kan du kontakte din organisasjons administrator eller bruke funksjonene i innstillinger-siden 
                for å eksportere eller slette dine data.
              </p>
            </section>

            {/* Endringer */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Endringer i personvernpolicyn</h2>
              <p className="text-gray-700 leading-relaxed">
                Vi kan oppdatere denne personvernpolicyn fra tid til annen. Vi vil varsle deg om vesentlige endringer 
                via e-post eller gjennom systemet. Den oppdaterte versjonen vil alltid være tilgjengelig på denne siden.
              </p>
            </section>
          </div>

          {/* Call to action */}
          <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Utøv dine rettigheter</h3>
            <p className="text-sm text-gray-600 mb-4">
              Du kan eksportere eller slette dine data via innstillinger-siden hvis du er innlogget.
            </p>
            <Link 
              href="/innstillinger" 
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Gå til innstillinger →
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

