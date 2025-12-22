import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Globe, FileText } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#1C1C1C] text-[#EDEDED]">

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            VibeDigest v3.0
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            Turn Videos into <span className="text-primary">Insights</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Stop watching 2-hour videos. Get instant transcripts, AI summaries, and multi-language translations in seconds.
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-lg gap-2 bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(62,207,142,0.3)]">
              Get Started <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="https://github.com/your-repo">
            <Button variant="outline" size="lg" className="h-12 px-8 text-lg border-white/10 hover:bg-white/5">
              GitHub
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl w-full">
          <FeatureCard
            icon={Zap}
            title="Instant Transcription"
            desc="Powered by faster-whisper. High accuracy, lightning speed."
          />
          <FeatureCard
            icon={FileText}
            title="AI Summaries"
            desc="Get the key takeaways without watching the whole video."
          />
          <FeatureCard
            icon={Globe}
            title="Multi-Language"
            desc="Translate content into Chinese, Japanese, and English automatically."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2024 AI Video Transcriber. Built with Next.js & Supabase.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors text-left space-y-3">
      <div className="h-10 w-10 rounded-lg bg-black/40 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  )
}
