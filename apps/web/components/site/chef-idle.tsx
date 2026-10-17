import { PixelImage } from "@/components/site/pixel-image";
import { CHEF_FRAMES } from "@/lib/pixel-art";

export function ChefIdle() {
  return (
    <div
      className="chef-idle relative h-[256px] w-[256px]"
      role="img"
      aria-label="Cyberpunk pizza chef holding a peel. The apron reads Neon Slice."
    >
      {CHEF_FRAMES.map((src, index) => (
        <PixelImage
          key={src}
          src={src}
          alt=""
          native={256}
          priority
          className={`chef-frame chef-frame-${index} absolute top-0 left-0`}
        />
      ))}
    </div>
  );
}
