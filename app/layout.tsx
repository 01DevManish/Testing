import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import FirebaseMessagingHandler from "./components/FirebaseMessagingHandler";
import NotificationToastContainer from "./components/NotificationToastContainer";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <DataProvider>
            <LightboxProvider>
              <FirebaseMessagingHandler />
              <NotificationToastContainer />
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

