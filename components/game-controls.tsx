"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Play, RotateCcw, Zap, Check } from "lucide-react"
import { motion } from "framer-motion"

interface GameControlsProps {
  onReset: () => void
  onSolve: () => void
  onNextStep: () => void
  solving: boolean
  hasSolution: boolean
  solutionProgress: number
  solutionLength: number
  gameComplete: boolean
  disabled?: boolean
}

export function GameControls({
  onReset,
  onSolve,
  onNextStep,
  solving,
  hasSolution,
  solutionProgress,
  solutionLength,
  gameComplete,
  disabled = false,
}: GameControlsProps) {
  const progressPercentage = solutionLength > 0 ? (solutionProgress / solutionLength) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={onReset}
          variant="outline"
          className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
          disabled={disabled}
        >
          <RotateCcw className="h-4 w-4" />
          New Random Puzzle
        </Button>

        <Button
          onClick={onSolve}
          variant="default"
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
          disabled={solving || gameComplete || disabled}
        >
          {solving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Solving...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Auto Solve
            </>
          )}
        </Button>

        {hasSolution && (
          <Button
            onClick={onNextStep}
            variant="secondary"
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
            disabled={solutionProgress >= solutionLength || disabled}
          >
            <Play className="h-4 w-4" />
            Next Step
          </Button>
        )}
      </div>

      {hasSolution && (
        <div className="space-y-2 max-w-md mx-auto">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Solution Progress</span>
            <span>
              {solutionProgress} / {solutionLength}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3 bg-gray-100" />
        </div>
      )}

      {gameComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-md shadow-inner"
        >
          <Check className="h-5 w-5" />
          <span className="font-medium">Puzzle Completed! 🎉</span>
        </motion.div>
      )}
    </motion.div>
  )
}
