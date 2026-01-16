import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ReportBugButton } from "@/components/ReportBugButton";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "SportFlow - Smartere Klubbdrift",
  description: "Book haller, rom og fasiliteter enkelt og oversiktlig",
  formatDetection: {
    telephone: false,
  },
  themeColor: "#0d9488",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
          <ReportBugButton />
        </Providers>
      </body>
    </html>
  );
}
