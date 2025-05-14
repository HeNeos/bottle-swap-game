"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Bottle } from "@/components/bottle";
import { GameControls } from "@/components/game-controls";
import { GameSettings } from "@/components/game-settings";
import { LiquidAnimation } from "@/components/liquid-animation";
import { ThemeToggle } from "@/components/theme-toggle";
import type {
  GameState as JsGameStateFromTypes,
  Movement,
  PourAnimation,
  PourAnimationStage,
} from "@/lib/types";
import { generateRandomState, initialGameState } from "@/lib/game-data";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

import initSolve, {
  solve as solveWasm,
} from "@/rust/pkg/bottle_swap_solver";

interface RustSolverInput {
  bottles: number[][];
}

const BOTTLE_TILT_ANGLE_DEGREES = -75;

export default function Home() {
  const [gameState, setGameState] =
    useState<JsGameStateFromTypes>(initialGameState);
  const [selectedBottle, setSelectedBottle] = useState<number | null>(null);
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<Movement[]>([]);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [numBottles, setNumBottles] = useState(7);
  const [numColors, setNumColors] = useState(5);
  const [bottleHeight, setBottleHeight] = useState(9);

  const [activeTab, setActiveTab] = useState("game");
  const bottleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gameAreaRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [wasmReady, setWasmReady] = useState(false);
  const [currentPour, setCurrentPour] = useState<PourAnimation | null>(null);

  useEffect(() => {
    resetGameLogic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numBottles, numColors, bottleHeight]);

  useEffect(() => {
    async function loadWasm() {
      try {
        await initSolve();
        setWasmReady(true);
        console.log("Rust Wasm module initialized successfully.");
        toast({
          title: "Solver Ready",
          description:
            "The Rust-powered game solver has been loaded successfully!",
        });
      } catch (err) {
        console.error("Failed to initialize Rust Wasm module:", err);
        setError(
          "Failed to load the game solver. Please build it (cd rust && wasm-pack build --target web --out-dir pkg) and refresh.",
        );
        toast({
          title: "Solver Load Error",
          description:
            "Could not load the game solver. Please build it and refresh.",
          variant: "destructive",
        });
      }
    }
    loadWasm();
  }, [toast]);

  useEffect(() => {
    bottleRefs.current = bottleRefs.current.slice(0, gameState.bottles.length);
  }, [gameState.bottles.length]);

  useEffect(() => {
    if (currentPour?.stage === "calculatingMove") {
      const { fromIndex, toIndex } = currentPour;
      const sourceEl = bottleRefs.current[fromIndex];
      const targetEl = bottleRefs.current[toIndex];
      const gameAreaEl = gameAreaRef.current;

      if (sourceEl && targetEl && gameAreaEl) {
        const gameAreaRect = gameAreaEl.getBoundingClientRect();
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const sourceOriginalX_relativeToGameArea =
          sourceRect.left - gameAreaRect.left;

        const bottleVisualHeight = sourceRect.height;
        const bottleVisualWidth = sourceRect.width;
        const theta = (BOTTLE_TILT_ANGLE_DEGREES * Math.PI) / 180;
        const mouthShiftXDueToTilt = bottleVisualHeight * Math.sin(theta);

        const targetMouthX_relativeToGameArea =
          targetRect.left - gameAreaRect.left + targetRect.width / 2;

        const calculatedPourPositionX_relativeToGameArea =
          targetMouthX_relativeToGameArea -
          bottleVisualWidth / 2 -
          mouthShiftXDueToTilt;

        const targetBottleTop_relativeToGameArea =
          targetRect.top - gameAreaRect.top;
        const desiredSourceBottomY_relativeToGameArea =
          targetBottleTop_relativeToGameArea - 20;

        const desiredSourceTopY_relativeToGameArea =
          desiredSourceBottomY_relativeToGameArea - bottleVisualHeight;

        const currentSourceTopY_relativeToGameArea =
          sourceRect.top - gameAreaRect.top;

        const calculatedTransformDeltaY =
          desiredSourceTopY_relativeToGameArea -
          currentSourceTopY_relativeToGameArea;

        setCurrentPour((prev) =>
          prev
            ? {
                ...prev,
                sourceOriginalX: sourceOriginalX_relativeToGameArea,
                pourPositionX: calculatedPourPositionX_relativeToGameArea,
                pourPositionY: calculatedTransformDeltaY,
                stage: "movingToTarget",
              }
            : null,
        );
      } else {
        console.error(
          "Could not get bottle/gameArea elements for position calculation",
        );
        setCurrentPour(null);
      }
    }
  }, [currentPour]);

  const moveLiquid = (
    state: JsGameStateFromTypes,
    fromIndex: number,
    toIndex: number,
    amount: number,
    colorToMove: number,
  ) => {
    const fromBottleOriginal = state.bottles[fromIndex];
    const toBottleOriginal = state.bottles[toIndex];

    const fromBottle = [...fromBottleOriginal];
    let removedSoFar = 0;
    const fromTopLiquidIndex = fromBottle.findIndex((c) => c !== 0);

    if (fromTopLiquidIndex !== -1) {
      for (
        let i = fromTopLiquidIndex;
        i < fromBottle.length && removedSoFar < amount;
        i++
      ) {
        if (fromBottle[i] === colorToMove) {
          fromBottle[i] = 0;
          removedSoFar++;
        } else {
          break;
        }
      }
    }
    const compactedFrom = fromBottle.filter((c) => c !== 0);
    const finalFrom = Array(bottleHeight - compactedFrom.length)
      .fill(0)
      .concat(compactedFrom);
    state.bottles[fromIndex] = finalFrom;

    const toBottle = [...toBottleOriginal];
    const existingLiquids = toBottle.filter((c) => c !== 0);
    const newLiquids = Array(amount).fill(colorToMove);
    const combinedLiquids = [...newLiquids, ...existingLiquids];
    const finalTo = Array(bottleHeight - combinedLiquids.length)
      .fill(0)
      .concat(combinedLiquids);
    state.bottles[toIndex] = finalTo;
  };

  const handleBottleClick = (bottleIndex: number) => {
    if (solving || currentPour) return;

    if (selectedBottle === null) {
      if (gameState.bottles[bottleIndex].some((c) => c !== 0)) {
        setSelectedBottle(bottleIndex);
      }
    } else if (selectedBottle === bottleIndex) {
      setSelectedBottle(null);
    } else {
      const fromBottleArray = gameState.bottles[selectedBottle];
      const toBottleArray = gameState.bottles[bottleIndex];
      const amount = calculateMoveAmount(fromBottleArray, toBottleArray);

      if (amount > 0 && isValidMove(fromBottleArray, toBottleArray)) {
        const fromTopColorIndex = fromBottleArray.findIndex((c) => c !== 0);
        const colorToMove =
          fromTopColorIndex !== -1 ? fromBottleArray[fromTopColorIndex] : 0;
        if (colorToMove !== 0) {
          setCurrentPour({
            fromIndex: selectedBottle,
            toIndex: bottleIndex,
            color: colorToMove,
            amount,
            stage: "calculatingMove",
          });
        }
      } else {
        toast({
          title: "Invalid Move",
          description: "Cannot pour from this bottle to the selected bottle.",
          variant: "destructive",
        });
        setSelectedBottle(null);
      }
    }
  };

  const handleAnimationEvent = (
    event:
      | "moveToTargetComplete"
      | "tiltAtTargetComplete"
      | "streamComplete"
      | "returnTiltAtTargetComplete"
      | "moveBackComplete",
  ) => {
    setCurrentPour((prevPour) => {
      if (!prevPour) return null;

      switch (prevPour.stage) {
        case "movingToTarget":
          if (event === "moveToTargetComplete")
            return { ...prevPour, stage: "tiltingAtTarget" };
          break;
        case "tiltingAtTarget":
          if (event === "tiltAtTargetComplete")
            return { ...prevPour, stage: "streaming" };
          break;
        case "streaming":
          if (event === "streamComplete")
            return { ...prevPour, stage: "returningTiltAtTarget" };
          break;
        case "returningTiltAtTarget":
          if (event === "returnTiltAtTargetComplete")
            return { ...prevPour, stage: "movingBack" };
          break;
        case "movingBack":
          if (event === "moveBackComplete") {
            const { fromIndex, toIndex, amount, color } = prevPour;
            const newGameState = {
              ...gameState,
              bottles: gameState.bottles.map((b) => [...b]),
            };
            moveLiquid(newGameState, fromIndex, toIndex, amount, color);
            setGameState(newGameState);
            setSelectedBottle(null);
            if (isGameSolved(newGameState)) celebrateWin();
            return null;
          }
          break;
      }
      return prevPour;
    });
  };

  const isValidMove = (fromBottle: number[], toBottle: number[]) => {
    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0);
    if (fromTopColorIndex === -1) return false;
    const fromTopColor = fromBottle[fromTopColorIndex];
    const toFilledHeight = toBottle.filter((c) => c !== 0).length;
    if (toFilledHeight >= bottleHeight) return false;
    if (toFilledHeight === 0) return true;
    const toTopColorIndex = toBottle.findIndex((c) => c !== 0);
    const toTopColor = toBottle[toTopColorIndex];
    return fromTopColor === toTopColor;
  };

  const calculateMoveAmount = (fromBottle: number[], toBottle: number[]) => {
    if (!isValidMove(fromBottle, toBottle)) return 0;
    const fromTopColorIndex = fromBottle.findIndex((c) => c !== 0);
    const fromTopColor = fromBottle[fromTopColorIndex];
    let colorCount = 0;
    for (let i = fromTopColorIndex; i < bottleHeight; i++) {
      if (fromBottle[i] === fromTopColor) colorCount++;
      else if (fromBottle[i] !== 0) break;
    }
    const toFilledHeight = toBottle.filter((c) => c !== 0).length;
    const emptySpaces = bottleHeight - toFilledHeight;
    return Math.min(colorCount, emptySpaces);
  };

  const resetGameLogic = () => {
    if (currentPour) return;
    const newState = generateRandomState(numBottles, numColors, bottleHeight);
    setGameState(newState);
    setSelectedBottle(null);
    setSolution([]);
    setSolutionIndex(0);
    setSolving(false);
    setError(null);
  };

  const resetGame = () => {
    resetGameLogic();
    toast({
      title: "Game Reset",
      description: "A new random puzzle has been generated.",
    });
  };

  const handleSolve = async () => {
    if (currentPour || !wasmReady) {
      if (!wasmReady)
        toast({
          title: "Solver Not Ready",
          description: "Please wait.",
          variant: "destructive",
        });
      return;
    }
    try {
      setSolving(true);
      setError(null);
      toast({
        title: "Finding Solution (Rust Wasm)",
        description: "Calculating...",
      });
      const validatedBottles = gameState.bottles.map((bottle) => {
        const b = [...bottle];
        while (b.length < bottleHeight) b.unshift(0);
        return b.slice(0, bottleHeight);
      });
      const solverInput: RustSolverInput = { bottles: validatedBottles };
      const result: Movement[] = solveWasm(
        bottleHeight,
        numBottles,
        solverInput,
      );
      if (result && result.length === 0) {
        toast({
          title: "No Solution Found",
          description: "This puzzle may be unsolvable.",
          variant: "destructive",
        });
        setSolution([]);
      } else if (result) {
        setSolution(result);
        setSolutionIndex(0);
        toast({
          title: "Solution Found!",
          description: `Found solution in ${result.length} moves.`,
        });
      } else {
        throw new Error("Solver returned an unexpected result.");
      }
    } catch (err: any) {
      console.error("Rust Wasm Solver error:", err);
      const errorMessage =
        err.message || "Failed to solve the game using Rust Wasm.";
      setError(errorMessage);
      toast({
        title: "Rust Wasm Solver Error",
        description: errorMessage,
        variant: "destructive",
      });
      setSolution([]);
    } finally {
      setSolving(false);
    }
  };

  const applyNextSolutionStep = () => {
    if (
      solution.length === 0 ||
      solutionIndex >= solution.length ||
      currentPour
    )
      return;
    const move = solution[solutionIndex];
    const fromBottleArray = gameState.bottles[move.from];
    const fromTopColorIndex = fromBottleArray.findIndex((c) => c !== 0);
    if (fromTopColorIndex === -1) {
      toast({
        title: "Solution Step Error",
        description: "Source bottle empty.",
        variant: "destructive",
      });
      return;
    }
    const colorToMove = fromBottleArray[fromTopColorIndex];
    setCurrentPour({
      fromIndex: move.from,
      toIndex: move.to,
      color: colorToMove,
      amount: move.amount,
      stage: "calculatingMove",
    });
    setSolutionIndex(solutionIndex + 1);
    if (solutionIndex === solution.length - 1) {
      toast({ title: "Solution Complete", description: "Puzzle solved!" });
    }
  };

  const isGameSolved = (state = gameState) => {
    return state.bottles.every((bottle) => {
      const filledLevels = bottle.filter((c) => c !== 0);
      if (filledLevels.length === 0) return true;
      const firstColor = filledLevels[0];
      return filledLevels.every((color) => color === firstColor);
    });
  };

  const applySettings = (bottles: number, colors: number, height: number) => {
    if (currentPour) return;
    setNumBottles(bottles);
    setNumColors(colors);
    setBottleHeight(height);
    setActiveTab("game");
    toast({
      title: "Settings Applied",
      description: `Game configured: ${bottles} bottles, ${colors} colors, ${height} levels.`,
    });
  };

  const celebrateWin = () => {
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      zIndex: 10000,
    });
    toast({
      title: "Congratulations!",
      description: "You solved the puzzle!",
      duration: 5000,
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gradient-to-b from-purple-50 to-blue-50 dark:from-neutral-900 dark:to-slate-800">
      <div className="z-10 w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="w-full flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-gray-200 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
            Bottle Swap Game
          </h1>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full md:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="game">Game</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </Tabs>
            <ThemeToggle />
          </div>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="game" className="mt-0">
            <Card className="w-full p-6 shadow-xl rounded-xl border-0 overflow-hidden backdrop-blur-sm bg-card/90 dark:bg-card/80">
              <div
                ref={gameAreaRef}
                className="flex flex-wrap justify-center items-end gap-4 mb-6 relative min-h-[28rem]"
              >
                {gameState.bottles.map((bottleColors, index) => (
                  <Bottle
                    key={`${numBottles}-${bottleHeight}-${index}`}
                    colors={bottleColors}
                    selected={selectedBottle === index && !currentPour}
                    onClick={() => handleBottleClick(index)}
                    bottleIndex={index}
                    ref={(el) => (bottleRefs.current[index] = el)}
                    height={bottleHeight}
                    pourAnimationInfo={
                      currentPour?.fromIndex === index ? currentPour : undefined
                    }
                    onAnimationEvent={handleAnimationEvent}
                    tiltAngleDegrees={BOTTLE_TILT_ANGLE_DEGREES}
                  />
                ))}
                {currentPour?.stage === "streaming" &&
                  currentPour.fromIndex !== undefined &&
                  bottleRefs.current[currentPour.fromIndex] &&
                  bottleRefs.current[currentPour.toIndex] && (
                    <LiquidAnimation
                      sourceBottleRef={
                        bottleRefs.current[currentPour.fromIndex]!
                      }
                      targetBottleRef={
                        bottleRefs.current[currentPour.toIndex]!
                      }
                      color={currentPour.color}
                      onStreamComplete={() =>
                        handleAnimationEvent("streamComplete")
                      }
                      tiltAngleDegrees={BOTTLE_TILT_ANGLE_DEGREES}
                    />
                  )}
              </div>
              <GameControls
                onReset={resetGame}
                onSolve={handleSolve}
                onNextStep={applyNextSolutionStep}
                solving={solving}
                hasSolution={solution.length > 0}
                solutionProgress={solutionIndex}
                solutionLength={solution.length}
                gameComplete={isGameSolved()}
                disabled={!!currentPour || !wasmReady}
              />
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <Card className="w-full p-6 shadow-xl rounded-xl border-0 bg-card/90 dark:bg-card/80">
              <GameSettings
                initialBottles={numBottles}
                initialColors={numColors}
                initialHeight={bottleHeight}
                onApply={applySettings}
                disabled={!!currentPour}
              />
            </Card>
          </TabsContent>
        </Tabs>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <p>
            Solver status:{" "}
            {wasmReady ? "Solver loaded" : "Loading solver..."}
          </p>
        </div>
      </div>

      <footer className="w-full flex justify-center mt-auto pt-8 pb-4">
        <div className="text-center text-muted-foreground text-sm">
          <p className="mt-1">
            A puzzle game implemented with Rust (Wasm) solver
          </p>
        </div>
      </footer>
      <Toaster />
    </main>
  );
}

