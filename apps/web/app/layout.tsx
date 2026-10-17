import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: {
    default: "CyberPizza",
    template: "%s · CyberPizza",
  },
  description:
    "Night-shift pizza kitchen on the Avalanche Fuji testnet. Collect nine toppings, bake a recipe for pending CPT, and claim it as testnet CPT.",
  openGraph: {
    title: "CyberPizza",
    description:
      "Night-shift pizza kitchen on the Avalanche Fuji testnet. Collect nine toppings, bake from the menu, and claim testnet CPT.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b1422",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${display.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
