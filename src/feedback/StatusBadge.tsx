import { useContext } from 'react';
import { LanguageContext } from '../generator/contexts';
import type { PostStatus } from './api';

export const StatusBadge = ({ status }: { status: PostStatus }) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;
  return <span className={`status-badge status-badge--${status}`}>{tl(`feedback.status.${status}`)}</span>;
};
