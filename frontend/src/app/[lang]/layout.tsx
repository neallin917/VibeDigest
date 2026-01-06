import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from '@next/third-parties/google';
import "../globals.css";

import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vibedigest.neallin.xyz";

  // Simple mapping for common locales, default to en_US
  const localeMap: Record<string, string> = {
    en: "en_US",
    zh: "zh_CN",
    es: "es_ES",
    fr: "fr_FR",
    de: "de_DE",
    it: "it_IT",
    pt: "pt_BR",
    ja: "ja_JP",
    ko: "ko_KR",
    ru: "ru_RU",
  };

  const locale = localeMap[lang] || "en_US";

  return {
    applicationName: "VibeDigest",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: "./",
      languages: {
        'en': '/en',
        'zh': '/zh',
        'es': '/es',
        'fr': '/fr',
        'de': '/de',
        'ja': '/ja',
        'x-default': '/en',
      },
    },
    title: {
      default: "VibeDigest - AI Video Summarizer & Transcriber for YouTube",
      template: "%s | VibeDigest",
    },
    description: "Free AI Video Summarizer & YouTube to Text Converter. Get instant summaries, transcripts, and structured notes from YouTube videos.",
    keywords: [
      "AI video summarizer",
      "YouTube video to text",
      "video summarizer AI",
      "YouTube transcript generator",
      "summarize YouTube video",
      "video to notes",
      "study assistant",
      "content repurposing",
    ],
    authors: [{ name: "VibeDigest Team" }],
    creator: "VibeDigest",
    openGraph: {
      type: "website",
      locale: locale,
      url: baseUrl,
      title: "VibeDigest - Transform Video & Audio into Structured Knowledge",
      description: "Efficiently absorb long content. Get AI-powered structured summaries, interactive transcripts, and translations for efficient learning.",
      siteName: "VibeDigest",
      images: [{
        url: "/ai-video-summarizer-transcriber-og.png",
        width: 1200,
        height: 630,
        alt: "VibeDigest Default Cover",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "VibeDigest - AI Video Summarizer & Transcriber",
      description: "Free AI Video Summarizer & YouTube to Text Converter. Get instant summaries and transcripts from YouTube videos.",
      creator: "@vibedigest",
      images: ["/ai-video-summarizer-transcriber-og.png"],
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: {
        "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "",
      }
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
}

export default async function RootLayout({
  children,
  auth,
  params
}: Readonly<{
  children: React.ReactNode;
  auth: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  return (
    <html lang={lang} className="dark" suppressHydrationWarning>
      <body className={cn(inter.className, "bg-background text-foreground antialiased")} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
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
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "VibeDigest",
                "alternateName": ["Vibe Digest", "AI Video Summarizer"],
                "url": "https://vibedigest.neallin.xyz"
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "VibeDigest",
                "url": "https://vibedigest.neallin.xyz",
                "logo": "https://vibedigest.neallin.xyz/icon.png",
                "sameAs": [
                  "https://twitter.com/vibedigest"
                ]
              }
            ])
          }}
        />
        <Providers locale={lang}>
          {auth}
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
