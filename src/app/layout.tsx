import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Frazier VC CRM",
  description: "Venture capital relationship management for Frazier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
