import { PixelImage } from "@/components/site/pixel-image";
import { TOPPING_ART } from "@/lib/pixel-art";
import type { IngredientId } from "@cyberpizza/shared";

export function ToppingArt({
  id,
  name,
  accent,
  scale = 1,
}: {
  id: string;
  name: string;
  accent: string;
  scale?: 1 | 2;
}) {
  const art = TOPPING_ART[id as IngredientId];
  const size = 64 * scale;

  if (!art) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div
          className="grid place-items-center border-2 border-dashed border-border bg-black/30"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span
            className="size-4"
            style={{ background: accent, boxShadow: `0 0 0 2px ${accent}` }}
          />
        </div>
        <p className="font-mono text-[10px] tracking-wide text-muted-foreground">No tile</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <PixelImage src={art.src} alt="" native={64} scale={scale} />
      {art.standIn ? (
        <p className="max-w-32 font-mono text-[10px] leading-snug tracking-wide text-muted-foreground">
          Sheet tile: {art.tile}
        </p>
      ) : (
        <p className="sr-only">{name}</p>
      )}
    </div>
  );
}
