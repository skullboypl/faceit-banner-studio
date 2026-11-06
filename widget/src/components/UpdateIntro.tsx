import {
  CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Language, tl } from '../../../src/translations/translations';
import { WIDGET_RELEASE } from '../release';
import '../styles/update-intro.less';

const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Whole seconds left, so the counter reads 6, 5, … 1 and never shows 0 while visible. */
const secondsLeft = (startedAt: number, duration: number) =>
  Math.max(1, Math.ceil((duration - (Date.now() - startedAt)) / 1000));

type IntroLayout = { variants: string[]; zoom: number };

/**
 * Variant from the size the banner really has on screen (CSS zoom included), so a
 * 40 % banner gets the slim strip even though its layout box is still full size.
 */
export const introLayout = (
  width: number,
  height: number,
  zoom: number
): IntroLayout => {
  const variants: string[] = [];
  if (height < 72) {
    variants.push('strip');
    if (width < 330) variants.push('narrow');
    if (height < 34) variants.push('tiny');
  } else if (width / height < 1.25) {
    variants.push('tall');
  } else if (height < 140) {
    variants.push('compact');
  } else if (height >= 300 && width >= 400) {
    variants.push('rich');
  }
  return { variants, zoom: zoom > 0 && Number.isFinite(zoom) ? zoom : 1 };
};

/**
 * One-time "what's new" toast on the banner. It sits in a corner (or along the
 * bottom of very small banners), scales with the banner through container units
 * and shows a ring + seconds counter until it disappears.
 */
export function UpdateIntro({
  enabled,
  language,
  replay = 0,
}: {
  enabled: boolean;
  language: Language;
  replay?: number;
}) {
  const duration = WIDGET_RELEASE.introDuration;
  const [visible, setVisible] = useState(enabled);
  const [remaining, setRemaining] = useState(Math.ceil(duration / 1000));
  const [layout, setLayout] = useState<IntroLayout>({ variants: [], zoom: 1 });
  const introRef = useRef<HTMLDivElement>(null);

  // Runs once per browser-source load (or explicit preview replay), not on data refresh.
  useEffect(() => {
    setVisible(enabled);
    if (!enabled) return;
    const startedAt = Date.now();
    setRemaining(secondsLeft(startedAt, duration));
    const tick = window.setInterval(
      () => setRemaining(secondsLeft(startedAt, duration)),
      250
    );
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timeout);
    };
  }, [enabled, replay, duration]);

  useLayoutEffect(() => {
    const intro = introRef.current;
    if (!intro || !visible) return;
    const measure = () => {
      const { width, height } = intro.getBoundingClientRect();
      const next = introLayout(width, height, width / (intro.offsetWidth || width));
      setLayout((current) =>
        current.zoom === next.zoom &&
        current.variants.join() === next.variants.join()
          ? current
          : next
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(intro);
    return () => observer.disconnect();
  }, [visible, replay]);

  if (!enabled || !visible) return null;

  const date = new Intl.DateTimeFormat(language.id, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${WIDGET_RELEASE.date}T12:00:00Z`));
  const hidesIn = tl(language, 'widget.update.hides_in', [String(remaining)]);

  return (
    <div
      key={replay}
      ref={introRef}
      className={['banner-update-intro', ...layout.variants.map((variant) => `banner-update-intro--${variant}`)].join(' ')}
      role="status"
      lang={language.id}
      aria-label={`${tl(language, 'widget.update.title')} · v${WIDGET_RELEASE.version} · ${date}. ${tl(language, 'widget.update.description')}`}
      style={
        {
          '--intro-duration': `${duration}ms`,
          '--ring-length': RING_LENGTH,
          '--z': layout.zoom,
        } as CSSProperties
      }
    >
      <div className="update-toast">
        <div className="update-timer" title={hidesIn} aria-hidden="true">
          <svg viewBox="0 0 36 36">
            <circle className="update-timer-track" cx="18" cy="18" r={RING_RADIUS} />
            <circle
              className="update-timer-ring"
              cx="18"
              cy="18"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
            />
          </svg>
          <span className="update-timer-value">{remaining}</span>
        </div>
        <div className="update-copy">
          <div className="update-kicker">
            <span className="update-badge">
              {tl(language, 'widget.update.short_title')}
            </span>
            <span className="update-version">v{WIDGET_RELEASE.version}</span>
          </div>
          <div className="update-title">
            {tl(language, 'widget.update.title')}
          </div>
          <div className="update-description">
            {tl(language, 'widget.update.description')}
          </div>
          <div className="update-footer">
            <time className="update-date" dateTime={WIDGET_RELEASE.date}>
              {date}
            </time>
            <a
              className="update-site"
              href="https://faceitbanner.vxh.pl/"
              target="_blank"
              rel="noreferrer"
            >
              faceitbanner.vxh.pl
            </a>
          </div>
        </div>
        <div className="update-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
