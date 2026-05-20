import type { Metadata } from "next";
import "./globals.css";
import { FlashToast } from "@/components/ui/FlashToast";
import { readFlashMessage } from "@/lib/flash";

export const metadata: Metadata = {
  title: "Church Ride Link",
  description: "Coordinate Sunday church rides from North Campus and South Campus.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const flash = await readFlashMessage();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <FlashToast flash={flash} />
        {children}
      </body>
    </html>
  );
}
