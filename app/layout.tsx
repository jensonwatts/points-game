import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Points Game",
  description: "Shared office points tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
