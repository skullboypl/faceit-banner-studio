import type { ReactNode } from 'react';

export const metadata = { title: 'FACEIT Banner Studio — API' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
