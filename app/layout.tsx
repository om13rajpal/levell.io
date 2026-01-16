import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "levvl.io | AI-Powered Sales Call Coaching",
  description: "Turn every sales call into a coaching opportunity. AI-powered call analysis that surfaces insights, identifies risks, and syncs to HubSpot.",
  keywords: ["sales coaching", "call analysis", "AI", "HubSpot", "Fireflies", "sales intelligence"],
  openGraph: {
    title: "levvl.io | AI-Powered Sales Call Coaching",
    description: "Turn every sales call into a coaching opportunity with AI-powered analysis.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
