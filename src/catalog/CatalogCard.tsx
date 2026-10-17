import type { ReactNode } from 'react';
import { BannerPreview } from '../components/BannerPreview';
import { StudioIcon } from '../components/StudioIcon';
import { settingsGetter } from './preview-get';
import { CatalogVote } from './CatalogVote';
import type { CatalogPublication, PublicationStatus } from './api';

export const CatalogCard = ({
  item,
  languageId,
  studioPlayer,
  canVote,
  askLogin,
  statusLabel,
  byLabel,
  up,
  down,
  loadLabel,
  onVote,
  onLoad,
  extra,
}: {
  item: CatalogPublication;
  languageId: string;
  studioPlayer?: unknown;
  canVote: boolean;
  askLogin?: boolean;
  statusLabel?: (status: PublicationStatus) => string;
  byLabel: string;
  up: string;
  down: string;
  loadLabel?: string;
  onVote: (value: 1 | -1) => void;
  onLoad?: () => void;
  extra?: ReactNode;
}) => (
  <li className="catalog-item">
    <CatalogVote
      item={item}
      canVote={canVote}
      loginToVote={askLogin ?? (!canVote && item.status === 'approved')}
      onVote={onVote}
      up={up}
      down={down}
    />
    <div className="catalog-main">
      <BannerPreview get={settingsGetter(item.settings, studioPlayer)} languageId={languageId} title={item.title} />
      <div className="catalog-copy">
        <strong>{item.title}</strong>
        <p>{item.body}</p>
        <small>
          {statusLabel && <span className={`status-badge status-badge--${item.status}`}>{statusLabel(item.status)}</span>}
          <span>{byLabel}</span>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </small>
        {onLoad && loadLabel && (
          <button type="button" className="catalog-load has-icon" onClick={onLoad}>
            <StudioIcon name="download" />
            {loadLabel}
          </button>
        )}
        {extra}
      </div>
    </div>
  </li>
);
