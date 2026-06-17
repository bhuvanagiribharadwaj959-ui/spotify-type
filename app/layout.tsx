import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SONIC",
  description: "Your music. Your world. Unfiltered.",
  icons: {
    icon: "https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
