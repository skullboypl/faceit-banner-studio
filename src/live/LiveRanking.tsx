import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import { getLiveBoard, type LivePlayer } from '../utils/presence';

const REFRESH_MS = 30_000;
const LEVEL_COLOR = ['#d5d5d8', '#22a84a', '#3cb54a', '#8fce3a', '#e2c044', '#e08a2c', '#e05a28', '#d63b4a', '#b44ad6', '#ff5500'];

const flagUrl = (country: string) => `https://flagcdn.com/${country}.svg`;

function faceitProfile(nickname: string) {
  return `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`;
}

export function LiveRanking() {
  const t = useContext(LanguageContext);
  const [players, setPlayers] = useState<LivePlayer[] | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!t) return;
    const previousTitle = document.title;
    document.title = t('live.title');
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const board = await getLiveBoard(controller.signal);
        if (!active) return;
        setPlayers(board.players);
        setOnline(board.online);
        setError(false);
      } catch {
        if (active) setError(true);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.title = previousTitle;
    };
  }, [t]);

  if (!t) return null;

  return (
    <div className="settings live-panel">
      <p className="live-kicker">
        <i />
        {online.toLocaleString()} {t('studio.online_now')}
      </p>
      {error && players === null ? (
        <p className="live-empty">{t('live.error')}</p>
      ) : players && players.length === 0 ? (
        <p className="live-empty">{t('live.empty')}</p>
      ) : (
        <ol className="live-list">
          {(players ?? []).map((player, index) => (
            <li key={`${player.nickname}-${index}`} className={index < 3 ? `live-row live-row--${index + 1}` : 'live-row'}>
              <span className="live-rank">{String(index + 1).padStart(2, '0')}</span>
              {player.country ? (
                <img className="live-flag" src={flagUrl(player.country)} alt="" />
              ) : (
                <span className="live-flag live-flag--empty" />
              )}
              <a className="live-nick" href={faceitProfile(player.nickname)} target="_blank" rel="noreferrer noopener">
                {player.nickname}
              </a>
              {player.level ? (
                <span className="live-level" style={{ color: LEVEL_COLOR[player.level - 1] }}>
                  {player.level}
                </span>
              ) : (
                <span className="live-level" />
              )}
              <strong className="live-elo">{Number.isInteger(player.elo) ? player.elo!.toLocaleString() : '—'}</strong>
            </li>
          ))}
        </ol>
      )}
      <p className="live-note">{t('live.note')}</p>
    </div>
  );
}
