import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";

// These are now handled via system fonts in globals.css to fix build errors
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };


export const metadata: Metadata = {
  title: "Eurus Lifestyle ERP",
  description: "Eurus Lifestyle — Login to your account",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

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
            {children}
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
