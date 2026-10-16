import { CSSProperties, useEffect, useState } from 'react';
import { averageElo, parseRoster } from '../../../shared/banner-modes.mjs';
import { LevelMark } from '../components/LevelMark';
import { lookupRosterCard, type RosterCard, type SessionCard } from '../utils/faceit_util';
import { TEAM_DEFAULTS, hexToRgb, type TeamOptions, type TeamSort } from './team-options';

type Props = {
  roster: string;
  layout: 'lineup' | 'sheet';
  /** Nickname of the person whose banner this is. Their session record is the one in the header. */
  owner?: string;
  /** Wins and losses since this streaming session started, the same tally the solo banner shows. */
  session?: { wins: number; losses: number; form: ('W' | 'L')[] };
  /** Epoch ms when that session started. Roster rows count their own session from here. */
  sessionStart?: number;
  /** How often the rows are read again, in seconds; 0 reads them once. */
  refreshSeconds?: number;
  options?: TeamOptions;
  translate: (text: string, args?: string[]) => string;
};

/** A number that FACEIT did not send (0) is a dash, never "0" or "NaN". */
function formatStat(value: number, digits = 0) {
  if (!(value > 0)) return '—';
  return digits ? value.toFixed(digits) : String(Math.round(value));
}
const percent = (value: number) => (value > 0 ? `${Math.round(value)}%` : '—');

/** The five newest results, oldest of those on the left. */
function FormPips({ form, label }: { form: ('W' | 'L')[]; label?: string }) {
  const recent = form.slice(0, 5).reverse();
  if (!recent.length) return null;
  return (
    <div className="team-form" aria-label={label} aria-hidden={label ? undefined : true}>
      {recent.map((mark, index) => (
        <i key={`${mark}-${index}`} data-result={mark === 'W' ? 'win' : 'loss'} />
      ))}
    </div>
  );
}

type Column = {
  key: string;
  session?: boolean;
  show: (options: TeamOptions) => boolean;
  label: (translate: Props['translate']) => string;
  value: (member: RosterCard) => string;
};

const played = (member: RosterCard) => (member.session?.matches ?? 0) > 0;
const sessionOf = (member: RosterCard): SessionCard =>
  member.session ?? { wins: 0, losses: 0, matches: 0, kills: 0, hs: 0, avg: 0, adr: 0, kr: 0, winRate: 0, kd: 0 };
const count = (value: number) => String(Math.max(0, Math.round(value) || 0));
const rate = (member: RosterCard, value: number) => (played(member) && value > 0 ? `${Math.round(value)}%` : played(member) ? '0%' : '—');
const average = (member: RosterCard, value: number, digits: number) =>
  played(member) ? value.toFixed(digits) : '—';

/** The stat columns, in the order they are drawn. */
const COLUMNS: Column[] = [
  { key: 'elo', show: (o) => o.elo, label: () => 'ELO', value: (m) => formatStat(m.elo) },
  { key: 'kd', show: (o) => o.kd, label: () => 'K/D', value: (m) => formatStat(m.kd, 2) },
  { key: 'wr', show: (o) => o.winRate, label: () => 'WR', value: (m) => percent(m.winRate) },
  { key: 'hs', show: (o) => o.hs, label: () => 'HS%', value: (m) => percent(m.hs ?? 0) },
  { key: 'adr', show: (o) => o.adr, label: () => 'ADR', value: (m) => formatStat(m.adr ?? 0) },
  { key: 'kr', show: (o) => o.kr, label: () => 'K/R', value: (m) => formatStat(m.kr ?? 0, 2) },
  { key: 'matches', show: (o) => o.matches, label: (t) => t('team.stat.matches'), value: (m) => formatStat(m.matches ?? 0) },
  { key: 'wins', show: (o) => o.wins, label: (t) => t('team.stat.wins'), value: (m) => formatStat(m.wins ?? 0) },
  { key: 'streak', show: (o) => o.streak, label: (t) => t('team.stat.streak'), value: (m) => formatStat(m.streak ?? 0) },
  { key: 's-wins', session: true, show: (o) => o.sessionWins, label: (t) => t('team.stat.session_wins'), value: (m) => count(sessionOf(m).wins) },
  { key: 's-losses', session: true, show: (o) => o.sessionLosses, label: (t) => t('team.stat.session_losses'), value: (m) => count(sessionOf(m).losses) },
  { key: 's-matches', session: true, show: (o) => o.sessionMatches, label: (t) => t('team.stat.session_matches'), value: (m) => count(sessionOf(m).matches) },
  { key: 's-kills', session: true, show: (o) => o.sessionKills, label: (t) => t('team.stat.session_kills'), value: (m) => count(sessionOf(m).kills) },
  { key: 's-hs', session: true, show: (o) => o.sessionHs, label: (t) => t('team.stat.session_hs'), value: (m) => rate(m, sessionOf(m).hs) },
  { key: 's-avg', session: true, show: (o) => o.sessionAvg, label: (t) => t('team.stat.session_avg'), value: (m) => average(m, sessionOf(m).avg, 1) },
  { key: 's-adr', session: true, show: (o) => o.sessionAdr, label: (t) => t('team.stat.session_adr'), value: (m) => average(m, sessionOf(m).adr, 0) },
  { key: 's-kr', session: true, show: (o) => o.sessionKr, label: (t) => t('team.stat.session_kr'), value: (m) => average(m, sessionOf(m).kr, 2) },
  { key: 's-wr', session: true, show: (o) => o.sessionWinRate, label: (t) => t('team.stat.session_wr'), value: (m) => rate(m, sessionOf(m).winRate) },
];

const SORT_VALUE: Record<Exclude<TeamSort, 'order'>, (member: RosterCard) => number> = {
  elo: (m) => m.elo,
  kd: (m) => m.kd,
  wr: (m) => m.winRate,
  hs: (m) => m.hs ?? 0,
  adr: (m) => m.adr ?? 0,
  matches: (m) => m.matches ?? 0,
};

export function TeamBanner({
  roster,
  layout,
  owner = '',
  session = { wins: 0, losses: 0, form: [] },
  sessionStart = 0,
  refreshSeconds = 0,
  options = TEAM_DEFAULTS,
  translate,
}: Props) {
  const names = parseRoster(roster);
  const [members, setMembers] = useState<RosterCard[]>([]);
  const ownerName = owner.trim();

  useEffect(() => {
    if (!names.length) {
      setMembers([]);
      return;
    }
    let cancel = false;
    const load = () =>
      Promise.all(names.map((name) => lookupRosterCard(name, options.matchWindow, sessionStart)))
        .then((rows) => {
          if (!cancel) setMembers(rows);
        })
        .catch(() => {
          /* a failed read keeps the numbers already shown */
        });
    load();
    /* The banner header refreshes on its own; the rows read their own stats, so they need their own timer */
    const timer = refreshSeconds > 0 ? window.setInterval(load, Math.max(10, refreshSeconds) * 1000) : undefined;
    return () => {
      cancel = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [names.join('|'), options.matchWindow, sessionStart, refreshSeconds]);

  const loaded: RosterCard[] = members.length
    ? members
    : names.map((name) => ({ username: name, elo: 0, level: 1, kd: 0, winRate: 0 }));
  const sortBy = options.sort === 'order' ? undefined : SORT_VALUE[options.sort];
  const shown = sortBy ? [...loaded].sort((a, b) => sortBy(b) - sortBy(a)) : loaded;
  const avg = averageElo(shown);
  const avgKnown = shown.length > 0 && shown.every((member) => member.calibrating);
  const columns = COLUMNS.filter((column) => column.show(options));
  const firstSession = columns.find((column) => column.session)?.key;
  const best = shown.reduce((top, member) => Math.max(top, member.elo), 0);
  const topName = options.highlightTop && best > 0 ? shown.find((member) => member.elo === best)?.username : undefined;
  const showOwnerForm = Boolean(options.form && ownerName);

  const style: Record<string, string> = {
    '--team-radius': `${options.radius}px`,
    '--team-opacity': String(options.opacity / 100),
    '--team-scale': String(options.fontScale / 100),
  };
  if (options.panelColor) style['--team-panel-rgb'] = hexToRgb(options.panelColor);
  if (options.textColor) style['--team-text'] = `#${options.textColor}`;
  if (options.barColor) style['--team-bar'] = `#${options.barColor}`;
  if (options.topColor) style['--team-top'] = `#${options.topColor}`;

  return (
    <div
      className={`team-banner team-${layout}${options.density === 'compact' ? ' is-compact' : ''}${options.labels ? '' : ' no-labels'}`}
      data-stats={columns.map((column) => column.key).join(',')}
      data-theme={options.theme}
      data-rows={options.rows}
      data-avatar={options.avatarShape}
      data-animation={options.animation}
      data-panel={options.panelColor ? 'custom' : undefined}
      data-text={options.textColor ? 'custom' : undefined}
      style={style as CSSProperties}
    >
      <header className="team-head">
        {(options.kicker || options.average) && (
          <div className="team-head-lead">
            {options.kicker && <span>{options.title || translate('team.kicker')}</span>}
            {options.average && (
              <em>
                {translate('team.avg')}{' '}
                <span className={avgKnown ? 'elo-stack' : undefined}>
                  <strong>{avg || '—'}</strong>
                  {avgKnown && <small className="elo-known">{translate('widget.elo_known')}</small>}
                </span>
              </em>
            )}
          </div>
        )}
        {showOwnerForm && (
          <div
            className="team-owner-form"
            aria-label={translate('team.session_label', [ownerName, String(session.wins), String(session.losses)])}
          >
            <b>{ownerName}</b>
            <FormPips form={session.form} />
            <span className="team-pill win">
              <b>{session.wins}</b> {translate('widget.wins')}
            </span>
            <span className="team-pill loss">
              <b>{session.losses}</b> {translate('widget.losses')}
            </span>
            <small>{translate('team.session_caption')}</small>
          </div>
        )}
      </header>
      {shown.length === 0 ? (
        <p className="team-empty">{translate('team.empty')}</p>
      ) : (
        <ol>
          {shown.map((member, index) => (
            <li
              key={member.username}
              data-missing={member.missing ? 'yes' : 'no'}
              className={member.username === topName ? 'is-top' : undefined}
              style={{ '--i': index } as CSSProperties}
            >
              {options.rank && <span className="team-rank">{index + 1}</span>}
              {options.avatars && (member.avatar ? <img src={member.avatar} alt="" /> : <i />)}
              {options.levels && (
                <LevelMark level={member.level || 1} ranking={member.ranking} unranked={member.calibrating} />
              )}
              <div className="team-who">
                <span className="team-name">{member.username}</span>
                {options.eloBar && best > 0 && (
                  <span className="team-bar" style={{ width: `${Math.round((member.elo / best) * 100)}%` }} />
                )}
              </div>
              <div className="team-figures">
                {options.playerForm && (member.form?.length ?? 0) > 0 && (
                  <FormPips
                    form={member.form ?? []}
                    label={translate('team.form_short', [String(member.wins ?? 0), String(member.losses ?? 0)])}
                  />
                )}
                {columns.map((column) => (
                  <p
                    key={column.key}
                    className={`team-stat team-stat-${column.key}${column.session ? ' is-session' : ''}${column.key === firstSession ? ' is-session-start' : ''}`}
                  >
                    <b>{column.value(member)}</b>
                    {column.key === 'elo' && member.calibrating && (
                      <small className="elo-known">{translate('widget.elo_known')}</small>
                    )}
                    {options.labels && !(column.key === 'elo' && member.calibrating) && <small>{column.label(translate)}</small>}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
