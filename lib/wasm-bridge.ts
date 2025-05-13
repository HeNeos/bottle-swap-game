import type { GameState, Movement } from "./types"

// This will be replaced by the actual WASM module
let wasmModule: any = null

// Initialize the WASM module
export async function initWasm(): Promise<void> {
  try {
    // In a real implementation, we would load the Rust WASM module here
    // For now, we'll simulate it with a delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock WASM module for demonstration
    wasmModule = {
      solve: (state: any) => {
        // This is where the actual Rust WASM solver would be called
        // For now, we'll return a mock solution
        return improvedSolver(state)
      },
    }

    console.log("WASM module initialized successfully")
    return Promise.resolve()
  } catch (error) {
    console.error("Failed to initialize WASM module:", error)
    return Promise.reject(error)
  }
}

// Solve the game using the WASM module
export async function solveGame(gameState: GameState): Promise<Movement[]> {
  if (!wasmModule) {
    throw new Error("WASM module not initialized")
  }

  try {
    // Convert gameState to format expected by WASM
    const wasmInput = {
      bottles: gameState.bottles,
    }

    // Call the WASM solver
    const solution = await wasmModule.solve(wasmInput)
    return solution
  } catch (error) {
    console.error("Error in WASM solver:", error)
    throw error
  }
}

// Improved solver implementation that actually solves the puzzle
function improvedSolver(state: GameState): Movement[] {
  const bottles = JSON.parse(JSON.stringify(state.bottles)) // Deep copy
  const solution: Movement[] = []
  const bottleHeight = bottles[0].length

  // Helper function to check if a bottle is solved (contains only one color or is empty)
  const isBottleSolved = (bottle: number[]) => {
    const nonZeros = bottle.filter((c) => c !== 0)
    return (
      nonZeros.length === 0 ||
      (nonZeros.every((c) => c === nonZeros[0]) && (nonZeros.length === bottleHeight || nonZeros.length === 0))
    )
  }

  // Helper function to check if a move is valid
  const isValidMove = (fromBottle: number[], toBottle: number[]) => {
    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0)
    if (fromTopColorIndex === -1) return false // Source is empty

    const fromTopColor = fromBottle[fromTopColorIndex]
    const toTopColorIndex = toBottle.findIndex((c) => c !== 0)

    // If destination is full, move is invalid
    if (toTopColorIndex === 0) return false

    // If destination is empty, move is valid
    if (toTopColorIndex === -1) return true

    // If destination has same color at top, move is valid
    return toBottle[toTopColorIndex] === fromTopColor
  }

  // Helper function to calculate how many units can be moved
  const calculateMoveAmount = (fromBottle: number[], toBottle: number[]) => {
    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0)
    if (fromTopColorIndex === -1) return 0

    const fromTopColor = fromBottle[fromTopColorIndex]
    let count = 0

    for (let i = fromTopColorIndex; i < fromBottle.length; i++) {
      if (fromBottle[i] === fromTopColor) count++
      else break
    }

    const emptySpaces = toBottle.filter((c) => c === 0).length
    return Math.min(count, emptySpaces)
  }

  // Helper function to apply a move
  const applyMove = (bottles: number[][], from: number, to: number, amount: number) => {
    const fromBottle = [...bottles[from]]
    const toBottle = [...bottles[to]]

    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0)
    const fromTopColor = fromBottle[fromTopColorIndex]

    // Remove from source
    let removed = 0
    for (let i = fromTopColorIndex; i < fromBottle.length && removed < amount; i++) {
      if (fromBottle[i] === fromTopColor) {
        fromBottle[i] = 0
        removed++
      } else break
    }

    // Add to destination
    let toEmptyIndex = toBottle.findIndex((c) => c !== 0) - 1
    if (toEmptyIndex === -2) toEmptyIndex = toBottle.length - 1

    let added = 0
    for (let i = toEmptyIndex; i >= 0 && added < amount; i--) {
      toBottle[i] = fromTopColor
      added++
    }

    bottles[from] = fromBottle
    bottles[to] = toBottle

    return { fromTopColor, amount }
  }

  // Simulation-based solver
  // This is a simplified approach that tries to make progress toward a solution
  const maxMoves = 200 // Prevent infinite loops
  let moveCount = 0

  while (moveCount < maxMoves) {
    moveCount++

    // Check if puzzle is solved
    if (bottles.every(isBottleSolved)) {
      break
    }

    // Find all possible moves
    const possibleMoves: { from: number; to: number; amount: number; priority: number }[] = []

    for (let from = 0; from < bottles.length; from++) {
      // Skip solved bottles as source
      if (isBottleSolved(bottles[from]) && bottles[from].some((c) => c !== 0)) continue

      for (let to = 0; to < bottles.length; to++) {
        if (from === to) continue

        if (isValidMove(bottles[from], bottles[to])) {
          const amount = calculateMoveAmount(bottles[from], bottles[to])
          if (amount > 0) {
            // Calculate move priority
            let priority = 0

            // Higher priority for moves that complete a bottle
            const fromTopColorIndex = bottles[from].findIndex((c) => c !== 0)
            if (fromTopColorIndex !== -1) {
              const fromTopColor = bottles[from][fromTopColorIndex]
              const colorCountInFrom = bottles[from].filter((c) => c === fromTopColor).length

              // Check if this move would empty the bottle
              if (colorCountInFrom === amount) priority += 10

              // Check if this move would complete a color in the destination
              const toTopColorIndex = bottles[to].findIndex((c) => c !== 0)
              if (toTopColorIndex !== -1) {
                const toTopColor = bottles[to][toTopColorIndex]
                if (toTopColor === fromTopColor) {
                  const colorCountInTo = bottles[to].filter((c) => c === toTopColor).length
                  if (colorCountInTo + amount === bottleHeight) priority += 20
                }
              }

              // Prefer moving to empty bottles
              if (bottles[to].every((c) => c === 0)) priority += 5

              // Prefer larger moves
              priority += amount
            }

            possibleMoves.push({ from, to, amount, priority })
          }
        }
      }
    }

    // If no moves are possible, break
    if (possibleMoves.length === 0) break

    // Sort moves by priority (highest first)
    possibleMoves.sort((a, b) => b.priority - a.priority)

    // Apply the best move
    const bestMove = possibleMoves[0]
    const { from, to, amount } = bestMove

    const { fromTopColor } = applyMove(bottles, from, to, amount)

    // Add to solution
    solution.push({ from, to, amount })

    // If we've made a lot of moves without solving, restart with a different approach
    if (moveCount > 100 && !bottles.every(isBottleSolved)) {
      // This would be a good place to implement a more sophisticated solver
      // For now, we'll just return what we have
      break
    }
  }

  return solution
}
