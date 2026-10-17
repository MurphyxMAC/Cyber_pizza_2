import { MobileNav } from "@/components/site/mobile-nav";
import { NAV_LINKS } from "@/lib/site";
import Link from "next/link";

const kitchenCta =
  "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <a href="#content" className="skip-link rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="font-pixel inline-flex items-center gap-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-base"
        >
          <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
          CyberPizza
        </Link>
        <nav aria-label="Primary" className="ml-6 hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/play" className={kitchenCta}>
            <span className="sm:hidden">Kitchen</span>
            <span className="hidden sm:inline">Enter the kitchen</span>
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
