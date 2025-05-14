"use client";

import { motion } from "framer-motion";

interface LiquidAnimationProps {
  sourceBottleRef: HTMLDivElement;
  targetBottleRef: HTMLDivElement;
  color: number;
  onStreamComplete: () => void;
  tiltAngleDegrees: number;
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
};

export function LiquidAnimation({
  sourceBottleRef,
  targetBottleRef,
  color,
  onStreamComplete,
  tiltAngleDegrees,
}: LiquidAnimationProps) {
  const svgContainer = sourceBottleRef.offsetParent as HTMLElement | null;

  if (!svgContainer) {
    console.error("LiquidAnimation: Could not find offsetParent for bottles.");
    return null;
  }

  const sourceRect = sourceBottleRef.getBoundingClientRect();
  const targetRect = targetBottleRef.getBoundingClientRect();
  const svgOriginRect = svgContainer.getBoundingClientRect();

  const bottleVisualHeight = sourceRect.height;
  const bottleVisualWidth = sourceRect.width;
  const theta = (tiltAngleDegrees * Math.PI) / 180;

  let sx = sourceRect.right - svgOriginRect.left - bottleVisualWidth * 0.15;
  let sy = sourceRect.top - svgOriginRect.top + bottleVisualHeight * 0.1; 

  if (tiltAngleDegrees > 0) {
    sx = sourceRect.left - svgOriginRect.left + bottleVisualWidth * 0.15;
    sy = sourceRect.top - svgOriginRect.top + bottleVisualHeight * 0.1;
  }


  const ex = targetRect.left - svgOriginRect.left + targetRect.width / 2;
  const ey = targetRect.top - svgOriginRect.top + 5;

  const controlX = (sx + ex) / 2;
  const controlY = Math.min(sy, ey) - 60 - Math.abs(sx - ex) * 0.15;


  const pathD = `M ${sx} ${sy} Q ${controlX} ${controlY} ${ex} ${ey}`;

  return (
    <div className="absolute inset-0 pointer-events-none z-[15] overflow-visible">
      <svg width="100%" height="100%" className="overflow-visible">
        <motion.path
          d={pathD}
          stroke={colorMap[color] || "grey"}
          strokeWidth="10"
          fill="transparent"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.7 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          onAnimationComplete={onStreamComplete}
        />
      </svg>
    </div>
  );
}

