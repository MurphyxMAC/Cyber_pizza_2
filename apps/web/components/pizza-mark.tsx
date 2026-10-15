export function PizzaMark({
  className = "size-56",
  idPrefix = "pie",
}: {
  className?: string;
  idPrefix?: string;
}) {
  const crust = `${idPrefix}-crust`;
  const sauce = `${idPrefix}-sauce`;
  const glow = `${idPrefix}-glow`;

  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label="Neon supreme pizza"
    >
      <defs>
        <radialGradient id={crust} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#f2c27a" />
          <stop offset="70%" stopColor="#c9843a" />
          <stop offset="100%" stopColor="#8a4b1f" />
        </radialGradient>
        <radialGradient id={sauce} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5a4a" />
          <stop offset="100%" stopColor="#9d1c3a" />
        </radialGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="120" cy="120" r="108" fill={`url(#${crust})`} />
      <circle cx="120" cy="120" r="86" fill={`url(#${sauce})`} />
      <circle cx="120" cy="120" r="78" fill="#ffd56a" opacity="0.92" />
      <g filter={`url(#${glow})`}>
        <circle cx="92" cy="96" r="14" fill="#ff3b30" />
        <circle cx="146" cy="88" r="12" fill="#ff3b30" />
        <circle cx="128" cy="140" r="13" fill="#ff3b30" />
        <circle cx="84" cy="142" r="11" fill="#ff3b30" />
        <ellipse cx="160" cy="132" rx="10" ry="7" fill="#f4efe4" transform="rotate(-20 160 132)" />
        <ellipse cx="104" cy="124" rx="9" ry="6" fill="#f4efe4" transform="rotate(18 104 124)" />
        <path d="M70 112c10-14 22-8 18 4-8 2-16 4-18-4z" fill="#3ef0d2" />
        <path d="M156 108c12-10 20 2 8 10-8 0-14-2-8-10z" fill="#7ee0ff" />
        <path d="M118 78c8 10 2 16-6 12 2-10 2-16 6-12z" fill="#ff8fab" />
        <circle cx="150" cy="160" r="5" fill="#ff7a18" />
        <circle cx="78" cy="96" r="4" fill="#c084fc" />
      </g>
      <circle cx="120" cy="120" r="108" fill="none" stroke="#ff3d8a" strokeWidth="2" opacity="0.7" />
      <circle cx="120" cy="120" r="114" fill="none" stroke="#3ef0d2" strokeWidth="1" opacity="0.45" />
    </svg>
  );
}
