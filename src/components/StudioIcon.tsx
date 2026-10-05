type IconName =
  | 'settings'
  | 'palette'
  | 'stats'
  | 'monitor'
  | 'arrow'
  | 'chevron'
  | 'layers'
  | 'book'
  | 'back';

const paths: Record<IconName, string> = {
  settings: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6',
  palette:
    'M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a1.5 1.5 0 0 1 0-3h3a5 5 0 0 0 5-5c0-3.5-4-6-9-6ZM7 9h.01M10 6h.01M15 7h.01M6 13h.01',
  stats: 'M4 20h16M6 16v-5m6 5V4m6 12V8',
  monitor: 'M4 4h16v13H4zM8 21h8m-4-4v4',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  back: 'M19 12H5m6-6-6 6 6 6',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h4',
};

export const StudioIcon = ({ name }: { name: IconName }) => (
  <svg
    className="studio-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={paths[name]} />
  </svg>
);
