import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "VibeDigest - AI Video Summarizer & Transcriber",
    template: "%s | VibeDigest",
  },
  description: "Transform videos and podcasts into structured insights. VibeDigest uses AI to generate interactive transcripts, keypoint summaries, and translations for efficient learning.",
  keywords: [
    "AI video summarizer",
    "structured video notes",
    "podcast knowledge extractor",
    "video to text",
    "study assistant",
    "content repurposing",
    "audio transcription",
  ],
  authors: [{ name: "VibeDigest Team" }],
  creator: "VibeDigest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vibedigest.neallin.xyz",
    title: "VibeDigest - Transform Video & Audio into Structured Knowledge",
    description: "Efficiently absorb long content. Get AI-powered structured summaries, interactive transcripts, and translations for YouTube, Bilibili, and podcasts.",
    siteName: "VibeDigest",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeDigest - AI Video Summarizer",
    description: "Turn long videos into quick insights with AI. Support for YouTube, Bilibili, podcasts, and more.",
    creator: "@vibedigest", // Placeholder handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
  auth
}: Readonly<{
  children: React.ReactNode;
  auth: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "VibeDigest",
    "applicationCategory": "ProductivityApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
    },
    "description": "AI-powered tool to transform videos and podcasts into structured insights.",
  };

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={cn(inter.className, "bg-background text-foreground antialiased")} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          {auth}
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
