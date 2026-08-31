"use client";

import React from "react";
import { motion, useSpring } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImageItem {
  src: string;
  alt: string;
}

interface PhoneCarouselProps {
  images: ImageItem[];
  /** ms between auto-advances; set 0 to disable autoplay */
  autoPlayInterval?: number;
}

function StatusBar({ dark }: { dark: boolean }) {
  const fg = dark ? "#fff" : "#334155";
  return (
    <div className="flex items-center justify-between px-6 pt-3 text-[13px] font-semibold" style={{ color: fg }}>
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Pause className="h-3 w-3" fill={fg} stroke="none" />
        {/* wifi */}
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill={fg}>
          <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM8 5c1.9 0 3.6.7 4.9 1.9l-1.4 1.4A5 5 0 008 7c-1.3 0-2.5.5-3.5 1.3L3.1 6.9A6.9 6.9 0 018 5zm0-4c3 0 5.7 1.2 7.7 3.1l-1.4 1.4A8.9 8.9 0 008 3 8.9 8.9 0 001.7 5.5L.3 4.1C2.3 2.2 5 1 8 1z" />
        </svg>
        {/* battery */}
        <svg viewBox="0 0 25 12" className="h-3 w-6" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={fg} opacity="0.4" />
          <rect x="2" y="2" width="13" height="8" rx="1.5" fill={fg} />
          <path d="M23.5 4v4a2 2 0 000-4z" fill={fg} opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

function PhoneFrame({ image, active }: { image: ImageItem; active: boolean }) {
  return (
    <div
      className={
        "relative overflow-hidden rounded-[44px] border shadow-2xl " +
        (active ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-white")
      }
      style={{ width: 280, aspectRatio: "9/19" }}
    >
      <StatusBar dark={active} />
      {/* Dynamic island */}
      <div className="absolute left-1/2 top-2.5 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
      <img
        src={image.src}
        alt={image.alt}
        className="absolute inset-0 top-10 h-[calc(100%-2.5rem)] w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

/** One persistent phone that glides between slot positions; tilt engages while centered. */
function PhoneSlot({ image, offset }: { image: ImageItem; offset: number }) {
  const active = offset === 0;
  const ref = React.useRef<HTMLDivElement>(null);
  const springCfg = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateY = useSpring(0, springCfg);
  const rotateX = useSpring(0, springCfg);

  React.useEffect(() => {
    if (!active) {
      rotateY.set(0);
      rotateX.set(0);
    }
  }, [active, rotateX, rotateY]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 28);
    rotateX.set((0.5 - py) * 20);
  };
  const onPointerLeave = () => {
    rotateY.set(0);
    rotateX.set(0);
  };

  const visible = Math.abs(offset) <= 1;

  return (
    <motion.div
      className="absolute"
      initial={false}
      animate={{
        x: offset * 260,
        scale: active ? 1 : visible ? 0.82 : 0.7,
        opacity: active ? 1 : visible ? 0.45 : 0,
        filter: active ? "blur(0px)" : "blur(1px)",
      }}
      style={{ zIndex: active ? 10 : visible ? 5 : 1 }}
      transition={{ type: "spring", stiffness: 130, damping: 19, mass: 0.9 }}
    >
      <div ref={ref} style={{ perspective: 1100 }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
          <PhoneFrame image={image} active={active} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Signed shortest distance from current index to image i, wrapping around. */
function wrappedOffset(i: number, index: number, count: number) {
  let d = (i - index) % count;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
}

export function PhoneCarousel({ images, autoPlayInterval = 4000 }: PhoneCarouselProps) {
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(autoPlayInterval > 0);
  const count = images.length;

  const next = React.useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = React.useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  React.useEffect(() => {
    if (!playing || count <= 1 || autoPlayInterval <= 0) return;
    const t = setInterval(next, autoPlayInterval);
    return () => clearInterval(t);
  }, [playing, next, autoPlayInterval, count]);

  if (count === 0) return null;

  return (
    <div className="relative flex w-full max-w-4xl items-center justify-center overflow-hidden py-12">
      <motion.div
        className="relative flex h-[560px] w-full cursor-grab items-center justify-center active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70 || info.velocity.x < -400) next();
          else if (info.offset.x > 70 || info.velocity.x > 400) prev();
        }}
      >
        {images.map((image, i) => (
          <PhoneSlot key={i} image={image} offset={wrappedOffset(i, index, count)} />
        ))}
      </motion.div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
        <Button variant="secondary" size="icon" className="rounded-full shadow-lg" onClick={prev} aria-label="Previous screen">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause autoplay" : "Resume autoplay"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button variant="secondary" size="icon" className="rounded-full shadow-lg" onClick={next} aria-label="Next screen">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
