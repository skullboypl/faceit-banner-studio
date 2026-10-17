import { languageFlagUrl } from '../components/language-flag';

export type MenuLanguage = { code: string; name: string; href: string };

/**
 * The language menu of the studio, for the pages that are plain HTML: a flag and the language name, and a list of
 * the languages (real links, so search engines follow them). It opens with <details>, so it needs no script.
 */
export const LanguageMenu = ({
  label,
  current,
  items,
}: {
  label: string;
  current: string;
  items: MenuLanguage[];
}) => {
  const active = items.find((item) => item.code === current) ?? items[0];
  return (
    <details className="lang-select">
      <summary className="lang-trigger" aria-label={`${label}: ${active.name}`} title={label}>
        <img className="flag" src={languageFlagUrl(active.code)} alt="" width="18" height="13" />
        <span className="lang-name">{active.name}</span>
        <svg className="lang-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </summary>
      <ul className="lang-list">
        {items.map((item) => (
          <li key={item.code}>
            <a href={item.href} hrefLang={item.code} lang={item.code} aria-current={item.code === active.code ? 'true' : undefined}>
              <img className="flag" src={languageFlagUrl(item.code)} alt="" width="18" height="13" />
              <span>{item.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
};

/** Closes an open menu when the page is clicked elsewhere. The menu works without it. */
export const LANGUAGE_MENU_SCRIPT =
  "document.addEventListener('click',function(e){document.querySelectorAll('details.lang-select[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open')})});";
