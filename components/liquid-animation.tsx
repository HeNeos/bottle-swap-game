"use client"

import type { AnimationState } from "@/lib/types"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface LiquidAnimationProps {
  animation: AnimationState
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

export function LiquidAnimation({ animation }: LiquidAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true)
  const { fromX, fromY, toX, toY, color, amount, onComplete } = animation

  // Calculate the path for the liquid drop
  const pathPoints = [
    [fromX, fromY],
    [fromX, fromY - 30], // Up from source
    [(fromX + toX) / 2, (fromY + toY) / 2 - 50], // Arc high point
    [toX, toY - 30], // Down to destination
    [toX, toY],
  ]

  // Convert points to SVG path
  const path = `M ${pathPoints[0][0]},${pathPoints[0][1]} 
                C ${pathPoints[1][0]},${pathPoints[1][1]} 
                  ${pathPoints[2][0]},${pathPoints[2][1]} 
                  ${pathPoints[3][0]},${pathPoints[3][1]}
                L ${pathPoints[4][0]},${pathPoints[4][1]}`

  useEffect(() => {
    // Trigger onComplete callback when animation finishes
    if (!isAnimating && onComplete) {
      onComplete()
    }
  }, [isAnimating, onComplete])

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <svg className="w-full h-full absolute top-0 left-0">
        {/* Debug path (uncomment to see the path) */}
        {/* <path d={path} fill="none" stroke="rgba(255,0,0,0.3)" strokeWidth="2" /> */}

        {/* Animate multiple drops for a more realistic effect */}
        {Array.from({ length: Math.min(3, amount) }).map((_, i) => (
          <motion.circle
            key={i}
            cx={fromX}
            cy={fromY}
            r={6 + i * 2}
            className={`${colorMap[color]} opacity-80 drop-shadow-lg`}
            initial={{ pathOffset: 0 }}
            animate={{
              pathOffset: 1,
              transition: {
                duration: 0.8 + i * 0.2,
                ease: "easeInOut",
                delay: i * 0.15,
              },
            }}
            onAnimationComplete={() => {
              if (i === Math.min(2, amount - 1)) {
                setIsAnimating(false)
              }
            }}
            style={{ offsetPath: `path("${path}")` }}
          />
        ))}
      </svg>

      {/* Splash effect at destination */}
      <motion.div
        className={`absolute w-8 h-8 rounded-full ${colorMap[color]} opacity-0`}
        style={{
          left: toX - 16,
          top: toY - 16,
          boxShadow: "0 0 10px rgba(255,255,255,0.5)",
        }}
        animate={{
          opacity: [0, 0.7, 0],
          scale: [0.5, 1.5, 0.8],
          transition: {
            duration: 0.5,
            delay: 0.7,
            times: [0, 0.3, 1],
          },
        }}
      />
    </div>
  )
}
