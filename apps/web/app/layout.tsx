import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lmk",
  description: "Developer intelligence & action system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full bg-neutral-950 text-neutral-100 font-mono antialiased">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <header className="mb-8">
            <a href="/plans" className="text-neutral-400 hover:text-white text-sm tracking-widest uppercase">
              lmk
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
