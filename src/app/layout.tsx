import type { Metadata } from "next";
import "./globals.css";
import RootProviders from "@/components/RootProviders";

export const metadata: Metadata = {
  title: "Bemanningsliste",
  description: "Planlegging og timeføring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
