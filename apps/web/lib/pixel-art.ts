import type { IngredientId } from "@cyberpizza/shared";

/**
 * Tiles cropped from the 256px ingredient sheet.
 * Each icon is 64×64. The sheet is a 3×3 of those tiles with 16px gutters:
 * (16,16), (96,16), (176,16), then the same x positions at y=96 and y=176.
 */
export type ToppingArt = {
  src: string;
  /** What the tile depicts, used as alt text. */
  tile: string;
};

export const TOPPING_ART: Partial<Record<IngredientId, ToppingArt>> = {
  cheese: { src: "/pixel/mozzarella.png", tile: "Mozzarella" },
  pepperoni: { src: "/pixel/pepperoni.png", tile: "Pepperoni" },
  mushrooms: { src: "/pixel/mushrooms.png", tile: "Mushrooms" },
  neontomatoes: { src: "/pixel/tomato-sauce.png", tile: "Tomato sauce" },
  holobasil: { src: "/pixel/basil.png", tile: "Basil" },
  nanopeppers: { src: "/pixel/green-peppers.png", tile: "Green peppers" },
};

export const OVEN_TIERS = [
  { name: "Stone hearth", blurb: "A brick deck." },
  { name: "Neon chrome", blurb: "A cyan-trimmed deck." },
  { name: "Plasma core", blurb: "A magenta core." },
] as const;

export const CHEF_FRAMES = [
  "/pixel/chef-idle-1.png",
  "/pixel/chef-idle-2.png",
  "/pixel/chef-idle-3.png",
  "/pixel/chef-idle-4.png",
] as const;
