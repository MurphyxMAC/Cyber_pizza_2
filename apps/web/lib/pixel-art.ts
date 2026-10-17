import type { IngredientId } from "@cyberpizza/shared";

/**
 * Tiles cropped from the 256px ingredient sheet.
 * Each icon is 64×64. The sheet is a 3×3 of those tiles with 16px gutters:
 * (16,16), (96,16), (176,16), then the same x positions at y=96 and y=176.
 */
export type ToppingArt = {
  src: string;
  /** What the tile actually depicts. */
  tile: string;
  /** True when the tile is the closest sheet drawing, not a literal topping. */
  standIn: boolean;
};

export const TOPPING_ART: Partial<Record<IngredientId, ToppingArt>> = {
  cheese: { src: "/pixel/mozzarella.png", tile: "Mozzarella", standIn: false },
  pepperoni: { src: "/pixel/pepperoni.png", tile: "Pepperoni", standIn: false },
  mushrooms: { src: "/pixel/mushrooms.png", tile: "Mushrooms", standIn: false },
  neontomatoes: { src: "/pixel/tomato-sauce.png", tile: "Tomato sauce", standIn: true },
  holobasil: { src: "/pixel/basil.png", tile: "Basil", standIn: false },
  nanopeppers: { src: "/pixel/green-peppers.png", tile: "Green peppers", standIn: true },
};

/** Sheet tiles that are not toppings in the booth. */
export const SHEET_EXTRAS = [
  { src: "/pixel/black-olives.png", tile: "Black olives" },
  { src: "/pixel/red-onion.png", tile: "Red onion" },
  { src: "/pixel/pineapple.png", tile: "Pineapple" },
] as const;

export const OVEN_TIERS = [
  { name: "Stone hearth", blurb: "The brick deck on the left of the sheet." },
  { name: "Neon chrome", blurb: "The cyan-trimmed deck in the middle." },
  { name: "Plasma core", blurb: "The magenta core on the right." },
] as const;

export const CHEF_FRAMES = [
  "/pixel/chef-idle-1.png",
  "/pixel/chef-idle-2.png",
  "/pixel/chef-idle-3.png",
  "/pixel/chef-idle-4.png",
] as const;
