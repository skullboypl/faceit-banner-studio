import { useCallback, useContext, useRef, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import type { Language } from '../translations/translations';
import { StudioIcon } from './StudioIcon';
import { useDismiss } from './useDismiss';

const flagUrl = (id: string) => `https://flagcdn.com/${id === 'en' ? 'gb' : id}.svg`;

/** Dropdown instead of one button per language, so adding languages does not grow the menu. */
export const LanguageSelect = ({
  languages,
  current,
  onChange,
}: {
  languages: Language[];
  current: Language;
  onChange: (language: Language) => void;
}) => {
  const tl = useContext(LanguageContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, root, close);
  if (!tl) return null;

  const label = tl('generator.settings.language');
  const pick = (language: Language) => {
    close();
    onChange(language);
  };

  return (
    <div className="lang-select" ref={root}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.name}`}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <img className="flag" src={flagUrl(current.id)} alt="" />
        <span className="lang-name">{current.name}</span>
        <StudioIcon name="chevron" />
      </button>
      {open && (
        <ul className="lang-list" role="listbox" aria-label={label}>
          {languages.map((language) => (
            <li
              key={language.id}
              role="option"
              tabIndex={0}
              aria-selected={language.id === current.id}
              onClick={() => pick(language)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pick(language);
                }
              }}
            >
              <img className="flag" src={flagUrl(language.id)} alt="" />
              <span>{language.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
