import { useContext } from 'react';
import { FaceitLogoIcon } from '../assets/icons/faceit/FaceitLogoIcon';
import { LanguageContext } from '../generator/contexts';

export const LOGIN_URL = '/api/auth/login';

/** The one place that renders "Log in with FACEIT", so every entry point looks the same. */
export const FaceitLoginButton = ({ className = '' }: { className?: string }) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;
  return (
    <a className={`faceit-login ${className}`.trim()} href={LOGIN_URL}>
      <FaceitLogoIcon />
      <span>{tl('cloud.login')}</span>
    </a>
  );
};
