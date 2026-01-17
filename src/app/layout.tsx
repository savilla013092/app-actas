import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Sistema de Actas - SERVICIUDAD ESP",
    description: "Automatización de actas de revisión de activos fijos",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={inter.className}>
                {children}
                <Toaster />
            </body>
        </html>
    );
}
