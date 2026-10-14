import { useContext } from 'react';
import { LanguageContext } from '../generator/contexts';
import { StudioIcon } from './StudioIcon';

export const DONATE_URL = 'https://donate.skullmedia.pl';

export const DonateLink = ({ variant }: { variant: 'header' | 'footer' }) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;

  return (
    <a className={`donate-link donate-link--${variant}`} title={`${tl('donate.link')} — ${tl('donate.hint')}`} href={DONATE_URL} target="_blank" rel="noreferrer noopener">
      <StudioIcon name="heart" />
      <span>
        <strong>{tl('donate.link')}</strong> <small>{tl('donate.hint')}</small>
      </span>
    </a>
  );
};
