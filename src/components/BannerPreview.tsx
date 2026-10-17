import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SettingKey } from '../settings/manager';
import {
  measureBanner,
  paintPreviewPage,
  previewFrame,
  previewStage,
  previewUrl,
  type PreviewFrame,
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
 * A small live picture of a saved banner: the real widget page in a frame, scaled to the width of its card.
 * After load the frame is cropped to the painted widget, so leftover page (white sheet, empty OBS slot) is gone.
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const innerObserver = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(0);
  const [crop, setCrop] = useState<PreviewFrame | null>(null);
  const near = useNearScreen(box);
  const frame = previewFrame(get);
  const stage = previewStage(frame);
  const used = crop ?? frame;
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

  useEffect(() => {
    setCrop(null);
    innerObserver.current?.disconnect();
    innerObserver.current = null;
  }, [url]);

  useEffect(() => () => innerObserver.current?.disconnect(), []);

  const scale = width && used.width ? width / used.width : 0;

  const onLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    paintPreviewPage(doc);
    const apply = () => {
      paintPreviewPage(doc);
      const next = measureBanner(doc);
      if (next) setCrop(next);
    };
    apply();
    innerObserver.current?.disconnect();
    const node =
      doc.querySelector('.team-banner') ||
      doc.querySelector('.match-popup > article') ||
      doc.querySelector('.split-plate') ||
      doc.querySelector('.wrapper') ||
      doc.body;
    if (!node || typeof ResizeObserver === 'undefined') return;
    innerObserver.current = new ResizeObserver(apply);
    innerObserver.current.observe(node);
  };

  return (
    <div className="banner-preview" ref={box} style={{ height: Math.max(48, Math.ceil(used.height * scale)) }}>
      {near && scale > 0 && (
        <iframe
          ref={iframeRef}
          title={title}
          src={url}
          width={stage.width}
          height={stage.height}
          loading="lazy"
          tabIndex={-1}
          allowTransparency
          onLoad={onLoad}
          style={{
            transform: `translate(${-Math.round((used.left ?? 0) * scale)}px, ${-Math.round((used.top ?? 0) * scale)}px) scale(${scale})`,
            visibility: crop ? 'visible' : 'hidden',
          }}
        />
      )}
    </div>
  );
};
