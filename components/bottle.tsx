"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { forwardRef } from "react"

interface BottleProps {
  colors: number[]
  selected: boolean
  onClick: () => void
  bottleIndex: number
}

const colorMap: Record<number, string> = {
  0: "bg-transparent",
  1: "bg-red-500",
  2: "bg-green-500",
  3: "bg-blue-500",
  4: "bg-yellow-500",
  5: "bg-purple-500",
  6: "bg-pink-500",
  7: "bg-orange-500",
  8: "bg-teal-500",
  9: "bg-indigo-500",
  10: "bg-lime-500",
  11: "bg-amber-500",
  12: "bg-cyan-500",
}

export const Bottle = forwardRef<HTMLDivElement, BottleProps>(({ colors, selected, onClick, bottleIndex }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: bottleIndex * 0.05 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative w-16 h-64 flex flex-col cursor-pointer transition-all duration-200",
        "rounded-b-xl overflow-hidden group",
        selected ? "z-10" : "z-0",
      )}
      onClick={onClick}
    >
      {/* Glass effect container */}
      <div className="absolute inset-0 rounded-b-xl bg-gradient-to-r from-white/20 to-white/5 backdrop-blur-sm border-2 border-gray-300/50 shadow-lg pointer-events-none" />

      {/* Bottle neck */}
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-10 h-6 bg-gradient-to-r from-white/40 to-white/10 rounded-t-lg border-2 border-gray-300/50" />

      {/* Bottle outline when selected */}
      <div
        className={cn(
          "absolute inset-0 rounded-b-xl border-2 transition-all duration-300",
          selected
            ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.7)] scale-105"
            : "border-gray-300 group-hover:border-white/50",
        )}
      />

      {/* Liquid segments */}
      <div className="relative flex flex-col h-full w-full">
        {colors.map((color, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: index * 0.03 }}
            className={cn(
              "w-full flex-1 transition-colors relative",
              colorMap[color] || "bg-gray-200",
              color !== 0 && "bg-opacity-80",
            )}
          >
            {/* Shine effect on liquid */}
            {color !== 0 && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
            )}
          </motion.div>
        ))}
      </div>

      {/* Bottle number */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 bg-white/80 px-2 py-1 rounded-full shadow-sm border border-gray-200">
        {bottleIndex + 1}
      </div>
    </motion.div>
  )
})

Bottle.displayName = "Bottle"
