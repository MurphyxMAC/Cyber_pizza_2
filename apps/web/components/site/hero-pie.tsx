import { PizzaMark } from "@/components/pizza-mark";
import { INGREDIENTS } from "@cyberpizza/shared";

const chips = [
  { id: "neontomatoes", className: "top-[6%] left-[8%]" },
  { id: "holobasil", className: "top-[18%] right-[0%]" },
  { id: "cyberbacon", className: "bottom-[16%] left-[0%]" },
  { id: "quantumcheese", className: "right-[6%] bottom-[8%]" },
] as const;

export function HeroPie() {
  return (
    <figure className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute inset-[12%] rounded-full bg-primary/25 blur-3xl" aria-hidden />
      <div className="absolute inset-[8%] rounded-full bg-accent/10 blur-2xl" aria-hidden />
      <div
        className="site-spin absolute inset-2 rounded-full border border-dashed border-primary/60"
        aria-hidden
      />
      <div className="site-spin-reverse absolute inset-0 rounded-full border border-accent/40" aria-hidden />
      <div className="site-float relative px-10 py-12">
        <PizzaMark idPrefix="hero" className="mx-auto size-full max-h-[340px]" />
      </div>
      <ul className="pointer-events-none absolute inset-0" aria-hidden>
        {chips.map((chip, index) => {
          const ingredient = INGREDIENTS.find((item) => item.id === chip.id);
          if (!ingredient) return null;
          return (
            <li
              key={chip.id}
              className={`site-float absolute ${chip.className}`}
              style={{ animationDelay: `${index * 0.6}s` }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/80 px-3 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur-sm">
                <span
                  className="size-2 rounded-full"
                  style={{ background: ingredient.accent, boxShadow: `0 0 10px ${ingredient.accent}` }}
                />
                {ingredient.name}
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-2 text-center font-mono text-xs tracking-wide text-muted-foreground">
        Neon Supreme mark from the kitchen
      </figcaption>
    </figure>
  );
}
