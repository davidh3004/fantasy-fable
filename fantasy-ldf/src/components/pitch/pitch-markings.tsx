/** Soccer pitch line markings, drawn over the green surface. */
export function PitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-white/30"
      viewBox="0 0 100 133"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="4"
        y="4"
        width="92"
        height="125"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      />
      <line
        x1="4"
        y1="66.5"
        x2="96"
        y2="66.5"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <circle
        cx="50"
        cy="66.5"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <rect
        x="22"
        y="4"
        width="56"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <rect
        x="22"
        y="107"
        width="56"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}
