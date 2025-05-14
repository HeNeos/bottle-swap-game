import type { GameState } from "./types";

export const initialGameState: GameState = {
  bottles: [
    [1, 2, 3, 4, 5, 1, 2, 3, 4],
    [5, 1, 2, 3, 4, 5, 1, 2, 3],
    [4, 5, 1, 2, 3, 4, 5, 1, 2],
    [3, 4, 5, 1, 2, 3, 4, 5, 1],
    [2, 3, 4, 5, 1, 2, 3, 4, 5],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

export function generateRandomState(
  numBottles: number,
  numColors: number, 
  bottleHeight: number,
): GameState {

  if (numColors <= 0) {
    console.warn(
      `generateRandomState called with numColors=${numColors}. Creating all empty bottles.`,
    );
    const bottles = Array.from({ length: numBottles }, () =>
      Array(bottleHeight).fill(0),
    );
    return { bottles };
  }

  const filledBottlesCount = numColors;

  const allLiquids: number[] = [];
  for (let color = 1; color <= numColors; color++) {
    for (let i = 0; i < bottleHeight; i++) {
      allLiquids.push(color);
    }
  }

  shuffleArray(allLiquids);

  const bottles: number[][] = [];

  for (let i = 0; i < filledBottlesCount; i++) {
    const bottle: number[] = Array(bottleHeight).fill(0);
    for (let j = 0; j < bottleHeight; j++) {
      if (allLiquids.length > 0) {
        bottle[bottleHeight - 1 - j] = allLiquids.pop()!;
      }
    }
    bottles.push(bottle);
  }

  const emptyBottleCount = numBottles - filledBottlesCount;

  for (let i = 0; i < emptyBottleCount; i++) {
    bottles.push(Array(bottleHeight).fill(0));
  }

  while (bottles.length < numBottles) {
    console.warn(
      "generateRandomState: Adding extra empty bottles due to configuration mismatch.",
    );
    bottles.push(Array(bottleHeight).fill(0));
  }
  if (bottles.length > numBottles) {
    console.warn(
      "generateRandomState: Trimming extra bottles due to configuration mismatch.",
    );
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

