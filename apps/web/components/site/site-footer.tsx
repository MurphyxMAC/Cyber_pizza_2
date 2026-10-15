import { DISCORD_URL, GITHUB_URL } from "@/lib/site";
import { FUJI_CHAIN_ID, RECIPE_ID } from "@cyberpizza/shared";
import Link from "next/link";

const footerLink =
  "inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="text-lg font-semibold tracking-tight">CyberPizza</p>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Night-shift kitchen on the Avalanche Fuji testnet. CPT from this booth is not a mainnet asset.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-col sm:flex-row sm:gap-6">
            <li>
              <Link href="/play" className={footerLink}>
                Kitchen
              </Link>
            </li>
            <li>
              <a href={DISCORD_URL} className={footerLink} target="_blank" rel="noopener noreferrer">
                Discord
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={GITHUB_URL} className={footerLink} target="_blank" rel="noopener noreferrer">
                GitHub
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <p className="font-mono text-xs tracking-wide text-muted-foreground">
          Chain {FUJI_CHAIN_ID} · recipe {RECIPE_ID}
        </p>
      </div>
    </footer>
  );
}
