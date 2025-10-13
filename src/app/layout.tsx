import type { Metadata } from "next";
import "./globals.css";
import RootProviders from "@/components/RootProviders";

export const metadata: Metadata = {
  title: "FieldNote",
  description: "Bemanningsliste og Befaring - Planlegging og timeføring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
