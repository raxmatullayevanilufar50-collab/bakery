const PATHS = {
  truck: 'M3 6h11v9H3z M14 9h4l3 3v3h-7z M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  cash: 'M3 6h18v12H3z M7 10h10 M7 14h4',
  phone: 'M6 3h3l2 5-2 1c1 2 2 3 4 4l1-2 5 2v3c0 1-1 2-2 2C10 18 5 13 4 6c0-2 1-3 2-3Z',
  home: 'M3 10 12 3l9 7v10h-6v-6H9v6H3z',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5-7a4 4 0 0 1 3 6 M17 15h1a4 4 0 0 1 4 4v1',
  warehouse: 'M3 21V8l9-5 9 5v13H3Zm4 0v-8h10v8M7 10h10',
  chart: 'M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-7',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.3 3a8 8 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.8 1l.3 3h4.8l.3-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z',
  bread: 'M4 10c0-3 3-5 8-5s8 2 8 5v7c0 2-3 4-8 4s-8-2-8-4v-7Zm4 1v6m4-7v7m4-7v6',
  clipboard: 'M7 4h10v17H7z M9 4V2h6v2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'm20 20-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  filter: 'M4 5h16l-6 7v5l-4 2v-7L4 5Z',
  check: 'm5 12 4 4L19 6',
  x: 'm6 6 12 12M18 6 6 18',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  logout: 'M10 17l5-5-5-5m5 5H3m9-9V3h9v18h-9v-3',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3m-14 0h16v11H4z',
  edit: 'm4 16-1 4 4-1L19 7l-3-3L4 16Z',
  trash: 'M5 7h14m-9 4v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14',
  eye: 'M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  calendar: 'M5 4h14v16H5zM8 2v4m8-4v4M5 9h14',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
}

export default function Icon({ name, size = 20, strokeWidth = 2, className = '', label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name] || PATHS.bread} />
    </svg>
  )
}
