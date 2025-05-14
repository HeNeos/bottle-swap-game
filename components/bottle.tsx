"use client";

import { cn } from "@/lib/utils";
import { motion, useAnimation } from "framer-motion";
import { forwardRef, useEffect } from "react";
import type { PourAnimation } from "@/lib/types";

interface BottleProps {
  colors: number[];
  selected: boolean;
  onClick: () => void;
  bottleIndex: number;
  height: number;
  pourAnimationInfo?: PourAnimation;
  onAnimationEvent?: (
    event:
      | "moveToTargetComplete"
      | "tiltAtTargetComplete"
      | "streamComplete"
      | "returnTiltAtTargetComplete"
      | "moveBackComplete",
  ) => void;
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
const emptySegmentDarkColor = "dark:bg-neutral-700/30";


export const Bottle = forwardRef<HTMLDivElement, BottleProps>(
  (
    {
      colors,
      selected,
      onClick,
      bottleIndex,
      pourAnimationInfo,
      onAnimationEvent,
      tiltAngleDegrees,
    },
    ref,
  ) => {
    const controls = useAnimation();
    const isPouringSource = pourAnimationInfo?.fromIndex === bottleIndex;
    const pourStage = pourAnimationInfo?.stage;

    useEffect(() => {
      if (!isPouringSource) {
        controls.start({
          opacity: 1,
          x: 0,
          y: 0, 
          rotate: 0,
          zIndex: selected ? 10 : 0,
          transition: { duration: 0.3, delay: bottleIndex * 0.05 },
        });
        return;
      }

      if (pourAnimationInfo) {
        const {
          stage,
          pourPositionX, 
          pourPositionY, 
          sourceOriginalX, 
        } = pourAnimationInfo;

        const deltaX =
          pourPositionX !== undefined && sourceOriginalX !== undefined
            ? pourPositionX - sourceOriginalX
            : 0;
        const transformY = pourPositionY !== undefined ? pourPositionY : 0;

        switch (stage) {
          case "movingToTarget":
            controls
              .start({
                x: deltaX,
                y: transformY, 
                rotate: 0,
                opacity: 1,
                zIndex: 20,
                transition: { duration: 0.3, ease: "easeInOut" },
              })
              .then(() => onAnimationEvent?.("moveToTargetComplete"));
            break;
          case "tiltingAtTarget":
            controls
              .start({
                rotate: tiltAngleDegrees,
                transition: { duration: 0.2, ease: "easeOut" },
              })
              .then(() => onAnimationEvent?.("tiltAtTargetComplete"));
            break;
          case "streaming":
            controls.start({
              x: deltaX,
              y: transformY,
              rotate: tiltAngleDegrees,
              opacity: 1,
              zIndex: 20,
              transition: { duration: 0.1 },
            });
            break;
          case "returningTiltAtTarget":
            controls
              .start({
                rotate: 0,
                transition: { duration: 0.2, ease: "easeIn" },
              })
              .then(() => onAnimationEvent?.("returnTiltAtTargetComplete"));
            break;
          case "movingBack":
            controls
              .start({
                x: 0, 
                y: 0, 
                rotate: 0,
                opacity: 1,
                zIndex: selected ? 10 : 0,
                transition: { duration: 0.3, ease: "easeInOut" },
              })
              .then(() => {
                onAnimationEvent?.("moveBackComplete");
              });
            break;
          default:
            controls.start({
              opacity: 1,
              x: 0,
              y: 0,
              rotate: 0,
              zIndex: selected ? 10 : 0,
              transition: { duration: 0.3 },
            });
            break;
        }
      }
    }, [
      isPouringSource,
      pourStage,
      pourAnimationInfo,
      controls,
      onAnimationEvent,
      bottleIndex,
      selected,
      tiltAngleDegrees,
    ]);

    return (
      <motion.div
        ref={ref}
        animate={controls}
        style={{
          transformOrigin: "bottom center",
        }}
        whileHover={!isPouringSource ? { scale: 1.05 } : {}}
        whileTap={!isPouringSource ? { scale: 0.95 } : {}}
        className={cn(
          "relative w-16 h-64 flex flex-col cursor-pointer",
          "rounded-b-xl overflow-hidden group",
        )}
        onClick={onClick}
      >
        <div className="absolute inset-0 rounded-b-xl bg-gradient-to-r from-white/20 to-white/5 dark:from-neutral-700/20 dark:to-neutral-800/10 backdrop-blur-sm border-2 border-gray-300/50 dark:border-neutral-700/50 shadow-lg pointer-events-none" />

        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-10 h-6 bg-gradient-to-r from-white/40 to-white/10 dark:from-neutral-600/40 dark:to-neutral-700/20 rounded-t-lg border-2 border-gray-300/50 dark:border-neutral-700/50" />

        <div
          className={cn(
            "absolute inset-0 rounded-b-xl border-2 transition-all duration-300",
            selected && !isPouringSource
              ? "border-white dark:border-neutral-300 shadow-[0_0_15px_rgba(255,255,255,0.7)] dark:shadow-[0_0_15px_rgba(200,200,200,0.5)] scale-105"
              : "border-gray-300 dark:border-neutral-700 group-hover:border-white/50 dark:group-hover:border-neutral-500/50",
            isPouringSource &&
              (pourStage === "tiltingAtTarget" ||
                pourStage === "streaming") &&
              "border-blue-400 dark:border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.7)] dark:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
          )}
        />

        <div className="relative flex flex-col h-full w-full">
          {colors.map((color, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.3,
                delay: idx * 0.02 + bottleIndex * 0.05 + 0.2,
              }}
              className={cn(
                "w-full flex-1 transition-colors relative",
                colorMap[color] || "bg-gray-200 dark:bg-neutral-700",
                color === 0 && emptySegmentDarkColor,
                color !== 0 && "bg-opacity-80 dark:bg-opacity-70",
              )}
            >
              {color !== 0 && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none" />
              )}
            </motion.div>
          ))}
        </div>

        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-neutral-800/80 px-2 py-1 rounded-full shadow-sm border border-gray-200 dark:border-neutral-700">
          {bottleIndex + 1}
        </div>
      </motion.div>
    );
  },
);

Bottle.displayName = "Bottle";

