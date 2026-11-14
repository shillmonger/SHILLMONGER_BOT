
"use client";

import React from "react";

interface Props {
  className?: string;
  fullscreen?: boolean;
  label?: string;
}

const LETTERS: string[] = [
  "M29,233 H260 V303 H97 V325 H260 V474 H18 V400 H181 V385 H29 Z",
  "M270,185 H353 V322 H406 V233 H476 V470 H406 V391 H353 V495 H270 Z",
  "M487,185 H567 V257 H487 Z M487,270 H567 V495 H487 Z",
  "M578,233 H650 V400 H731 V472 H578 Z",
  "M740,233 H818 V400 H905 V472 H740 Z",
  "M916,185 H996 L1066,275 L1136,185 H1209 V495 H1126 V325 L1066,395 L1000,325 V495 H916 Z",
  "M1219,233 H1401 V472 H1219 Z M1283,328 H1338 V379 H1283 Z",
  "M1411,233 H1466 L1541,323 V233 H1608 V472 H1553 L1482,387 V472 H1411 Z",
  "M1619,233 H1810 V306 H1686 V401 H1739 V388 H1697 V328 H1810 V472 H1619 Z",
  "M1820,233 H1967 V306 H1890 V325 H1967 V387 H1890 V401 H1967 V472 H1820 Z",
  "M1977,233 H2147 V395 H2107 L2167,490 H2102 L2043,402 V472 H1977 Z M2041,306 H2081 V329 H2041 Z",
];

const CSS = `
.shill-svg {
  overflow: visible;
  filter: drop-shadow(0 0 12px rgba(124, 58, 237, 0.4));
}

.shill-letter {
  fill: #6b00d6;
  stroke: #c084fc;
  stroke-width: 7;
  stroke-linejoin: round;
  stroke-dasharray: 1 1;
  stroke-dashoffset: 1;
  fill-opacity: 0;
  opacity: 0;
  animation: shill-write 3.4s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.13s);
}

@keyframes shill-write {
  0% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    opacity: 1;
  }
  38% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    opacity: 1;
  }
  52% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    opacity: 1;
  }
  80% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    opacity: 1;
  }
  95% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    opacity: 0;
  }
  100% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    opacity: 0;
  }
}

/* Subtle ambient background */
.shill-loader-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* Bottom-right ambient light */
.shill-glow-right {
  position: absolute;
  right: -180px;
  bottom: -210px;
  width: 580px;
  height: 580px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(124, 58, 237, 0.13) 0%,
    rgba(124, 58, 237, 0.06) 40%,
    transparent 72%
  );
  filter: blur(45px);
  animation: ambient-right 14s ease-in-out infinite;
}

/* Bottom-left subtle lighting */
.shill-glow-left {
  position: absolute;
  left: -190px;
  bottom: -230px;
  width: 480px;
  height: 480px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.10) 0%,
    rgba(139, 92, 246, 0.04) 45%,
    transparent 72%
  );
  filter: blur(45px);
  animation: ambient-left 18s ease-in-out infinite;
}

@keyframes ambient-right {
  0%, 100% {
    opacity: 0.65;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@keyframes ambient-left {
  0%, 100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.1);
  }
}

/* Loading message */
.shill-loading-message {
  color: hsl(var(--muted-foreground));
  animation: message-pulse 2.8s ease-in-out infinite;
}

@keyframes message-pulse {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .shill-letter,
  .shill-glow-right,
  .shill-glow-left,
  .shill-loading-message {
    animation: none !important;
  }

  .shill-letter {
    opacity: 1;
    fill-opacity: 1;
    stroke-dashoffset: 0;
  }
}
`;

export function ShillmongerLoader({
  className = "w-full max-w-md",
  fullscreen = false,
  label = "Loading",
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background"
          : "relative flex min-h-full w-full items-center justify-center overflow-hidden"
      }
    >
      <style>{CSS}</style>

      {/* Ambient lighting */}
      <div className="shill-loader-bg">
        <div className="shill-glow-right" />
        <div className="shill-glow-left" />
      </div>

      {/* Loader content */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center gap-7 px-6">

        {/* Animated logo */}
        <div className={className}>
          <svg
            className="shill-svg w-full"
            viewBox="0 165 2190 350"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {LETTERS.map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={1}
                fillRule="evenodd"
                className="shill-letter"
                style={{
                  ["--i" as string]: i,
                } as React.CSSProperties}
              />
            ))}
          </svg>
        </div>

        {/* Loading message */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="shill-loading-message text-sm font-medium tracking-wide">
            Please wait while we gather all the information for this page...
          </p>

          <span className="text-xs text-muted-foreground/60">
            This may take a few moments
          </span>
        </div>

      </div>

      <span className="sr-only">{label}...</span>
    </div>
  );
}

export default ShillmongerLoader;
