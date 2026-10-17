import { useContext } from 'react';
import { LanguageContext } from '../generator/Generator.tsx';
import { DonateLink } from './DonateLink.tsx';
import { BrandGithubIcon } from '../assets/icons/tabler/BrandGithubIcon.tsx';

const GITHUB_REPO_URL =
  'https://github.com/skullboypl/faceit-banner-faceitbanner.vxh.pl';

/** Author channel; the sidebar credit and the footer point here instead of a CS2 blurb in the rail. */
export const SKULL_YOUTUBE_URL = 'https://www.youtube.com/@skullboypl';
export const SKULL_X_URL = 'https://x.com/skullboypl';
export const SMOOTH_WIZARD_URL = 'https://smoothwizard.com/';

export const Footer = () => {
  const tl = useContext(LanguageContext);

  if (!tl) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="footer-left">
        <small>
          CS2 · {tl('studio.sidebar_note')}
        </small>
        <small>
          Ten projekt nie jest powiązany z{' '}
          <a href="https://faceit.com" target="_blank" rel="noreferrer">
            FACEIT
          </a>
          .
        </small>
        <small>
          Ten projekt jest pochodną projektu z licencją:{' '}
          <a
            href="https://github.com/mxgic1337/faceit-stats-widget/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
        </small>
        <small>
          <a href="/docs/">Docs</a> · <a href="/wiki/">Wiki</a> ·{' '}
          <a href="/terms/">{tl('footer.terms')}</a> ·{' '}
          <a href="/privacy/">{tl('footer.privacy')}</a>
        </small>
      </div>
      <div className="footer-right">
        <DonateLink variant="footer" />
        <a
          className="footer-github-link"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Repozytorium na GitHubie"
          title="Kod źródłowy na GitHubie"
        >
          <BrandGithubIcon />
          <span>GitHub</span>
        </a>
        <small>
          Copyright ©{' '}
          <a href={SKULL_YOUTUBE_URL} target="_blank" rel="noreferrer">
            Skull
          </a>{' '}
          {new Date().getFullYear()}
        </small>
      </div>
    </footer>
  );
};
