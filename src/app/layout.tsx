import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mis Finanzas | Tus cuentas claras",
  description: "Tus finanzas personales y compartidas, claras y bajo control.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
