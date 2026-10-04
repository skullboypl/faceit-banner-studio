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

export function UpdateIntro({
  enabled,
  language,
  replay = 0,
}: {
  enabled: boolean;
  language: Language;
  replay?: number;
}) {
  const [visible, setVisible] = useState(enabled);
  const [size, setSize] = useState('regular');
  const introRef = useRef<HTMLDivElement>(null);

  // Runs once per browser-source load (or explicit preview replay), not on data refresh.
  useEffect(() => {
    setVisible(enabled);
    if (!enabled) return;
    const timeout = window.setTimeout(
      () => setVisible(false),
      WIDGET_RELEASE.introDuration
    );
    return () => window.clearTimeout(timeout);
  }, [enabled, replay]);

  useLayoutEffect(() => {
    const banner = introRef.current?.parentElement;
    if (!banner || !visible || !enabled) return;
    const measure = () => {
      const { width, height } = banner.getBoundingClientRect();
      setSize(
        height < 52 || width < 230
          ? 'tiny'
          : height < 135 || width < 360
            ? 'compact'
            : 'regular'
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [enabled, visible, replay]);

  if (!enabled || !visible) return null;

  const date = new Intl.DateTimeFormat(language.id, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${WIDGET_RELEASE.date}T12:00:00Z`));

  return (
    <div
      key={replay}
      ref={introRef}
      className={`banner-update-intro banner-update-intro--${size}`}
      role="status"
      lang={language.id}
      aria-label={`${tl(language, 'widget.update.title')} · v${WIDGET_RELEASE.version} · ${date}. ${tl(language, 'widget.update.description')}`}
      style={
        {
          '--intro-duration': `${WIDGET_RELEASE.introDuration}ms`,
        } as CSSProperties
      }
    >
      <div className="update-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="m18 4-3 10H6l10 14 3-10h9L18 4Z" fill="currentColor" />
        </svg>
      </div>
      <div className="update-copy">
        <div className="update-meta">
          <span>Banner Studio</span>
          <span>v{WIDGET_RELEASE.version}</span>
        </div>
        <div className="update-title">
          {tl(
            language,
            size === 'tiny'
              ? 'widget.update.short_title'
              : 'widget.update.title'
          )}
        </div>
        <div className="update-description">
          {tl(language, 'widget.update.description')}
        </div>
        <div className="update-footer">
          <time className="update-date" dateTime={WIDGET_RELEASE.date}>
            <span>{tl(language, 'widget.update.date')} </span>
            {date}
          </time>
          <a
            className="update-site"
            href="https://faceitbanner.vxh.pl/"
            target="_blank"
            rel="noreferrer"
          >
            faceitbanner.vxh.pl ↗
          </a>
        </div>
      </div>
      <div className="update-countdown" aria-hidden="true" />
    </div>
  );
}
