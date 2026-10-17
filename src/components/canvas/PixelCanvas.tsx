"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  PAPER,
  paletteIndexFromByte,
} from "@/shared/palette";

export type CanvasTool = "move" | "draw";

interface Props {
  pixels: Uint8Array;
  draft: ReadonlyMap<number, number>;
  color: number;
  tool: CanvasTool;
  onPaint: (id: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onInspect: (id: number | null) => void;
}

interface View {
  scale: number;
  tx: number;
  ty: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
  moved: boolean;
  painting: boolean;
  lastId: number | null;
}

const MIN_SCALE = 0.12;
const MAX_SCALE = 40;

const PAPER_RGB = hexToRgb(PAPER);
const PALETTE_RGB = PALETTE.map(hexToRgb);

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitView(size: { w: number; h: number }): View | null {
  if (size.w < 10 || size.h < 10) return null;
  const scale = Math.max(
    MIN_SCALE,
    Math.min((size.w - 16) / CANVAS_WIDTH, (size.h - 16) / CANVAS_HEIGHT),
  );
  return {
    scale,
    tx: (size.w - CANVAS_WIDTH * scale) / 2,
    ty: (size.h - CANVAS_HEIGHT * scale) / 2,
  };
}

function clamped(view: View, size: { w: number; h: number }): View {
  const board = CANVAS_WIDTH * view.scale;
  const margin = Math.min(50, size.w * 0.25, size.h * 0.25);
  return {
    ...view,
    tx: clamp(view.tx, margin - board, size.w - margin),
    ty: clamp(view.ty, margin - board, size.h - margin),
  };
}

export function PixelCanvas({
  pixels,
  draft,
  color,
  tool,
  onPaint,
  onStrokeStart,
  onStrokeEnd,
  onInspect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
    view: View;
  } | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewState, setViewState] = useState<View | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const fit = useMemo(() => fitView(size), [size]);
  const view = useMemo(() => {
    if (!fit) return null;
    if (!viewState) return fit;
    if (viewState.scale < fit.scale) return fit;
    return clamped(viewState, size);
  }, [fit, size, viewState]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(size.w * dpr));
    canvas.height = Math.max(1, Math.round(size.h * dpr));
  }, [size]);

  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = CANVAS_WIDTH;
    base.height = CANVAS_HEIGHT;
    const ctx = base.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
      const data = image.data;
      for (let id = 0; id < CANVAS_WIDTH * CANVAS_HEIGHT; id++) {
        const byte = pixels[id] ?? 0;
        const paletteIndex = paletteIndexFromByte(byte);
        const [r, g, b] = paletteIndex === null ? PAPER_RGB : PALETTE_RGB[paletteIndex];
        const offset = id * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }
    baseRef.current = base;
  }, [pixels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base || !view || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = canvas.width / size.w;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const board = CANVAS_WIDTH * view.scale;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(view.tx + 4, view.ty + 4, board, board);

    ctx.save();
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);
    ctx.drawImage(base, 0, 0);

    ctx.globalAlpha = 0.72;
    for (const [id, paletteIndex] of draft) {
      ctx.fillStyle = PALETTE[paletteIndex] ?? PAPER;
      ctx.fillRect(id % CANVAS_WIDTH, Math.floor(id / CANVAS_WIDTH), 1, 1);
    }
    ctx.globalAlpha = 1;

    if (hoverId !== null) {
      const x = hoverId % CANVAS_WIDTH;
      const y = Math.floor(hoverId / CANVAS_WIDTH);
      ctx.lineWidth = 1 / view.scale;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeRect(x, y, 1, 1);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(x - 1 / view.scale, y - 1 / view.scale, 1 + 2 / view.scale, 1 + 2 / view.scale);
    }

    if (tool === "draw" && hoverId !== null) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = PALETTE[color] ?? PAPER;
      ctx.fillRect(hoverId % CANVAS_WIDTH, Math.floor(hoverId / CANVAS_WIDTH), 1, 1);
      ctx.globalAlpha = 1;
    }

    if (view.scale >= 8) {
      const startX = Math.max(0, Math.floor(-view.tx / view.scale));
      const endX = Math.min(CANVAS_WIDTH, Math.ceil((size.w - view.tx) / view.scale));
      const startY = Math.max(0, Math.floor(-view.ty / view.scale));
      const endY = Math.min(CANVAS_HEIGHT, Math.ceil((size.h - view.ty) / view.scale));
      ctx.beginPath();
      for (let x = startX; x <= endX; x++) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y++) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.strokeStyle = "rgba(24,20,37,0.20)";
      ctx.lineWidth = 1 / view.scale;
      ctx.stroke();
    }

    ctx.restore();
    ctx.strokeStyle = "rgba(24,20,37,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(view.tx - 1, view.ty - 1, board + 2, board + 2);
  }, [color, draft, hoverId, pixels, size, tool, view]);

  const toPixel = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas || !view) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((clientX - rect.left - view.tx) / view.scale);
      const y = Math.floor((clientY - rect.top - view.ty) / view.scale);
      if (x < 0 || y < 0 || x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) return null;
      return y * CANVAS_WIDTH + x;
    },
    [view],
  );

  const inspect = useCallback(
    (id: number | null) => {
      setHoverId(id);
      onInspect(id);
    },
    [onInspect],
  );

  const paintAt = useCallback(
    (id: number | null) => {
      const drag = dragRef.current;
      if (!drag || id === null || drag.lastId === id) return;
      drag.lastId = id;
      setHoverId(id);
      onPaint(id);
    },
    [onPaint],
  );

  const paintLine = useCallback(
    (from: number, to: number) => {
      const x0 = from % CANVAS_WIDTH;
      const y0 = Math.floor(from / CANVAS_WIDTH);
      const x1 = to % CANVAS_WIDTH;
      const y1 = Math.floor(to / CANVAS_WIDTH);
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      if (steps === 0) return;
      const limit = Math.min(steps, 512);
      for (let i = 1; i <= limit; i++) {
        const t = i / steps;
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        paintAt(y * CANVAS_WIDTH + x);
      }
    },
    [paintAt],
  );

  const zoomAt = useCallback(
    (anchorX: number, anchorY: number, factor: number) => {
      if (!view || !fit) return;
      const nextScale = clamp(view.scale * factor, fit.scale, MAX_SCALE);
      if (nextScale === view.scale) return;
      const ratio = nextScale / view.scale;
      setViewState(
        clamped(
          {
            scale: nextScale,
            tx: anchorX - (anchorX - view.tx) * ratio,
            ty: anchorY - (anchorY - view.ty) * ratio,
          },
          size,
        ),
      );
    },
    [fit, size, view],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        Math.exp(-event.deltaY * 0.0018),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [view, zoomAt]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!view) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });

    if (pointersRef.current.size === 2) {
      const drag = dragRef.current;
      if (drag?.painting) onStrokeEnd();
      dragRef.current = null;
      const points = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        centerX: (points[0].x + points[1].x) / 2,
        centerY: (points[0].y + points[1].y) / 2,
        view,
      };
      return;
    }

    const painting = tool === "draw" || (event.pointerType === "mouse" && event.shiftKey);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      startTx: view.tx,
      startTy: view.ty,
      moved: false,
      painting,
      lastId: null,
    };
    if (painting) {
      onStrokeStart();
      paintAt(toPixel(event.clientX, event.clientY));
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current && fit) {
      const points = Array.from(pointersRef.current.values());
      const distance = Math.max(
        1,
        Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      );
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      const start = pinchRef.current;
      const nextScale = clamp(
        start.view.scale * (distance / start.distance),
        fit.scale,
        MAX_SCALE,
      );
      const ratio = nextScale / start.view.scale;
      setViewState(
        clamped(
          {
            scale: nextScale,
            tx: centerX - (start.centerX - start.view.tx) * ratio,
            ty: centerY - (start.centerY - start.view.ty) * ratio,
          },
          size,
        ),
      );
      return;
    }

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId && view) {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;

      if (drag.painting) {
        const id = toPixel(event.clientX, event.clientY);
        if (id !== null) {
          if (drag.lastId === null) paintAt(id);
          else paintLine(drag.lastId, id);
        }
        return;
      }

      if (drag.moved) {
        setViewState(
          clamped(
            { scale: view.scale, tx: drag.startTx + dx, ty: drag.startTy + dy },
            size,
          ),
        );
        return;
      }
    }

    const id = toPixel(event.clientX, event.clientY);
    if (id !== hoverId) {
      setHoverId(id);
      onInspect(id);
    }
  }

  function finishPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // already released
    }

    const wasSingle = pointersRef.current.size === 1;
    const drag = dragRef.current;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (drag && drag.pointerId === event.pointerId) {
      if (drag.painting) {
        onStrokeEnd();
      } else if (wasSingle && !drag.moved && event.type === "pointerup") {
        const id = toPixel(event.clientX, event.clientY);
        if (id !== null) {
          onStrokeStart();
          onPaint(id);
          inspect(id);
          onStrokeEnd();
        }
      }
      dragRef.current = null;
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-board">
      <canvas
        ref={canvasRef}
        className="pixel-canvas absolute inset-0 h-full w-full"
        style={{ cursor: tool === "draw" ? "crosshair" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={() => {
          if (!dragRef.current) inspect(null);
        }}
        onContextMenu={(event) => event.preventDefault()}
        role="img"
        aria-label="PixelFun 512 by 512 collaborative pixel canvas"
      />

      {view && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.5)}
            className="pixel-btn h-7 w-7 bg-panel/90 text-sm"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[44px] border-2 border-ink bg-panel/90 px-1 py-1 text-center font-mono text-[10px]">
            {view.scale >= 10 ? view.scale.toFixed(0) : view.scale.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={() => zoomAt(size.w / 2, size.h / 2, 1.5)}
            className="pixel-btn h-7 w-7 bg-panel/90 text-sm"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setViewState(null)}
            className="pixel-btn h-7 bg-panel/90 px-2 text-[10px] font-bold"
            aria-label="Fit to screen"
          >
            FIT
          </button>
        </div>
      )}
    </div>
  );
}
