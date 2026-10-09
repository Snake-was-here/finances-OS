import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finansų OS",
  description: "Tavo darbo ir tikslų progresas"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lt"><body>{children}</body></html>;
}
