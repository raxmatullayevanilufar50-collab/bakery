export default function Skeleton({ variant = 'text', count = 1, className = '' }) {
  if (variant === 'grid') {
    return <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>{Array.from({ length: count }, (_, i) => <Skeleton key={i} variant="card" />)}</div>
  }
  return <div className={`skeleton-shimmer rounded-xl ${variant === 'card' ? 'h-32 w-full' : 'h-4 w-full'} ${className}`} aria-hidden="true" />
}
