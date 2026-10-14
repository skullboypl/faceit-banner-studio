import { useEffect, useState } from 'react';
import { averageElo, parseRoster } from '../../../shared/banner-modes.mjs';
import { LevelMark } from '../components/LevelMark';
import { lookupRosterCard, type RosterCard } from '../utils/faceit_util';

type Props = {
  roster: string;
  layout: 'lineup' | 'sheet';
  translate: (text: string, args?: string[]) => string;
};

function formatStat(value: number, digits = 0) {
  if (!(value > 0)) return '—';
  return digits ? value.toFixed(digits) : String(Math.round(value));
}

export function TeamBanner({ roster, layout, translate }: Props) {
  const names = parseRoster(roster);
  const [members, setMembers] = useState<RosterCard[]>([]);

  useEffect(() => {
    if (!names.length) {
      setMembers([]);
      return;
    }
    let cancel = false;
    Promise.all(names.map((name) => lookupRosterCard(name))).then((rows) => {
      if (!cancel) setMembers(rows);
    });
    return () => {
      cancel = true;
    };
  }, [names.join('|')]);

  const shown: RosterCard[] = members.length
    ? members
    : names.map((name) => ({ username: name, elo: 0, level: 1, kd: 0, winRate: 0 }));
  const avg = averageElo(shown);

  return (
    <div className={`team-banner team-${layout}`}>
      <header className="team-head">
        <span>{translate('team.kicker')}</span>
        <em>
          {translate('team.avg')} <strong>{avg || '—'}</strong>
        </em>
      </header>
      {shown.length === 0 ? (
        <p className="team-empty">{translate('team.empty')}</p>
      ) : (
        <ol>
          {shown.map((member) => (
            <li key={member.username} data-missing={member.missing ? 'yes' : 'no'}>
              {member.avatar ? <img src={member.avatar} alt="" /> : <i />}
              <LevelMark level={member.level || 1} />
              <span className="team-name">{member.username}</span>
              <p>
                <b>{formatStat(member.elo)}</b>
                <small>ELO</small>
              </p>
              <p>
                <b>{formatStat(member.kd, 2)}</b>
                <small>K/D</small>
              </p>
              <p>
                <b>{member.winRate > 0 ? `${Math.round(member.winRate)}%` : '—'}</b>
                <small>WR</small>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
