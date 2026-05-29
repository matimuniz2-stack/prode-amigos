import type { Metadata, Viewport } from "next";
import { Geist, Anton } from "next/font/google";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "PRODE DE LOS PIBES · Mundial 2026",
  description:
    "Predicciones, cargadas y gloria eterna. Prode del Mundial 2026 entre amigos: picks por partido, ranking en vivo y pozo.",
};

export const viewport: Viewport = {
  themeColor: "#0B3D2E",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

// Display condensada tipo póster deportivo para los títulos.
const anton = Anton({
  weight: "400",
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.className} ${geistSans.variable} ${anton.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
