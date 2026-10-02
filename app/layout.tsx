import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { APP_NAME } from "@/components/brand/logo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — GST Billing & Accounting`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "GST invoicing, inventory, parties and accounting for Indian small businesses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131b1c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{ style: { fontSize: "13px" } }}
        />
      </body>
    </html>
  );
}
