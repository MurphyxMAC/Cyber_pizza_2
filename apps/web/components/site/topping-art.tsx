import { PixelImage } from "@/components/site/pixel-image";
import { TOPPING_ART } from "@/lib/pixel-art";
import type { IngredientId } from "@cyberpizza/shared";

export function ToppingArt({
  id,
  accent,
  scale = 1,
}: {
  id: string;
  accent: string;
  scale?: 1 | 2;
}) {
  const art = TOPPING_ART[id as IngredientId];
  const size = 64 * scale;

  if (!art) {
    return (
      <div
        className="grid place-items-center border-2 border-dashed border-border bg-black/30"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span className="size-4" style={{ background: accent, boxShadow: `0 0 0 2px ${accent}` }} />
      </div>
    );
  }

  return <PixelImage src={art.src} alt={art.tile} native={64} scale={scale} />;
}
