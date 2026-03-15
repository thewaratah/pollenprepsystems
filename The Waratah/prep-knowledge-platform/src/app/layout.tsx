import type { Metadata } from "next";
import "./globals.css";
import { PrepAgentChat } from "@/components/PrepAgentChat";

export const metadata: Metadata = {
  title: "The Waratah Prep System",
  description: "Kitchen prep management system for The Waratah",
  icons: {
    icon: "/images/waratah-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <PrepAgentChat />
      </body>
    </html>
  );
}
