import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { InstallAppProvider } from "@/components/install-app";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL?.trim() || "http://localhost:3000"),
  title: {
    default: "StudyStation — Turn lectures into learning",
    template: "%s · StudyStation",
  },
  description:
    "Record or upload lectures, create structured AI notes, flashcards and quizzes, and plan your best study week.",
  applicationName: "StudyStation",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudyStation",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "StudyStation — Your lectures, made learnable",
    description: "AI-powered lecture capture and personalized study tools.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sansFont.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <InstallAppProvider>
            <PwaRegister />
            {children}
          </InstallAppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
