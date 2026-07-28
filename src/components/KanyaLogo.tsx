export function KanyaLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="50" fill="#0077e6" />
      <path
        d="M28 25 L28 75 M28 50 L55 25 M28 50 L55 75"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M65 35 C65 35 80 42 80 55 C80 65 73 72 65 72 C57 72 50 65 50 55"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="65" cy="35" r="5" fill="white" />
    </svg>
  );
}

export function KanyaWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      <span className="text-brand-600 dark:text-brand-400">Kanya</span>
      <span className="text-gray-400 text-xs font-medium ml-1">Water</span>
    </span>
  );
}
