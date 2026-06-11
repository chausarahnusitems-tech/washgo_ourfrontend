"use client";

import { useLayoutEffect, useRef, useState } from "react";

const DEFAULT_SNAPS = [0.9, 0.5, 0.2];
const SNAP_TRANSITION = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Mobile bottom sheet that the user can drag vertically. On release it soft-snaps
 * to the nearest of `snapPoints` (fractions of the sheet's parent height, e.g.
 * 0.9 / 0.5 / 0.2), biased by the drag velocity so a quick flick carries through.
 *
 * Only the `handle` region (grabber + whatever is passed) initiates a drag, so the
 * search field and scrollable list inside `children` stay fully interactive.
 */
export function BottomSheet({
  snapPoints = DEFAULT_SNAPS,
  initialSnapIndex = 1,
  handle = null,
  handleLabel = "Resize sheet",
  className = "",
  children
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const [, forceMeasure] = useState(0);
  const [snapIndex, setSnapIndex] = useState(initialSnapIndex);
  const [dragOffset, setDragOffset] = useState(null);

  // Largest snap defines the sheet's own height; smaller snaps are reached by
  // translating it down. Derived from the rendered height so it needs no viewport math.
  const maxFraction = Math.max(...snapPoints);

  const offsetForFraction = (fraction) => {
    const height = sheetRef.current?.offsetHeight ?? 0;
    return (1 - fraction / maxFraction) * height;
  };

  const minOffset = 0; // fully open (maxFraction visible)
  const maxOffset = offsetForFraction(Math.min(...snapPoints));
  const restingOffset = offsetForFraction(snapPoints[snapIndex]);

  // Measure once mounted so the initial snap renders at the right spot (no flash).
  useLayoutEffect(() => {
    forceMeasure((n) => n + 1);
  }, []);

  const dragging = dragOffset != null;
  const translateY = dragging ? dragOffset : restingOffset;

  const onPointerDown = (event) => {
    dragRef.current = {
      startY: event.clientY,
      baseOffset: restingOffset,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0
    };
    setDragOffset(restingOffset);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clamp(drag.baseOffset + (event.clientY - drag.startY), minOffset, maxOffset);
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt; // px per ms, +down
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    setDragOffset(next);
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // Project the resting position a short moment into the future so a flick snaps
    // further than where the finger lifted, then pick the closest snap point.
    const projected = clamp(dragOffset + drag.velocity * 90, minOffset, maxOffset);
    let nearest = 0;
    let best = Infinity;
    snapPoints.forEach((fraction, index) => {
      const distance = Math.abs(offsetForFraction(fraction) - projected);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    dragRef.current = null;
    setSnapIndex(nearest);
    setDragOffset(null);
  };

  // Keyboard support for non-pointer users: arrows move between snap points.
  // snapPoints are ordered largest-first, so index 0 is the most-open state.
  const onKeyDown = (event) => {
    let next = snapIndex;
    if (event.key === "ArrowUp") next = snapIndex - 1;
    else if (event.key === "ArrowDown") next = snapIndex + 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = snapPoints.length - 1;
    else return;
    event.preventDefault();
    setSnapIndex(clamp(next, 0, snapPoints.length - 1));
  };

  return (
    <div
      ref={sheetRef}
      className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-[22px] bg-white shadow-device ${className}`}
      style={{
        height: `${maxFraction * 100}%`,
        transform: `translateY(${translateY}px)`,
        transition: dragging ? "none" : SNAP_TRANSITION,
        willChange: "transform",
        touchAction: "none"
      }}
    >
      <div
        className="shrink-0 cursor-grab touch-none select-none rounded-t-[22px] outline-none focus-visible:ring-2 focus-visible:ring-wash-300 active:cursor-grabbing"
        role="slider"
        tabIndex={0}
        aria-label={handleLabel}
        aria-valuemin={0}
        aria-valuemax={snapPoints.length - 1}
        aria-valuenow={snapIndex}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-neutral-200" />
        {handle}
      </div>
      {children}
    </div>
  );
}
