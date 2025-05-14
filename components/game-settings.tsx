"use client"

import { useState, useEffect } from "react"
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
  const [height, setHeight] = useState(initialHeight)

  const minColorsAllowed = 1;
  const [colors, setColors] = useState(() => {
    const maxColorsBasedOnInitialBottles = Math.max(
      minColorsAllowed,
      initialBottles - 2,
    );
    if (initialColors > maxColorsBasedOnInitialBottles) {
      return maxColorsBasedOnInitialBottles;
    }
    if (initialColors < minColorsAllowed) {
      return minColorsAllowed;
    }
    return initialColors;
  });

  useEffect(() => {
    const maxColorsForCurrentBottles = Math.max(
      minColorsAllowed,
      bottles - 2,
    );
    setColors((currentColors) => {
      if (currentColors > maxColorsForCurrentBottles) {
        return maxColorsForCurrentBottles;
      }
      if (currentColors < minColorsAllowed) {
        return minColorsAllowed;
      }
      return currentColors; 
    });
  }, [bottles, minColorsAllowed]);

  const currentMaxColorsForSlider = Math.max(minColorsAllowed, bottles - 2);

return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">Game Settings</h2>
        <p className="text-muted-foreground mt-2">
          Customize your puzzle difficulty
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="bottles" className="text-base text-foreground">
              Number of Bottles
            </Label>
            <span className="text-lg font-medium text-purple-600 dark:text-purple-400">
              {bottles}
            </span>
          </div>
          <Slider
            id="bottles"
            min={3} // Min 3 bottles ensures (bottles - 2) is at least 1
            max={12}
            step={1}
            value={[bottles]}
            onValueChange={(value) => setBottles(value[0])}
            className="py-4"
            disabled={disabled}
          />
          <p className="text-sm text-muted-foreground">
            More bottles means more space to work with, but also more
            complexity.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="colors" className="text-base text-foreground">
              Number of Colors
            </Label>
            <span className="text-lg font-medium text-purple-600 dark:text-purple-400">
              {colors}
            </span>
          </div>
          <Slider
            id="colors"
            min={minColorsAllowed}
            max={currentMaxColorsForSlider} // Dynamic max
            step={1}
            value={[colors]}
            onValueChange={(value) => setColors(value[0])}
            className="py-4"
            disabled={disabled || currentMaxColorsForSlider < minColorsAllowed} // Disable if range invalid
          />
          <p className="text-sm text-muted-foreground">
            Max colors: {currentMaxColorsForSlider}. More colors increase the
            difficulty. (Recommended: ≤ Bottles - 2 for 2 empty bottles)
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="height" className="text-base text-foreground">
              Bottle Height
            </Label>
            <span className="text-lg font-medium text-purple-600 dark:text-purple-400">
              {height}
            </span>
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
          <p className="text-sm text-muted-foreground">
            Taller bottles give you more space for each color.
          </p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={() => onApply(bottles, colors, height)}
          className="px-8 py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600 shadow-md hover:shadow-lg transition-all text-white dark:text-primary-foreground"
          disabled={disabled}
        >
          Apply & Start New Game
        </Button>
      </div>
    </motion.div>
  );
}
