interface ShieldWithForkKnifeProps {
  size?: number;
}

export default function ShieldWithForkKnife({ size = 72 }: ShieldWithForkKnifeProps) {
  const h = Math.round(size * 82 / 72);
  return (
    <svg viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: h }}>
      <defs>
        <linearGradient id="shieldGradShared" x1="0" y1="0" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path d="M40 2 L74 14 L74 42 C74 64 40 82 40 82 C40 82 6 64 6 42 L6 14 Z" fill="url(#shieldGradShared)" />
      <line x1="23" y1="18" x2="23" y2="36" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="18" x2="28" y2="36" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="33" y1="18" x2="33" y2="36" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M23 36 Q23 42 28 42 Q33 42 33 36" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="42" x2="28" y2="67" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M49 18 L49 42 L54 42 C58 34 57 20 49 18 Z" fill="white" />
      <line x1="51.5" y1="44" x2="51.5" y2="67" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
