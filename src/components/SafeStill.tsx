import { useEffect, useState } from 'react';

/** Hide a decorative `<img>` if the file 404s so the plate behind it stays. */
export function hideBrokenStill(event: { currentTarget: HTMLImageElement }) {
  event.currentTarget.hidden = true;
}

/**
 * A still URL only after the browser decoded it. Missing or not-yet-ready files
 * stay undefined so CSS never points at a hashed path that will 404.
 * Tests get the URL immediately so jsdom does not have to fetch PNGs.
 */
export function useReadyStill(url?: string): string | undefined {
  const [ready, setReady] = useState<string | undefined>(() =>
    url && import.meta.env.MODE === 'test' ? url : undefined
  );

  useEffect(() => {
    if (!url) {
      setReady(undefined);
      return;
    }
    if (import.meta.env.MODE === 'test') {
      setReady(url);
      return;
    }
    let live = true;
    const image = new Image();
    image.onload = () => {
      if (live) setReady(url);
    };
    image.onerror = () => {
      if (live) setReady(undefined);
    };
    image.src = url;
    return () => {
      live = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [url]);

  return ready;
}
