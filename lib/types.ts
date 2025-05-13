export interface GameState {
  bottles: number[][]
}

export interface Movement {
  from: number
  to: number
  amount: number
}

export interface AnimationState {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: number
  amount: number
  fromIndex: number
  toIndex: number
  onComplete: () => void
}
