"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { motion } from "framer-motion"

interface GameSettingsProps {
  initialBottles: number
  initialColors: number
  initialHeight: number
  onApply: (bottles: number, colors: number, height: number) => void
  disabled?: boolean
}

export function GameSettings({
  initialBottles,
  initialColors,
  initialHeight,
  onApply,
  disabled = false,
}: GameSettingsProps) {
  const [bottles, setBottles] = useState(initialBottles)
  const [colors, setColors] = useState(initialColors)
  const [height, setHeight] = useState(initialHeight)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Game Settings</h2>
        <p className="text-gray-500 mt-2">Customize your puzzle difficulty</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="bottles" className="text-base">
              Number of Bottles
            </Label>
            <span className="text-lg font-medium text-purple-600">{bottles}</span>
          </div>
          <Slider
            id="bottles"
            min={3}
            max={12}
            step={1}
            value={[bottles]}
            onValueChange={(value) => setBottles(value[0])}
            className="py-4"
            disabled={disabled}
          />
          <p className="text-sm text-gray-500">More bottles means more space to work with, but also more complexity.</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="colors" className="text-base">
              Number of Colors
            </Label>
            <span className="text-lg font-medium text-purple-600">{colors}</span>
          </div>
          <Slider
            id="colors"
            min={2}
            max={12}
            step={1}
            value={[colors]}
            onValueChange={(value) => setColors(value[0])}
            className="py-4"
            disabled={disabled}
          />
          <p className="text-sm text-gray-500">More colors increase the difficulty of the puzzle.</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="height" className="text-base">
              Bottle Height
            </Label>
            <span className="text-lg font-medium text-purple-600">{height}</span>
          </div>
          <Slider
            id="height"
            min={4}
            max={12}
            step={1}
            value={[height]}
            onValueChange={(value) => setHeight(value[0])}
            className="py-4"
            disabled={disabled}
          />
          <p className="text-sm text-gray-500">Taller bottles give you more space for each color.</p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={() => onApply(bottles, colors, height)}
          className="px-8 py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
          disabled={disabled}
        >
          Apply & Start New Game
        </Button>
      </div>
    </motion.div>
  )
}
