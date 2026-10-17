import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SettingKey } from '../settings/manager';
import { previewFrame, previewUrl } from './banner-preview';

/** True once the element has come near the screen; without IntersectionObserver it is true at once. */
function useNearScreen(ref: React.RefObject<HTMLElement>) {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

/**
 * A small live picture of a saved banner: the real widget page in a frame, shrunk to the width of its card.
 * The frame is only created when the card is near the screen, so a long list does not load every widget at once.
 */
export const BannerPreview = ({
  get,
  languageId,
  title,
}: {
  get: (key: SettingKey) => unknown;
  languageId: string;
  title: string;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const near = useNearScreen(box);
  const frame = previewFrame(get);
  const url = useMemo(() => previewUrl(get, languageId, window.location.origin), [get, languageId]);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth || 360);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = width ? Math.min(1, width / frame.width) : 0;
  return (
    <div className="banner-preview" ref={box} style={{ height: Math.max(48, Math.round(frame.height * scale)) }}>
      {near && scale > 0 && (
        <iframe
          title={title}
          src={url}
          width={frame.width}
          height={frame.height}
          loading="lazy"
          tabIndex={-1}
          style={{ transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
};
