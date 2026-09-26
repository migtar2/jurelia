import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import HelpDrawer from "@/components/HelpDrawer";
import HelpButton from "@/components/HelpButton";
import Onboarding from "@/components/Onboarding";
import Footer from "@/components/Footer";
import LiaAssistant from "@/components/LiaAssistant";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JURELIA — Observatorio de Jurisprudencia",
  description: "Observatorio y monitorización de jurisprudencia del Centro de Documentación Judicial (CENDOJ) de España",
  icons: {
    icon: "/jurelia-logo.png",
    shortcut: "/jurelia-logo.png",
    apple: "/jurelia-logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        {children}
        <Footer />
        <HelpDrawer />
        <HelpButton />
        <Onboarding />
        <LiaAssistant />
      </body>
    </html>
  );
}