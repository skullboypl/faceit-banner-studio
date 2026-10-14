import { useContext } from 'react';
import type { SyncConflict } from '../cloud/useCloudSync';
import { LanguageContext } from '../generator/contexts';

export const ConflictDialog = ({ conflict }: { conflict: SyncConflict | null }) => {
  const tl = useContext(LanguageContext);
  if (!tl || !conflict) return null;

  return (
    <div className="conflict-backdrop">
      <div className="conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
        <h3 id="conflict-title">{tl('conflict.title')}</h3>
        <p>{tl('conflict.body')}</p>
        <div className="conflict-actions">
          <button type="button" className="primary-action" onClick={conflict.useCloud}>
            {tl('conflict.use_cloud')}
          </button>
          <button type="button" onClick={conflict.keepLocal}>
            {tl('conflict.keep_local')}
          </button>
        </div>
      </div>
    </div>
  );
};
