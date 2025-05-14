export interface GameState {
  bottles: number[][];
}

export interface Movement {
  from: number;
  to: number;
  amount: number;
}

export type PourAnimationStage =
  | 'idle'
  | 'calculatingMove'
  | 'movingToTarget'
  | 'tiltingAtTarget'
  | 'streaming'
  | 'returningTiltAtTarget'
  | 'movingBack';

export interface PourAnimation {
  fromIndex: number;
  toIndex: number;
  color: number;
  amount: number;
  stage: PourAnimationStage;
  sourceOriginalX?: number;
  sourceOriginalY?: number;
  pourPositionX?: number; 
  pourPositionY?: number;
}

