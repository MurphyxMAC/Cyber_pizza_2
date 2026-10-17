"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecipeState } from "@cyberpizza/shared";

export function RecipeMenu({
  recipes,
  signedIn,
  busy,
  onBake,
}: {
  recipes: RecipeState[];
  signedIn: boolean;
  busy: string | null;
  onBake: (recipeId: string) => void;
}) {
  return (
    <section aria-labelledby="recipe-menu-heading">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <h2 id="recipe-menu-heading" className="text-xl font-semibold">
          Recipe menu
        </h2>
        <p className="font-mono text-xs text-pretty text-muted-foreground md:text-right">
          Quantities and CPT stay on the server
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {recipes.map((recipe) => {
          const baking = busy === `bake:${recipe.id}`;
          return (
            <li key={recipe.id}>
              <Card className="stall-panel h-full ring-0">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{recipe.name}</CardTitle>
                      <CardDescription>{recipe.blurb}</CardDescription>
                    </div>
                    <p className="shrink-0 font-mono text-sm text-accent">+{recipe.cptReward} CPT</p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ul className="flex flex-wrap gap-2" aria-label={`${recipe.name} ingredients`}>
                    {recipe.ingredients.map((item) => (
                      <li
                        key={item.id}
                        className={
                          item.enough
                            ? "rounded-full bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent"
                            : "rounded-full bg-black/25 px-2.5 py-1 font-mono text-xs text-muted-foreground"
                        }
                      >
                        {item.name}{" "}
                        {signedIn ? (
                          <span>
                            {item.owned}/{item.quantity}
                          </span>
                        ) : (
                          <span>×{item.quantity}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      disabled={!signedIn || !recipe.canBake || busy !== null}
                      onClick={() => onBake(recipe.id)}
                    >
                      {baking ? "Baking…" : `Bake · ${recipe.cptReward} CPT`}
                    </Button>
                    {signedIn && !recipe.canBake ? (
                      <p className="text-sm text-muted-foreground">Need {recipe.missing.join(", ")}.</p>
                    ) : null}
                    {!signedIn ? <p className="text-sm text-muted-foreground">Sign in to bake.</p> : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
