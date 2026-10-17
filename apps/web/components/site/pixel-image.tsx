import Image from "next/image";

type NativeSize = 64 | 256 | 512;
type Scale = 1 | 2 | 3;

export function PixelImage({
  src,
  alt,
  native,
  scale = 1,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  native: NativeSize;
  scale?: Scale;
  priority?: boolean;
  className?: string;
}) {
  const size = native * scale;
  return (
    <Image
      src={src}
      alt={alt}
      width={native}
      height={native}
      unoptimized
      priority={priority}
      draggable={false}
      className={`pixel-art ${className}`}
      style={{
        imageRendering: "pixelated",
        width: size,
        height: size,
        maxWidth: "none",
      }}
    />
  );
}
