/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { audioManager } from './services/AudioManager';

interface Bubble {
  id: string;
  row: number;
  col: number;
  color: string;
  isPopping?: boolean;
}

const GRID_SIZE = 9;
const COLORS = [
  '#FF3B3B', // Bright Red
  '#26DE81', // Emerald
  '#45AAF2', // Sky Blue
  '#FED330', // Bright Lemon Yellow
  '#A55EEA', // Purple
  '#FA8231', // Deep Vibrant Orange
];

const FIREWORK_COLORS = ['#FF3B3B', '#FED330', '#26DE81', '#45AAF2', '#A55EEA', '#FA8231', '#FF69B4', '#00CED1', '#ffffff'];

interface FireworkParticle { angle: number; dist: number; color: string; }
interface FireworkBurst { id: number; x: number; y: number; delay: number; particles: FireworkParticle[]; }

function hasValidMove(grid: Bubble[]): boolean {
  for (const start of grid) {
    const visited = new Set<string>([start.id]);
    const queue = [start];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const b of grid) {
        if (visited.has(b.id) || b.color !== start.color) continue;
        if (Math.abs(b.row - curr.row) <= 1 && Math.abs(b.col - curr.col) <= 1) {
          visited.add(b.id);
          queue.push(b);
        }
      }
    }
    if (visited.size >= 3) return true;
  }
  return false;
}

function ensureValidMove(grid: Bubble[]): Bubble[] {
  if (hasValidMove(grid)) return grid;
  // Force a 3-match in the center by making 3 adjacent cells the same color
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return grid.map(b => {
    if (b.row === 4 && (b.col === 3 || b.col === 4 || b.col === 5)) {
      return { ...b, color };
    }
    return b;
  });
}

export default function App() {
  const [grid, setGrid] = useState<Bubble[]>([]);
  const [activeChain, setActiveChain] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [exclamation, setExclamation] = useState<{ word: string; color: string; id: number } | null>(null);
  const [fireworkBursts, setFireworkBursts] = useState<FireworkBurst[]>([]);
  const [comboEmoji, setComboEmoji] = useState<{ face: string; id: number } | null>(null);
  const [splashFaceIdx, setSplashFaceIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [trashTalk, setTrashTalk] = useState<{ text: string; id: number } | null>(null);
  const [feverMode, setFeverMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a ref for the grid to avoid dependency issues in touch handlers
  const gridRef = useRef<Bubble[]>([]);
  const chainRef = useRef<string[]>([]);
  const draggingRef = useRef(false);
  const wordQueueRef = useRef<string[]>([]);
  const consecutiveChainRef = useRef(0);
  const lastChainTimeRef = useRef(0);
  const feverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fartTriggeredRef = useRef(false);
  const [fartSpin, setFartSpin] = useState(false);
  const [fartRotation, setFartRotation] = useState(0);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    chainRef.current = activeChain;
  }, [activeChain]);

  const SPLASH_FACES  = ['😜', '🤪', '🥳', '😝', '🤩', '👾', '🤠', '😎'];
  const COMBO_FACES   = ['🤯', '🥳', '😱', '🤩', '🎉'];
  const TRASH_TALK    = [
    'IS THAT ALL YOU GOT?',
    'MY GRANDMA POPS FASTER!',
    'GETTING SLEEPY?',
    'MY FISH CAN DO BETTER!',
    'YAWN... BORING!',
    'WAKE UP!!!',
    'YOU CALL THAT POPPING?',
    'NICE TRY THOUGH!',
  ];

  useEffect(() => {
    if (hasStarted) return;
    const id = setInterval(() => setSplashFaceIdx(i => (i + 1) % SPLASH_FACES.length), 1800);
    return () => clearInterval(id);
  }, [hasStarted]);

  // Initialize Grid — regenerate until at least one 3-match exists
  const initGrid = useCallback(() => {
    let newBubbles: Bubble[];
    do {
      newBubbles = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          newBubbles.push({
            id: `${r}-${c}-${Math.random()}`,
            row: r,
            col: c,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
          });
        }
      }
    } while (!hasValidMove(newBubbles));
    setGrid(newBubbles);
    gridRef.current = newBubbles;
    setScore(0);
    setFeverMode(false);
    consecutiveChainRef.current = 0;
    lastChainTimeRef.current = 0;
  }, []);

  useEffect(() => {
    initGrid();
  }, [initGrid]);

  const findBubbleUnderPoint = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Position within the container (0-1)
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;

    if (relX < -0.05 || relX > 1.05 || relY < -0.05 || relY > 1.05) return null;

    // Convert to grid index
    const col = Math.round(relX * (GRID_SIZE - 1));
    const row = Math.round(relY * (GRID_SIZE - 1));

    // Distance check in relative units
    const cellRelX = col / (GRID_SIZE - 1);
    const cellRelY = row / (GRID_SIZE - 1);
    const dist = Math.sqrt(Math.pow(relX - cellRelX, 2) + Math.pow(relY - cellRelY, 2));
    
    if (dist < 0.12) { // 12% radius is very forgiving
        return gridRef.current.find(b => b.row === row && b.col === col);
    }
    return null;
  }, []);

  // Use passive: false listeners for better iPad support
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasStarted) return;

    const preventDefault = (e: Event) => e.preventDefault();
    container.addEventListener('contextmenu', preventDefault);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setIsDragging(true);

      const bubble = findBubbleUnderPoint(e.touches[0].clientX, e.touches[0].clientY);
      if (bubble) {
        setActiveChain([bubble.id]);
        audioManager.playConnect(0);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;

      setMousePos({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100
      });

      if (!draggingRef.current) return;

      const bubble = findBubbleUnderPoint(clientX, clientY);
      if (!bubble) return;

      const currentChain = chainRef.current;
      
      if (currentChain.length === 0) {
        setActiveChain([bubble.id]);
        audioManager.playConnect(0);
        return;
      }

      const lastId = currentChain[currentChain.length - 1];
      const lastBubble = gridRef.current.find(b => b.id === lastId);
      
      if (!lastBubble) return;

      const isAdjacent = Math.abs(bubble.row - lastBubble.row) <= 1 && 
                         Math.abs(bubble.col - lastBubble.col) <= 1;
      const isSameColor = bubble.color === lastBubble.color;
      const isNew = !currentChain.includes(bubble.id);

      if (isAdjacent && isSameColor && isNew) {
        const newChain = [...currentChain, bubble.id];
        setActiveChain(newChain);
        audioManager.playConnect(newChain.length - 1);
        if (newChain.length >= 4) {
          audioManager.playPowerUp();
        }
      } else if (currentChain.length > 1 && bubble.id === currentChain[currentChain.length - 2]) {
        setActiveChain(prev => prev.slice(0, -1));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      draggingRef.current = false;
      handleEnd();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('contextmenu', preventDefault);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [findBubbleUnderPoint, hasStarted]);

  const handleStartInteraction = async () => {
    await audioManager.resume();
    setHasStarted(true);
  };

  const handleStart = async (e: React.MouseEvent) => {
    await audioManager.resume();
    draggingRef.current = true;
    setIsDragging(true);
    
    const bubble = findBubbleUnderPoint(e.clientX, e.clientY);
    if (bubble) {
      setActiveChain([bubble.id]);
      audioManager.playConnect(0);
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100
        });
    }

    if (!draggingRef.current) return;

    const bubble = findBubbleUnderPoint(e.clientX, e.clientY);
    if (!bubble) return;

    const currentChain = chainRef.current;

    if (currentChain.length === 0) {
        setActiveChain([bubble.id]);
        audioManager.playConnect(0);
        return;
    }

    const lastId = currentChain[currentChain.length - 1];
    const lastBubble = gridRef.current.find(b => b.id === lastId);
    
    if (!lastBubble) return;

    const isAdjacent = Math.abs(bubble.row - lastBubble.row) <= 1 && 
                       Math.abs(bubble.col - lastBubble.col) <= 1;
    const isSameColor = bubble.color === lastBubble.color;
    const isNew = !currentChain.includes(bubble.id);

    if (isAdjacent && isSameColor && isNew) {
      const newChain = [...currentChain, bubble.id];
      setActiveChain(newChain);
      audioManager.playConnect(newChain.length - 1);
      
      // Satisfying sound for 4+ connections
      if (newChain.length >= 4) {
          audioManager.playPowerUp();
      }
    } else if (currentChain.length > 1 && bubble.id === currentChain[currentChain.length - 2]) {
        setActiveChain(prev => prev.slice(0, -1));
    }
  };

  const handleRefreshDown = () => {
    fartTriggeredRef.current = false;
    longPressRef.current = setTimeout(async () => {
      fartTriggeredRef.current = true;
      audioManager.playFart();
      setFartRotation(r => r + 360);
      setFartSpin(true);
      await new Promise(r => setTimeout(r, 1100));
      setFartSpin(false);
      initGrid();
    }, 800);
  };

  const handleRefreshUp = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  const handleRefreshClick = () => {
    if (fartTriggeredRef.current) { fartTriggeredRef.current = false; return; }
    initGrid();
  };

  const EXCLAMATION_WORDS = [
    'AMAZING SPIDER KID!',
    'WOW YOU ARE GOOD!',
    'PIRATES BOOTY!',
    'LIGHTNING BOY!',
    'CRAZY COOL!',
    'EPIC TACOS!',
    'SUPER STINKY!',
    'SPICY BANANAS!',
    'TURBO PANTS!',
    'COSMIC WAFFLES!',
    'BOOM SHAKALAKA!',
    'CAPTAIN NOODLES!',
    'ROCKET MONKEY!',
    'LASER TOES!',
    'TACO THUNDER!',
    'FLYING UNDERPANTS!',
    'PICKLE EXPLOSION!',
    'SNEAKY PANCAKES!',
    'MONSTER MUFFINS!',
  ];

  const handleEnd = async () => {
    const chainToPop = [...chainRef.current];
    setActiveChain([]);
    setIsDragging(false);
    draggingRef.current = false;

    if (chainToPop.length < 3) return;

    // Tier sound + visual based on chain length
    const color = gridRef.current.find(b => b.id === chainToPop[0])?.color ?? '#ffffff';

    const launchFireworks = () => {
      const now = Date.now();
      const bursts: FireworkBurst[] = Array.from({ length: 7 }, (_, i) => ({
        id: now + i,
        x: 10 + Math.random() * 80,
        y: 5 + Math.random() * 65,
        delay: i * 0.35,
        particles: Array.from({ length: 16 }, (_, p) => ({
          angle: (p / 16) * Math.PI * 2,
          dist: 55 + Math.random() * 90,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        })),
      }));
      setFireworkBursts(bursts);
      setTimeout(() => setFireworkBursts([]), 3800);
    };

    if (chainToPop.length >= 7) {
      // Full fanfare: sound + voice + word + emoji + clapping + fireworks
      audioManager.playLegendaryPop();
      if (wordQueueRef.current.length === 0) {
        wordQueueRef.current = [...EXCLAMATION_WORDS].sort(() => Math.random() - 0.5);
      }
      const word = wordQueueRef.current.pop()!;
      audioManager.speakExclamation(word);
      setExclamation({ word, color, id: Date.now() });
      setTimeout(() => setExclamation(null), 1800);
      audioManager.playClapping();
      const face = COMBO_FACES[Math.floor(Math.random() * COMBO_FACES.length)];
      setComboEmoji({ face, id: Date.now() });
      setTimeout(() => setComboEmoji(null), 2200);
      launchFireworks();
    } else if (chainToPop.length >= 5) {
      // Fireworks only
      launchFireworks();
    }

    // 1. Pop Sequence
    for (let i = 0; i < chainToPop.length; i++) {
        audioManager.playPop(i);
        setGrid(prev => prev.map(b => b.id === chainToPop[i] ? { ...b, isPopping: true } : b));
        await new Promise(r => setTimeout(r, 60));
    }

    // 2. Reposition Vertical
    setGrid(prev => {
        const nextGrid: Bubble[] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            const colExisting = prev.filter(b => b.col === c && !chainToPop.includes(b.id))
                                   .sort((a, b) => b.row - a.row);
            
            for (let i = 0; i < colExisting.length; i++) {
                nextGrid.push({ ...colExisting[i], row: GRID_SIZE - 1 - i });
            }

            const missing = GRID_SIZE - colExisting.length;
            for (let i = 0; i < missing; i++) {
                nextGrid.push({
                    id: `new-${c}-${Date.now()}-${i}`,
                    row: missing - 1 - i,
                    col: c,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                });
            }
        }
        return ensureValidMove(nextGrid);
    });

    audioManager.playRefill();
    audioManager.playBubbleRain(chainToPop.length);

    // Score
    const points = chainToPop.length * 10;
    setScore(prev => {
      const next = prev + points;
      if (Math.floor(next / 150) > Math.floor(prev / 150)) {
        const text = TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)];
        setTrashTalk({ text, id: Date.now() });
        setTimeout(() => setTrashTalk(null), 2500);
      }
      return next;
    });

    // Fever mode — trigger after 3 quick consecutive chains
    const now = Date.now();
    if (now - lastChainTimeRef.current < 3500) {
      consecutiveChainRef.current++;
      if (consecutiveChainRef.current >= 2) {
        setFeverMode(true);
        if (feverTimeoutRef.current) clearTimeout(feverTimeoutRef.current);
        feverTimeoutRef.current = setTimeout(() => {
          setFeverMode(false);
          consecutiveChainRef.current = 0;
        }, 6000);
      }
    } else {
      consecutiveChainRef.current = 0;
    }
    lastChainTimeRef.current = now;
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden bg-slate-950 flex flex-col items-center select-none touch-none font-sans h-[100dvh]"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{
        background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)'
      }}
    >
      {/* Combo emoji reaction for 7+ chains */}
      <AnimatePresence>
        {comboEmoji && (
          <motion.div
            key={comboEmoji.id}
            initial={{ scale: 0, rotate: -20, opacity: 1 }}
            animate={{ scale: [1.5, 1.2], rotate: [10, -5, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
            className="fixed top-1/3 right-12 z-50 pointer-events-none text-8xl"
          >
            {comboEmoji.face}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fireworks for 7+ chains */}
      {fireworkBursts.map(burst => (
        <div
          key={burst.id}
          className="fixed pointer-events-none z-40"
          style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
        >
          {burst.particles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, scale: 1.8, opacity: 1 }}
              animate={{
                x: Math.cos(p.angle) * p.dist,
                y: Math.sin(p.angle) * p.dist + 60,
                scale: 0,
                opacity: 0,
              }}
              transition={{ duration: 1.5, delay: burst.delay, ease: [0.2, 0.8, 0.3, 1] }}
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}, 0 0 16px ${p.color}` }}
            />
          ))}
        </div>
      ))}

      {/* Exclamation popup for 6+ chains */}
      <AnimatePresence>
        {exclamation && (
          <motion.div
            key={exclamation.id}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [1.3, 1.0], opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <span
              className="text-white font-black text-6xl tracking-widest uppercase select-none"
              style={{ textShadow: `0 0 60px ${exclamation.color}, 0 0 120px ${exclamation.color}` }}
            >
              {exclamation.word}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {!hasStarted && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center"
                onClick={handleStartInteraction}
                onTouchStart={(e) => { e.preventDefault(); handleStartInteraction(); }}
              >
                  <motion.div
                    animate={{ scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 border border-white/20"
                  >
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={splashFaceIdx}
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 30 }}
                        transition={{ duration: 0.3, ease: 'backOut' }}
                        className="text-6xl select-none"
                      >
                        {SPLASH_FACES[splashFaceIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                  <h1 className="text-white text-3xl font-black tracking-tighter mb-4">Bubble Buster</h1>
                  <p className="text-white/40 text-sm max-w-xs mx-auto mb-12">
                      Tap anywhere to start connecting bubbles and making music!
                  </p>
                  <div className="bg-white text-slate-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs">
                      Tap to Start
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* Fever mode glow */}
      <AnimatePresence>
        {feverMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3], background: [
              'radial-gradient(ellipse at 50% 50%, #ff3b3b44 0%, transparent 70%)',
              'radial-gradient(ellipse at 50% 50%, #a55eea44 0%, transparent 70%)',
              'radial-gradient(ellipse at 50% 50%, #45aaf244 0%, transparent 70%)',
              'radial-gradient(ellipse at 50% 50%, #fed33044 0%, transparent 70%)',
              'radial-gradient(ellipse at 50% 50%, #ff3b3b44 0%, transparent 70%)',
            ]}}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="fixed inset-0 pointer-events-none z-10"
          />
        )}
      </AnimatePresence>

      {/* Fever label */}
      <AnimatePresence>
        {feverMode && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-30 flex justify-center pt-2 pointer-events-none"
          >
            <span className="text-2xl font-black tracking-widest text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.8)]">🔥 FEVER MODE 🔥</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trash talk popup */}
      <AnimatePresence>
        {trashTalk && (
          <motion.div
            key={trashTalk.id}
            initial={{ y: 40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
            className="fixed bottom-28 left-0 right-0 z-50 flex justify-center pointer-events-none"
          >
            <span className="text-white/90 font-black text-2xl tracking-wide uppercase bg-black/40 px-6 py-3 rounded-2xl backdrop-blur-sm">
              {trashTalk.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header HUD */}
      <div className="absolute top-10 left-0 right-0 z-20 flex justify-between px-10 items-center">
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
          <Sparkles className="w-7 h-7 text-yellow-400 animate-pulse" />
          <span className="text-white font-bold tracking-widest uppercase text-2xl">Bubble Buster</span>
        </div>
        <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/10 shadow-2xl text-center">
          <div className="text-white/50 text-xs uppercase tracking-widest">Score</div>
          <div className="text-white font-black text-2xl">{score.toLocaleString()}</div>
        </div>
        <button
          onClick={handleRefreshClick}
          onPointerDown={handleRefreshDown}
          onPointerUp={handleRefreshUp}
          onPointerLeave={handleRefreshUp}
          className="p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 text-white hover:bg-white/10 transition-all active:scale-90 select-none"
        >
          <RefreshCw className="w-5 h-5 opacity-50" />
        </button>
      </div>

      <div className="relative w-[90%] max-w-2xl aspect-square mt-28 bg-white/5 rounded-[40px] border border-white/5 shadow-inner">
          {/* Grid Area - This is what we track */}
          <div className="absolute inset-10" ref={containerRef}>
              {/* Connection Lines (SVG) */}
              <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-visible">
                {activeChain.length > 1 && activeChain.map((id, i) => {
                  if (i === 0) return null;
                  const b1 = grid.find(b => b.id === activeChain[i-1]);
                  const b2 = grid.find(b => b.id === id);
                  if (!b1 || !b2) return null;
                  
                  const step = 100 / (GRID_SIZE - 1);
                  return (
                    <motion.line
                      key={`${b1.id}-${b2.id}`}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      x1={`${b1.col * step}%`}
                      y1={`${b1.row * step}%`}
                      x2={`${b2.col * step}%`}
                      y2={`${b2.row * step}%`}
                      stroke="white"
                      strokeWidth="12"
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_20px_rgba(255,255,255,1)]"
                    />
                  );
                })}
                
                {/* Future line pointer */}
                {isDragging && activeChain.length > 0 && (() => {
                    const last = grid.find(b => b.id === activeChain[activeChain.length-1]);
                    if (!last) return null;
                    const step = 100 / (GRID_SIZE - 1);
                    return (
                        <line 
                            x1={`${last.col * step}%`}
                            y1={`${last.row * step}%`}
                            x2={`${mousePos.x}%`}
                            y2={`${mousePos.y}%`}
                            stroke="white"
                            strokeWidth="4"
                            strokeDasharray="12 12"
                            className="opacity-40"
                        />
                    );
                })()}
                {/* Visual Touch Indicator */}
                {isDragging && (
                    <circle 
                        cx={`${mousePos.x}%`}
                        cy={`${mousePos.y}%`}
                        r="15"
                        fill="white"
                        className="opacity-10"
                    />
                )}
              </svg>

              {/* Bubbles Container */}
              <div className="absolute inset-0 w-full h-full">
                <AnimatePresence>
                    {grid.map((bubble) => {
                        const isActive = activeChain.includes(bubble.id);
                        const step = 100 / (GRID_SIZE - 1);
                        
                        return (
                            <motion.div
                                key={bubble.id}
                                initial={bubble.id.startsWith('new-') ? { top: '-25%', opacity: 0, scale: 0.8 } : { scale: 0 }}
                                animate={{
                                    scale: bubble.isPopping ? 2.5 : (isActive ? 1.2 : feverMode ? 1.08 : 1),
                                    opacity: bubble.isPopping ? 0 : 1,
                                    left: `${bubble.col * step}%`,
                                    top: `${bubble.row * step}%`,
                                    rotate: fartRotation,
                                }}
                                whileHover={!isDragging && !isActive && !bubble.isPopping ? {
                                    rotate: [0, -10, 10, -10, 0],
                                    transition: { duration: 0.4, repeat: Infinity, repeatDelay: 0.2 }
                                } : {}}
                                exit={{ scale: 0 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 600,
                                    damping: 35,
                                    scale: { duration: 0.1 },
                                    rotate: { type: 'tween', duration: 0.9, ease: 'easeInOut' },
                                }}
                                className="absolute w-[10%] aspect-square rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                                style={{
                                    backgroundColor: bubble.color,
                                    boxShadow: isActive 
                                        ? `0 0 60px ${bubble.color}, inset 0 0 25px white, inset 0 8px 10px rgba(255,255,255,0.5)` 
                                        : `inset -6px -6px 12px rgba(0,0,0,0.5), inset 6px 6px 12px rgba(255,255,255,0.4), 0 10px 20px rgba(0,0,0,0.3)`,
                                    border: isActive ? '4px solid white' : '1px solid rgba(255,255,255,0.2)'
                                }}
                            >
                                <div className="absolute top-[10%] left-[10%] w-1/3 h-1/3 bg-white/50 rounded-full blur-[2px]" />
                                <div className="absolute bottom-[10%] right-[10%] w-1/4 h-1/4 bg-black/20 rounded-full blur-[4px]" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
              </div>
          </div>
      </div>

      {/* Instructions */}
      <div className="mt-auto mb-16 text-center">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mb-2">
              Chain Reaction
          </p>
          <p className="text-white/20 text-[9px] uppercase tracking-[0.2em]">
              Match 3+ Adjacent Colors
          </p>
      </div>
    </div>
  );
}

