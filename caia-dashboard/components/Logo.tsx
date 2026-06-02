export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="animate-coreGlow"
      aria-hidden
    >
      <circle cx="24" cy="24" r="21" stroke="#34e1d4" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="14" stroke="#4d9bff" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="7.5" stroke="#9b8cff" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="3.2" fill="#34e1d4" />
    </svg>
  );
}
