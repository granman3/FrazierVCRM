import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-semibold text-xl">Chief of Staff</div>
          <div className="flex items-center gap-4">
            <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground">
              Security
            </Link>
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16 text-center max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
            Your AI Chief of Staff
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Never miss a chance to reach out. We monitor your VIP contacts for job changes
            and company news, then draft personalized messages you can send with one click.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth/signin">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/security">
              <Button variant="outline" size="lg">How It Works</Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl mb-4">📇</div>
              <h3 className="font-semibold mb-2">Sync Your Contacts</h3>
              <p className="text-sm text-muted-foreground">
                Connect iCloud, Google Contacts, or upload a CSV. We identify your VIPs automatically.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-4">📰</div>
              <h3 className="font-semibold mb-2">Track News & Changes</h3>
              <p className="text-sm text-muted-foreground">
                Daily monitoring for funding rounds, job changes, and company milestones.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-4">✉️</div>
              <h3 className="font-semibold mb-2">Ready-to-Send Drafts</h3>
              <p className="text-sm text-muted-foreground">
                Get a daily digest with personalized messages. Copy, paste, send.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <div>&copy; {new Date().getFullYear()} Chief of Staff</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/security" className="hover:text-foreground">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
