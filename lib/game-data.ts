import type { GameState } from "./types";

// Corrected initial game state: 7 bottles, 9 levels, 5 colors (9 units each)
export const initialGameState: GameState = {
  bottles: [
    // Bottle 0 (Filled)
    [1, 2, 3, 4, 5, 1, 2, 3, 4],
    // Bottle 1 (Filled)
    [5, 1, 2, 3, 4, 5, 1, 2, 3],
    // Bottle 2 (Filled)
    [4, 5, 1, 2, 3, 4, 5, 1, 2],
    // Bottle 3 (Filled)
    [3, 4, 5, 1, 2, 3, 4, 5, 1],
    // Bottle 4 (Filled)
    [2, 3, 4, 5, 1, 2, 3, 4, 5],
    // Bottle 5 (Empty)
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    // Bottle 6 (Empty)
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

// Generate a random game state (ensure numColors = numBottles - 2 for correctness)
export function generateRandomState(
  numBottles: number,
  numColors: number,
  bottleHeight: number,
): GameState {
  // Ensure the number of colors matches the number of bottles to fill
  // This is crucial for generating a state with the correct liquid counts
  const expectedColors = numBottles > 1 ? numBottles - 2 : 0;
  if (numColors !== expectedColors) {
    console.warn(
      `Generating state with numColors=${numColors} but expected ${expectedColors} based on numBottles=${numBottles}. Adjusting numColors for generation.`,
    );
    numColors = expectedColors; // Use the correct number of colors for generation
  }

  if (numColors <= 0) {
    // Handle edge case where there are no colors to generate (e.g., 2 bottles)
    const bottles = Array.from({ length: numBottles }, () =>
      Array(bottleHeight).fill(0),
    );
    return { bottles };
  }

  const filledBottles = numColors; // Number of bottles to fill is now equal to numColors

  // Create an array of all the liquid units we need
  const allLiquids: number[] = [];
  for (let color = 1; color <= numColors; color++) {
    for (let i = 0; i < bottleHeight; i++) {
      allLiquids.push(color);
    }
  }

  // Shuffle the liquids
  shuffleArray(allLiquids);

  // Create the bottles
  const bottles: number[][] = [];

  // Fill the bottles with the shuffled liquids
  for (let i = 0; i < filledBottles; i++) {
    const bottle: number[] = Array(bottleHeight).fill(0);
    // Fill from bottom up visually (index height-1 is bottom)
    for (let j = 0; j < bottleHeight; j++) {
      if (allLiquids.length > 0) {
        bottle[bottleHeight - 1 - j] = allLiquids.pop()!; // Use non-null assertion as length is checked
      }
    }
     // Ensure bottle array is correct length even if allLiquids runs out early (shouldn't happen now)
     while (bottle.length < bottleHeight) {
        bottle.unshift(0);
     }
    bottles.push(bottle);
  }

  // Add empty bottles (numBottles - filledBottles should be 2)
  const emptyBottleCount = numBottles - filledBottles;
  for (let i = 0; i < emptyBottleCount; i++) {
    bottles.push(Array(bottleHeight).fill(0));
  }

  // Ensure the final number of bottles matches numBottles requested
  while (bottles.length < numBottles) {
      console.warn("Adding extra empty bottles due to configuration mismatch.");
      bottles.push(Array(bottleHeight).fill(0));
  }
   if (bottles.length > numBottles) {
       console.warn("Trimming extra bottles due to configuration mismatch.");
       bottles.length = numBottles;
   }


  return { bottles };
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

