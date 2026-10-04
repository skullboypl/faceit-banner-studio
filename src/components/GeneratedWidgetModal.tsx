import { Language, tl } from '../translations/translations.ts';
import { Dispatch, useEffect, useRef, useCallback } from 'react';
import { broadcastPresets } from '../../widget/src/styles/styles';

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
  const query = url ? new URL(url).searchParams : undefined;
  const preset =
    query?.get('design') === '2026'
      ? broadcastPresets.find((entry) => entry.id === query.get('style'))
      : undefined;

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
  }, [url]);

  const close = useCallback(() => {
    setURL(undefined);
  }, [setURL]);

  const copyToClipboard = useCallback(async () => {
    const value = urlInputRef.current?.value || url || '';
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      if (urlInputRef.current) {
        urlInputRef.current.title = 'Skopiowano!';
        setTimeout(() => {
          if (urlInputRef.current) urlInputRef.current.title = '';
        }, 1200);
      }
    } catch {
      // Fallback
      try {
        urlInputRef.current?.select();
        document.execCommand('copy');
      } catch {
        /* no-op */
      }
    }
  }, [url]);

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
        <p>
          {mode === 'settings'
            ? tl(language, 'generator.share.info.1')
            : preset
              ? tl(language, 'generator.generate.size', [
                  String(preset.width),
                  String(preset.height),
                ])
              : tl(language, 'generator.generate.info.1')}
        </p>

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
          <>
            <p>{tl(language, 'generator.generate.iframe.info')}</p>
            {url && (
              <div className="iframe-preview">
                <iframe
                  title={'Widget preview from generated link'}
                  src={url}
                  loading={'lazy'}
                  style={{
                    border: 0,
                    width: '500px',
                    minWidth: '500px',
                    height: '190px',
                    borderRadius: '10px',
                    display: 'block',
                  }}
                />
              </div>
            )}
          </>
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
