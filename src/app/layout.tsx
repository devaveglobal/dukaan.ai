import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ColorThemeProvider } from "@/components/color-theme-provider";

const plusJakartaSans = Plus_Jakarta_Sans({ 
  variable: "--font-plus-jakarta", 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AI Sales",
  description: "AI-powered sales management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ColorThemeProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
