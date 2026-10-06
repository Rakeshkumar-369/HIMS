export function Logo({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--brand-500)" />
      <path d="M32 47s-15-8.6-15-20a8.5 8.5 0 0 1 15-5.5A8.5 8.5 0 0 1 47 27c0 11.4-15 20-15 20Z" fill="#fff" />
      <path d="M29 28h6M32 25v6" stroke="var(--brand-500)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <div className="leading-tight">
        <div className="text-[17px] font-extrabold tracking-tight">CareNest</div>
        <div className="text-[11px] font-medium text-muted">Clinic OS</div>
      </div>
    </div>
  );
}
