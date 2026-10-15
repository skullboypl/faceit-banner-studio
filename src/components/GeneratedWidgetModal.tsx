import { Language, tl } from '../translations/translations.ts';
import { Dispatch, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { broadcastPresets } from '../../widget/src/styles/styles';
import { SPLIT_PARTS } from '../../widget/src/widget/SplitBanner';
import { readTeamOptions, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import { settingsFromQuery } from '../settings/query-values';

type SourceSize = { width: number; height: number };

const PREVIEW_SIZES: { id: string; width: number; height: number }[] = [
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '1280x720', width: 1280, height: 720 },
  { id: '800x600', width: 800, height: 600 },
];

/** Scale that fits a frame of `frame` px into `room` px of width; never enlarges, and 1 until measured. */
export function fitScale(room: number, frame: number): number {
  if (room <= 0 || frame <= 0) return 1;
  return Math.min(1, Math.round((room / frame) * 1000) / 1000);
}

/** Shows a fixed-size frame (an OBS source) scaled down to the width available, so it never needs scrollbars. */
function FitFrame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: (style: { transform?: string; transformOrigin?: string }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setRoom(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = fitScale(room, width);
  return (
    <div ref={ref} className="fit-frame" style={{ height: Math.round(height * scale) }}>
      {children(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: '0 0' } : {})}
    </div>
  );
}

export const GeneratedWidgetModal = ({
  language,
  url,
  setURL,
  mode = 'widget',
}: {
  language: Language;
  url: string | undefined;
  setURL: Dispatch<string | undefined>;
  mode?: 'widget' | 'settings';
}) => {
  const urlInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [measured, setMeasured] = useState<SourceSize>();
  const [previewSize, setPreviewSize] = useState('recommended');
  const [copiedLabel, setCopiedLabel] = useState<string>();
  const query = url ? new URL(url).searchParams : undefined;
  const isSplitLink = query?.get('mode') === 'split';
  const splitLinks =
    url && isSplitLink
      ? (['radar', 'camera'] as const).map((part) => {
          const next = new URL(url);
          next.searchParams.set('part', part);
          return {
            part,
            href: next.toString(),
            width: SPLIT_PARTS[part].width,
            height: SPLIT_PARTS[part].height,
          };
        })
      : undefined;
  const preset =
    query?.get('design') === '2026'
      ? broadcastPresets.find((entry) => entry.id === query.get('style'))
      : undefined;
  const widthAuto = query?.get('banner_width_mode') === 'auto';
  const heightAuto = query?.get('banner_height_mode') === 'auto';
  const sizeIsAuto = Boolean(preset) && (widthAuto || heightAuto);

  // Otwieranie/zamykanie + auto-focus na polu z linkiem
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    // bezpieczne showModal (Safari/nieobsługiwane dialogi)
    if (url) {
      if (typeof dlg.showModal === 'function') {
        try {
          dlg.showModal();
        } catch {
          dlg.setAttribute('open', 'true');
        }
      } else {
        dlg.setAttribute('open', 'true');
      }

      // focus i zaznaczenie URL
      setTimeout(() => {
        if (!urlInputRef.current) return;
        urlInputRef.current.focus();
        urlInputRef.current.select();
        urlInputRef.current.setSelectionRange(
          0,
          (urlInputRef.current.value || '').length
        );
      }, 0);
    } else {
      try {
        dlg.close();
      } catch {
        dlg.removeAttribute('open');
      }
    }
    setMeasured(undefined);
    setPreviewSize('recommended');
  }, [url]);

  /* The real widget knows its own size: read it from the preview once data has loaded */
  useEffect(() => {
    if (!url || mode !== 'widget' || !preset || isSplitLink || preset.group === 'popup') return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      try {
        const wrapper = frameRef.current?.contentDocument?.querySelector('.wrapper');
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect();
          if (rect.width > 20 && rect.height > 20) {
            setMeasured({
              /* the far edge, not the size: the page starts a few pixels in, and OBS crops what lies beyond the source */
              width: Math.ceil(rect.right + 2),
              height: Math.ceil(rect.bottom + 2),
            });
          }
        }
      } catch {
        /* a cross-origin frame cannot be read */
      }
      if (tries > 14) window.clearInterval(timer);
    }, 700);
    return () => window.clearInterval(timer);
  }, [url, mode, preset, isSplitLink]);

  const close = useCallback(() => {
    setURL(undefined);
  }, [setURL]);

  const writeClipboard = useCallback(async (value: string, label?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      try {
        urlInputRef.current?.select();
        document.execCommand('copy');
      } catch {
        /* no-op */
      }
    }
    if (label) {
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(undefined), 1200);
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    const value = urlInputRef.current?.value || url || '';
    await writeClipboard(value);
    if (urlInputRef.current) {
      urlInputRef.current.title = 'Skopiowano!';
      setTimeout(() => {
        if (urlInputRef.current) urlInputRef.current.title = '';
      }, 1200);
    }
  }, [url, writeClipboard]);

  /* A roster is as wide as its columns need, so the size follows the link, not the preset's fixed width */
  const teamWidth =
    preset && query?.get('mode') === 'team'
      ? teamRecommendedWidth(readTeamOptions(settingsFromQuery(query)), preset.id === 'sheet' ? 'sheet' : 'lineup')
      : undefined;
  const recommended: SourceSize | undefined = preset
    ? {
        width: measured?.width ?? teamWidth ?? preset.width,
        height: measured?.height ?? preset.height,
      }
    : undefined;
  const frameSize: SourceSize =
    previewSize === 'recommended'
      ? (!sizeIsAuto && recommended) || { width: 1280, height: 720 }
      : PREVIEW_SIZES.find((entry) => entry.id === previewSize) || PREVIEW_SIZES[1];

  return (
    <dialog
      ref={dialogRef}
      className="generated"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generated-widget-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={close}
      onClick={(e) => {
        // kliknięcie w backdrop – zamykamy
        if (e.target === dialogRef.current) close();
      }}
    >
      <div className="content">
        <h1 id="generated-widget-title">
          {mode === 'settings'
            ? tl(language, 'modals.generated_settings.title')
            : tl(language, 'modals.generated.title')}
        </h1>
        <p>
          {mode === 'settings'
            ? tl(language, 'generator.share.info.0')
            : tl(language, 'generator.generate.info.0')}
        </p>
        {mode === 'settings' && (
          <p>{tl(language, 'generator.share.info.1')}</p>
        )}

        {splitLinks ? (
          <div className="split-links">
            <p>{tl(language, 'split.links.help')}</p>
            {splitLinks.map((entry, index) => (
              <div className="split-link" key={entry.part}>
                <div className="obs-size-head">
                  <strong>{tl(language, `split.link.${entry.part}`)}</strong>
                  <span className="obs-size-value">
                    {entry.width} × {entry.height}
                  </span>
                </div>
                <input
                  ref={index === 0 ? urlInputRef : undefined}
                  readOnly
                  value={entry.href}
                  onFocus={(e) => {
                    e.currentTarget.select();
                    e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
                  }}
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => writeClipboard(entry.href, entry.part)}
                >
                  {tl(language, 'modals.buttons.copy')}
                  {copiedLabel === entry.part ? ' ✓' : ''}
                </button>
                <div className="iframe-preview obs-frame">
                  <FitFrame width={entry.width} height={entry.height}>
                    {(fit) => (
                      <iframe
                        title={tl(language, `split.link.${entry.part}`)}
                        src={`${entry.href}&presence=off`}
                        style={{
                          border: 0,
                          width: `${entry.width}px`,
                          height: `${entry.height}px`,
                          display: 'block',
                          background: 'transparent',
                          ...fit,
                        }}
                      />
                    )}
                  </FitFrame>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <input
          ref={urlInputRef}
          readOnly
          value={url || ''}
          onFocus={(e) => {
            e.currentTarget.select();
            e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
          }}
          onClick={(e) => {
            e.currentTarget.select();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') copyToClipboard();
            if (e.key === 'Escape') close();
          }}
        />
        )}

        {mode === 'widget' && !splitLinks && (
          <div className="obs-size">
            <div className="obs-size-head">
              <strong>{tl(language, 'obs.size.title')}</strong>
              {recommended && !sizeIsAuto && (
                <span className="obs-size-value">
                  {recommended.width} × {recommended.height} px
                </span>
              )}
            </div>
            {sizeIsAuto ? (
              <p>{tl(language, 'obs.size.auto')}</p>
            ) : recommended ? (
              <>
                <p>{tl(language, 'obs.size.hint')}</p>
                <div className="obs-size-copy">
                  <button
                    type="button"
                    onClick={() =>
                      writeClipboard(String(recommended.width), 'w')
                    }
                  >
                    {tl(language, 'obs.size.width')}: {recommended.width}
                    {copiedLabel === 'w' ? ' ✓' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      writeClipboard(String(recommended.height), 'h')
                    }
                  >
                    {tl(language, 'obs.size.height')}: {recommended.height}
                    {copiedLabel === 'h' ? ' ✓' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      writeClipboard(
                        `${recommended.width} x ${recommended.height}`,
                        'both'
                      )
                    }
                  >
                    {tl(language, 'obs.size.copy_both')}
                    {copiedLabel === 'both' ? ' ✓' : ''}
                  </button>
                </div>
              </>
            ) : (
              <p>{tl(language, 'generator.generate.info.1')}</p>
            )}
          </div>
        )}

        {mode === 'widget' && url && !splitLinks && (
          <div className="obs-preview">
            <div className="obs-preview-head">
              <strong>{tl(language, 'obs.preview.title')}</strong>
              <div className="obs-preview-sizes" role="group">
                {!sizeIsAuto && recommended && (
                  <button
                    type="button"
                    aria-pressed={previewSize === 'recommended'}
                    onClick={() => setPreviewSize('recommended')}
                  >
                    {tl(language, 'obs.preview.recommended')}
                  </button>
                )}
                {PREVIEW_SIZES.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    aria-pressed={previewSize === entry.id}
                    onClick={() => setPreviewSize(entry.id)}
                  >
                    {entry.width} × {entry.height}
                  </button>
                ))}
              </div>
            </div>
            <p>{tl(language, 'obs.preview.hint')}</p>
            <div className="iframe-preview obs-frame">
              <FitFrame width={frameSize.width} height={frameSize.height}>
                {(fit) => (
                  <iframe
                    ref={frameRef}
                    title={'Widget preview from generated link'}
                    src={`${url}${url.includes('?') ? '&' : '?'}presence=off`}
                    style={{
                      border: 0,
                      width: `${frameSize.width}px`,
                      minWidth: `${frameSize.width}px`,
                      height: `${frameSize.height}px`,
                      display: 'block',
                      background: 'transparent',
                      ...fit,
                    }}
                  />
                )}
              </FitFrame>
            </div>
          </div>
        )}

        <div className="buttons">
          <button onClick={copyToClipboard}>
            {tl(language, 'modals.buttons.copy')}
          </button>
          <button
            onClick={() => {
              const target = splitLinks?.[0]?.href || url;
              if (target) window.open(target, '_blank', 'noopener,noreferrer');
            }}
          >
            {tl(language, 'generator.generate.open_in_browser.button')}
          </button>
          <button onClick={close}>
            {tl(language, 'modals.buttons.close')}
          </button>
        </div>
      </div>
    </dialog>
  );
};
