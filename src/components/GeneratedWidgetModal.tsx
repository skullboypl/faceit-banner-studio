import { Language, tl } from '../translations/translations.ts';
import { Dispatch, useEffect, useRef, useCallback, useState } from 'react';
import { broadcastPresets } from '../../widget/src/styles/styles';

type SourceSize = { width: number; height: number };

const PREVIEW_SIZES: { id: string; width: number; height: number }[] = [
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '1280x720', width: 1280, height: 720 },
  { id: '800x600', width: 800, height: 600 },
];

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
    if (!url || mode !== 'widget' || !preset) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      try {
        const wrapper = frameRef.current?.contentDocument?.querySelector('.wrapper');
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect();
          if (rect.width > 20 && rect.height > 20) {
            setMeasured({
              width: Math.ceil(rect.width),
              height: Math.ceil(rect.height),
            });
          }
        }
      } catch {
        /* a cross-origin frame cannot be read */
      }
      if (tries > 14) window.clearInterval(timer);
    }, 700);
    return () => window.clearInterval(timer);
  }, [url, mode, preset]);

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

  const recommended: SourceSize | undefined = preset
    ? {
        width: measured?.width ?? preset.width,
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

        {mode === 'widget' && (
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

        {mode === 'widget' && url && (
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
                }}
              />
            </div>
          </div>
        )}

        <div className="buttons">
          <button onClick={copyToClipboard}>
            {tl(language, 'modals.buttons.copy')}
          </button>
          <button
            onClick={() => {
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
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
