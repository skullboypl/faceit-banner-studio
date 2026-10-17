import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SettingKey } from '../settings/manager';
import {
  paintPreviewPage,
  previewFrame,
  previewIconScale,
  previewIconTransform,
  previewSubject,
  previewUrl,
  type PreviewSubject,
} from './banner-preview';

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
 * A small live picture of a saved banner: the widget stays at its recommended OBS size, then a CSS
 * scale shrinks it into an icon. The widget does not reflow to the card.
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [subject, setSubject] = useState<PreviewSubject | null>(null);
  const [loaded, setLoaded] = useState(0);
  const near = useNearScreen(box);
  const frame = previewFrame(get);
  const popup = get('widgetMode') === 'popup';
  const url = useMemo(() => previewUrl(get, languageId, window.location.origin), [get, languageId]);
  const source = subject ?? frame;
  const scale = previewIconScale(source, width);
  const visual = {
    width: Math.max(1, Math.ceil(source.width * scale)),
    height: Math.max(1, Math.ceil(source.height * scale)),
  };
  const ready = !popup || subject !== null;

  useEffect(() => {
    setSubject(null);
    setLoaded(0);
  }, [url]);

  /* Popup is a 1920 overlay; wait for the card, then zoom the thumbnail to that box. */
  useEffect(() => {
    if (!popup || !near) return;
    let observer: ResizeObserver | null = null;
    let alive = true;
    const read = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.documentElement || !alive) return false;
      const next = previewSubject(doc);
      if (!next) return false;
      setSubject(next);
      const card = doc.querySelector('.match-popup article');
      if (card && typeof ResizeObserver !== 'undefined' && !observer) {
        observer = new ResizeObserver(() => {
          const again = previewSubject(doc);
          if (again) setSubject(again);
        });
        observer.observe(card);
      }
      return true;
    };
    if (read()) return () => observer?.disconnect();
    const id = window.setInterval(() => {
      if (read()) window.clearInterval(id);
    }, 100);
    const stop = window.setTimeout(() => window.clearInterval(id), 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(stop);
      observer?.disconnect();
    };
  }, [popup, near, url, loaded]);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const styles = getComputedStyle(element);
      const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      setWidth(Math.max(0, element.clientWidth - pad) || 360);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="banner-preview" ref={box}>
      {near && (
        <div
          className="banner-preview-icon"
          style={
            ready && scale > 0
              ? { width: visual.width, height: visual.height }
              : { width: Math.max(width, 1), height: 128, opacity: 0 }
          }
        >
          <iframe
            ref={iframeRef}
            title={title}
            src={url}
            width={frame.width}
            height={frame.height}
            loading="lazy"
            tabIndex={-1}
            allowTransparency
            onLoad={() => {
              const doc = iframeRef.current?.contentDocument;
              if (doc) paintPreviewPage(doc);
              setLoaded((n) => n + 1);
            }}
            /* Inline size beats `main iframe { width: 400px }`, which would clip the recommended OBS frame. */
            style={{
              width: frame.width,
              height: frame.height,
              transform: previewIconTransform(scale || 0.001, subject),
            }}
          />
        </div>
      )}
    </div>
  );
};
