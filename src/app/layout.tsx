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
  description: "Book treningsøkter, haller og fasiliteter for ditt idrettslag",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
          <ReportBugButton />
        </Providers>
      </body>
    </html>
  );
}
