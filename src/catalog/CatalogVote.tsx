import type { CatalogPublication } from './api';

export const CatalogVote = ({
  item,
  canVote,
  loginToVote,
  onVote,
  up,
  down,
}: {
  item: CatalogPublication;
  canVote: boolean;
  loginToVote?: boolean;
  onVote: (value: 1 | -1) => void;
  up: string;
  down: string;
}) => {
  if (canVote || loginToVote) {
    return (
      <div className="catalog-vote">
        <button type="button" className="catalog-vote-btn" aria-label={up} aria-pressed={item.vote === 1} onClick={() => onVote(1)}>
          ▲
        </button>
        <b>{item.votes}</b>
        <button type="button" className="catalog-vote-btn" aria-label={down} aria-pressed={item.vote === -1} onClick={() => onVote(-1)}>
          ▼
        </button>
      </div>
    );
  }
  return (
    <div className="catalog-vote">
      <span aria-hidden="true">▲</span>
      <b>{item.votes}</b>
      <span aria-hidden="true">▼</span>
    </div>
  );
};
