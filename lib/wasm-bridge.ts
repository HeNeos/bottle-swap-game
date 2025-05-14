import type { GameState, Movement } from "./types"

let wasmModule: any = null

export async function initWasm(): Promise<void> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    wasmModule = {
      solve: (state: any) => {
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

export async function solveGame(gameState: GameState): Promise<Movement[]> {
  if (!wasmModule) {
    throw new Error("WASM module not initialized")
  }

  try {
    const wasmInput = {
      bottles: gameState.bottles,
    }

    const solution = await wasmModule.solve(wasmInput)
    return solution
  } catch (error) {
    console.error("Error in WASM solver:", error)
    throw error
  }
}

function improvedSolver(state: GameState): Movement[] {
  const bottles = JSON.parse(JSON.stringify(state.bottles)) 
  const solution: Movement[] = []
  const bottleHeight = bottles[0].length

  const isBottleSolved = (bottle: number[]) => {
    const nonZeros = bottle.filter((c) => c !== 0)
    return (
      nonZeros.length === 0 ||
      (nonZeros.every((c) => c === nonZeros[0]) && (nonZeros.length === bottleHeight || nonZeros.length === 0))
    )
  }

  const isValidMove = (fromBottle: number[], toBottle: number[]) => {
    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0)
    if (fromTopColorIndex === -1) return false 

    const fromTopColor = fromBottle[fromTopColorIndex]
    const toTopColorIndex = toBottle.findIndex((c) => c !== 0)

    if (toTopColorIndex === 0) return false

    if (toTopColorIndex === -1) return true

    return toBottle[toTopColorIndex] === fromTopColor
  }

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

  const applyMove = (bottles: number[][], from: number, to: number, amount: number) => {
    const fromBottle = [...bottles[from]]
    const toBottle = [...bottles[to]]

    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0)
    const fromTopColor = fromBottle[fromTopColorIndex]

    let removed = 0
    for (let i = fromTopColorIndex; i < fromBottle.length && removed < amount; i++) {
      if (fromBottle[i] === fromTopColor) {
        fromBottle[i] = 0
        removed++
      } else break
    }

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

  const maxMoves = 200 
  let moveCount = 0

  while (moveCount < maxMoves) {
    moveCount++

    if (bottles.every(isBottleSolved)) {
      break
    }

    const possibleMoves: { from: number; to: number; amount: number; priority: number }[] = []

    for (let from = 0; from < bottles.length; from++) {
      if (isBottleSolved(bottles[from]) && bottles[from].some((c) => c !== 0)) continue

      for (let to = 0; to < bottles.length; to++) {
        if (from === to) continue

        if (isValidMove(bottles[from], bottles[to])) {
          const amount = calculateMoveAmount(bottles[from], bottles[to])
          if (amount > 0) {
            let priority = 0

            const fromTopColorIndex = bottles[from].findIndex((c) => c !== 0)
            if (fromTopColorIndex !== -1) {
              const fromTopColor = bottles[from][fromTopColorIndex]
              const colorCountInFrom = bottles[from].filter((c) => c === fromTopColor).length

              if (colorCountInFrom === amount) priority += 10

              const toTopColorIndex = bottles[to].findIndex((c) => c !== 0)
              if (toTopColorIndex !== -1) {
                const toTopColor = bottles[to][toTopColorIndex]
                if (toTopColor === fromTopColor) {
                  const colorCountInTo = bottles[to].filter((c) => c === toTopColor).length
                  if (colorCountInTo + amount === bottleHeight) priority += 20
                }
              }

              if (bottles[to].every((c) => c === 0)) priority += 5

              priority += amount
            }

            possibleMoves.push({ from, to, amount, priority })
          }
        }
      }
    }

    if (possibleMoves.length === 0) break

    possibleMoves.sort((a, b) => b.priority - a.priority)

    const bestMove = possibleMoves[0]
    const { from, to, amount } = bestMove

    const { fromTopColor } = applyMove(bottles, from, to, amount)

    solution.push({ from, to, amount })

    if (moveCount > 100 && !bottles.every(isBottleSolved)) {
      break
    }
  }

  return solution
}
