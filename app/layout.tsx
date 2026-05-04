import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import PresenceHandler from "./components/PresenceHandler";

// These are now handled via system fonts in globals.css to fix build errors
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };


import { LightboxProvider } from "./context/LightboxContext";
import ImageLightbox from "./components/ImageLightbox";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <DataProvider>
            <LightboxProvider>
              <PresenceHandler />
              {children}
              <ImageLightbox />
            </LightboxProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

