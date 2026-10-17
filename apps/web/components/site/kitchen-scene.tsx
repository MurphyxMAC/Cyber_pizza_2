import { ChefIdle } from "@/components/site/chef-idle";
import { PixelImage } from "@/components/site/pixel-image";

export function KitchenScene() {
  return (
    <figure className="pixel-stage mx-auto w-full max-w-[512px]">
      <div className="pixel-frame">
        <div className="scene-frame">
          <div className="scene-stage">
            <PixelImage
              src="/pixel/kitchen-bg.png"
              alt="Night kitchen with a brick oven, a rainy window, and a neon pizza sign."
              native={256}
              scale={2}
              priority
              className="absolute top-0 left-0"
            />
            <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2">
              <ChefIdle />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center font-mono text-xs text-muted-foreground">
        Kitchen scene at 2×. The apron reads Neon Slice.
      </figcaption>
    </figure>
  );
}
