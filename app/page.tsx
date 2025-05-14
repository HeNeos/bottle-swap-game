"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Bottle } from "@/components/bottle";
import { GameControls } from "@/components/game-controls";
import { GameSettings } from "@/components/game-settings";
import { LiquidAnimation } from "@/components/liquid-animation";
import type { GameState as JsGameStateFromTypes, Movement, AnimationState } from "@/lib/types"; // Renamed to avoid conflict
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

// Define the structure Rust expects for game_state_js (matches JsGameState in Rust)
interface RustSolverInput {
  bottles: number[][];
}


export default function Home() {
  // Use the type from lib/types for UI state
  const [gameState, setGameState] = useState<JsGameStateFromTypes>(initialGameState);
  const [selectedBottle, setSelectedBottle] = useState<number | null>(null);
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<Movement[]>([]);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // These now drive the game dimensions
  const [numBottles, setNumBottles] = useState(7);
  const [numColors, setNumColors] = useState(5); // Ensure generateRandomState handles this
  const [bottleHeight, setBottleHeight] = useState(9);

  const [activeTab, setActiveTab] = useState("game");
  const [animation, setAnimation] = useState<AnimationState | null>(null);
  const bottleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { toast } = useToast();
  const [wasmReady, setWasmReady] = useState(false);

  // Re-initialize game when dimensions change from settings
  useEffect(() => {
    // This effect will run when numBottles, numColors, or bottleHeight changes
    // after being set by applySettings.
    // We call resetGame to generate a new state with these dimensions.
    // initialGameState is static, so we need to generate a new one.
    resetGameLogic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numBottles, numColors, bottleHeight]); // Add dependencies


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
  }, []);

  useEffect(() => {
    bottleRefs.current = bottleRefs.current.slice(0, gameState.bottles.length);
  }, [gameState.bottles.length]);

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
    const fromTopLiquidIndex = fromBottle.findIndex(c => c !== 0);

    if (fromTopLiquidIndex !== -1) { // Proceed only if source is not empty
        for (let i = fromTopLiquidIndex; i < fromBottle.length && removedSoFar < amount; i++) {
            if (fromBottle[i] === colorToMove) {
                fromBottle[i] = 0; // Set the slot to empty
                removedSoFar++;
            } else {
                break;
            }
        }
    }
    // Compact source bottle: Non-zero elements pushed to the end (bottom), zeros at the start (top)
    const compactedFrom = fromBottle.filter(c => c !== 0);
    const finalFrom = Array(bottleHeight - compactedFrom.length).fill(0).concat(compactedFrom);
    state.bottles[fromIndex] = finalFrom;


    const toBottle = [...toBottleOriginal];
    const existingLiquids = toBottle.filter(c => c !== 0);
    const newLiquids = Array(amount).fill(colorToMove);

    const combinedLiquids = [...newLiquids, ...existingLiquids];

    const finalTo = Array(bottleHeight - combinedLiquids.length).fill(0).concat(combinedLiquids);
    state.bottles[toIndex] = finalTo;
  };

  const handleBottleClick = (bottleIndex: number) => {
    if (solving || animation) return;
    if (selectedBottle === null) {
      if (gameState.bottles[bottleIndex].some(c => c !== 0)) {
          setSelectedBottle(bottleIndex);
      }
    } else if (selectedBottle === bottleIndex) {
      setSelectedBottle(null);
    } else {
      const fromBottleArray = gameState.bottles[selectedBottle];
      const toBottleArray = gameState.bottles[bottleIndex];
      const amount = calculateMoveAmount(fromBottleArray, toBottleArray);

      if (amount > 0 && isValidMove(fromBottleArray, toBottleArray)) {
        const fromTopColorIndex = fromBottleArray.findIndex(c => c !== 0);
        const colorToMove = fromTopColorIndex !== -1 ? fromBottleArray[fromTopColorIndex] : 0;
        if (colorToMove !== 0) {
          startAnimation(selectedBottle, bottleIndex, colorToMove, amount);
        } else {
          setSelectedBottle(null);
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

  const startAnimation = (
    fromIndex: number,
    toIndex: number,
    color: number,
    amount: number,
  ) => {
    const fromBottleRef = bottleRefs.current[fromIndex];
    const toBottleRef = bottleRefs.current[toIndex];
    if (fromBottleRef && toBottleRef) {
      const fromRect = fromBottleRef.getBoundingClientRect();
      const toRect = toBottleRef.getBoundingClientRect();
      const fromLiquidCount = gameState.bottles[fromIndex].filter(c => c !== 0).length;
      const toLiquidCount = gameState.bottles[toIndex].filter(c => c !== 0).length;
      const segmentHeight = fromRect.height / bottleHeight;

      const fromY = fromRect.bottom - fromRect.top - fromLiquidCount * segmentHeight + segmentHeight / 2;
      const toY = toRect.bottom - toRect.top - toLiquidCount * segmentHeight + segmentHeight / 2;

      console.log(fromRect);
      console.log(toRect);

      setAnimation({
        fromX: fromRect.left + fromRect.width,
        fromY, toX: toRect.left + toRect.width, toY,
        color, amount, fromIndex, toIndex,
        onComplete: () => {
          const newGameState = { ...gameState, bottles: gameState.bottles.map(b => [...b]) };
          moveLiquid(newGameState, fromIndex, toIndex, amount, color);
          setGameState(newGameState);
          setSelectedBottle(null);
          setAnimation(null);
          if (isGameSolved(newGameState)) celebrateWin();
        },
      });
    } else {
      const newGameState = { ...gameState, bottles: gameState.bottles.map(b => [...b]) };
      moveLiquid(newGameState, fromIndex, toIndex, amount, color);
      setGameState(newGameState);
      setSelectedBottle(null);
      if (isGameSolved(newGameState)) celebrateWin();
    }
  };

  const isValidMove = (fromBottle: number[], toBottle: number[]) => {
    const fromTopColorIndex = fromBottle.findIndex(c => c !== 0);
    if (fromTopColorIndex === -1) return false;
    const fromTopColor = fromBottle[fromTopColorIndex];
    const toFilledHeight = toBottle.filter(c => c !== 0).length;
    if (toFilledHeight >= bottleHeight) return false;
    if (toFilledHeight === 0) return true;
    const toTopColorIndex = toBottle.findIndex(c => c !== 0);
    const toTopColor = toBottle[toTopColorIndex];
    return fromTopColor === toTopColor;
  };

  const calculateMoveAmount = (fromBottle: number[], toBottle: number[]) => {
    if (!isValidMove(fromBottle, toBottle)) return 0;
    const fromTopColorIndex = fromBottle.findIndex(c => c !== 0);
    const fromTopColor = fromBottle[fromTopColorIndex];
    let colorCount = 0;
    for (let i = fromTopColorIndex; i < bottleHeight; i++) {
      if (fromBottle[i] === fromTopColor) colorCount++;
      else if (fromBottle[i] !== 0) break;
    }
    const toFilledHeight = toBottle.filter(c => c !== 0).length;
    const emptySpaces = bottleHeight - toFilledHeight;
    return Math.min(colorCount, emptySpaces);
  };

  const resetGameLogic = () => {
    if (animation) return;
    // Use current numBottles, numColors, bottleHeight from state
    const newState = generateRandomState(numBottles, numColors, bottleHeight);
    setGameState(newState);
    setSelectedBottle(null);
    setSolution([]);
    setSolutionIndex(0);
    setSolving(false);
    setError(null);
  }

  const resetGame = () => {
    resetGameLogic(); // Call the logic part
    toast({
      title: "Game Reset",
      description: "A new random puzzle has been generated.",
    });
  };

  const handleSolve = async () => {
    if (animation || !wasmReady) {
      if (!wasmReady) toast({ title: "Solver Not Ready", description: "Please wait.", variant: "destructive" });
      return;
    }
    try {
      setSolving(true);
      setError(null);
      toast({ title: "Finding Solution (Rust Wasm)", description: "Calculating..." });

      // Ensure gameState.bottles are arrays of `bottleHeight`
      const validatedBottles = gameState.bottles.map(bottle => {
          const b = [...bottle]; // Create a copy
          while(b.length < bottleHeight) b.unshift(0); // Pad with 0s at the start if too short
          return b.slice(0, bottleHeight); // Ensure it's not too long
      });


      const solverInput: RustSolverInput = { bottles: validatedBottles };

      // Pass current game dimensions to the Wasm solver
      const result: Movement[] = solveWasm(bottleHeight, numBottles, solverInput);

      if (result && result.length === 0) {
        toast({ title: "No Solution Found", description: "This puzzle may be unsolvable.", variant: "destructive" });
        setSolution([]);
      } else if (result) {
        setSolution(result);
        setSolutionIndex(0);
        toast({ title: "Solution Found!", description: `Found solution in ${result.length} moves.` });
      } else {
        throw new Error("Solver returned an unexpected result.");
      }
    } catch (err: any) {
      console.error("Rust Wasm Solver error:", err);
      const errorMessage = err.message || "Failed to solve the game using Rust Wasm.";
      setError(errorMessage);
      toast({ title: "Rust Wasm Solver Error", description: errorMessage, variant: "destructive" });
      setSolution([]);
    } finally {
      setSolving(false);
    }
  };

  const applyNextSolutionStep = () => {
    if (solution.length === 0 || solutionIndex >= solution.length || animation) return;
    const move = solution[solutionIndex];
    const fromBottleArray = gameState.bottles[move.from];
    const fromTopColorIndex = fromBottleArray.findIndex(c => c !== 0);
    if (fromTopColorIndex === -1) {
      toast({ title: "Solution Step Error", description: "Source bottle empty.", variant: "destructive" });
      return;
    }
    const colorToMove = fromBottleArray[fromTopColorIndex];
    startAnimation(move.from, move.to, colorToMove, move.amount);
    setSolutionIndex(solutionIndex + 1);
    if (solutionIndex === solution.length - 1) {
      toast({ title: "Solution Complete", description: "Puzzle solved!" });
    }
  };

  const isGameSolved = (state = gameState) => {
    return state.bottles.every((bottle) => {
      const filledLevels = bottle.filter(c => c !== 0);
      if (filledLevels.length === 0) return true;
      const firstColor = filledLevels[0];
      return filledLevels.every(color => color === firstColor);
    });
  };

  const applySettings = (bottles: number, colors: number, height: number) => {
    if (animation) return;
    setNumBottles(bottles);
    setNumColors(colors); // This will trigger the useEffect for resetGameLogic
    setBottleHeight(height); // This will trigger the useEffect for resetGameLogic
    // resetGameLogic will be called by the useEffect due to state change
    setActiveTab("game");
    toast({
      title: "Settings Applied",
      description: `Game configured: ${bottles} bottles, ${colors} colors, ${height} levels.`,
    });
  };

  const celebrateWin = () => {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, zIndex: 10000 });
    toast({ title: "Congratulations!", description: "You solved the puzzle!", duration: 5000 });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 bg-gradient-to-b from-purple-50 to-blue-50">
      <div className="z-10 w-full max-w-5xl flex flex-col items-center justify-center gap-8">
        <div className="w-full flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-4xl font-bold text-center text-gray-800 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
            Bottle Swap Game
          </h1>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto mt-4 md:mt-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="game">Game</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </Tabs>
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
            <Card className="w-full p-6 bg-white shadow-xl rounded-xl border-0 overflow-hidden backdrop-blur-sm bg-white/90">
              <div className="flex flex-wrap justify-center gap-4 mb-6 relative min-h-[200px]">
                {gameState.bottles.map((bottleColors, index) => (
                  <Bottle
                    key={`${numBottles}-${bottleHeight}-${index}`} // More robust key for re-renders
                    colors={bottleColors}
                    selected={selectedBottle === index}
                    onClick={() => handleBottleClick(index)}
                    bottleIndex={index}
                    ref={(el) => (bottleRefs.current[index] = el)}
                    height={bottleHeight}
                  />
                ))}
                {animation && <LiquidAnimation animation={animation} />}
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
                disabled={!!animation || !wasmReady}
              />
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <Card className="w-full p-6 bg-white shadow-xl rounded-xl border-0">
              <GameSettings
                initialBottles={numBottles}
                initialColors={numColors}
                initialHeight={bottleHeight}
                onApply={applySettings}
                disabled={!!animation}
              />
            </Card>
          </TabsContent>
        </Tabs>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <p>Solver status: {wasmReady ? "Rust Wasm Loaded" : "Loading solver..."}</p>
        </div>
        <footer className="w-full flex justify-center mt-8">
          <div className="text-center text-gray-500 text-sm">
            <p>Bottle Swap Game &copy; {new Date().getFullYear()}</p>
            <p className="mt-1">A puzzle game implemented with Next.js and Rust (Wasm) solver</p>
          </div>
        </footer>
      </div>
      <Toaster />
    </main>
  );
}

