import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROYECTO_FINANZAS_TT",
  description: "Sistema interno de ingresos y control financiero"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
