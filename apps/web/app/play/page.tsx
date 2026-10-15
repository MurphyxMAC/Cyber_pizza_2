import { GameBoard } from "@/components/game-board";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kitchen",
  description:
    "Clock in on the Avalanche Fuji testnet, collect nine toppings, bake a Neon Supreme, and claim CPT.",
};

export default function PlayPage() {
  return <GameBoard />;
}
