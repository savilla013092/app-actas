import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Sistema de Actas - SERVICIUDAD ESP",
    template: "%s | SERVICIUDAD ESP"
  },
  description: "Sistema de automatización de actas de revisión de activos fijos con evidencia fotográfica y firma digital dual para SERVICIUDAD ESP",
  keywords: ["activos fijos", "revision", "actas", "SERVICIUDAD", "firma digital"],
  authors: [{ name: "SERVICIUDAD ESP" }],
  creator: "SERVICIUDAD ESP",
  publisher: "SERVICIUDAD ESP",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Sistema de Actas - SERVICIUDAD ESP",
    title: "Sistema de Actas de Revisión de Activos Fijos",
    description: "Automatización de actas de revisión de activos fijos con evidencia fotográfica y firma digital",
  },
  icons: {
    icon: "/logo-serviciudad.png",
    apple: "/logo-serviciudad.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
