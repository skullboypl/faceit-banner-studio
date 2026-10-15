import { Level1 } from './levels/Level1';
import { Level2 } from './levels/Level2';
import { Level3 } from './levels/Level3';
import { Level4 } from './levels/Level4';
import { Level5 } from './levels/Level5';
import { Level6 } from './levels/Level6';
import { Level7 } from './levels/Level7';
import { Level8 } from './levels/Level8';
import { Level9 } from './levels/Level9';
import { Level10 } from './levels/Level10';
import { Challenger } from './levels/Challenger';
import { Calibrating } from './levels/Calibrating';

const MARKS = [Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9, Level10];

/** Same palette as the banner color scheme, used when the CSS variables are not on an ancestor. */
const LEVEL_COLOR = [
  '#eee',
  '#1CE400',
  '#1CE400',
  '#FFC800',
  '#FFC800',
  '#FFC800',
  '#FFC800',
  '#FF6309',
  '#FF6309',
  '#FE1F00',
  '#e80128',
  '#d9a441',
  '#c7d0d5',
  '#bf7145',
];

/**
 * Visual tier for a level icon. Level 10 in the regional top 1000 is the
 * challenger mark (11), with 12–14 for the podium. There is no second icon.
 */
export function levelVisual(level: number, ranking?: number): number {
  const skill = Math.min(10, Math.max(1, Math.round(level) || 1));
  const place = ranking ?? 0;
  if (skill === 10 && place >= 1 && place <= 1000) {
    if (place === 1) return 12;
    if (place === 2) return 13;
    if (place === 3) return 14;
    return 11;
  }
  return skill;
}

export function LevelMark({ level, ranking, unranked }: { level: number; ranking?: number; unranked?: boolean }) {
  if (unranked) {
    return (
      <span className="faceit-level-mark" data-tier="unranked" style={{ display: 'contents' }}>
        <Calibrating />
      </span>
    );
  }
  const visual = levelVisual(level, ranking);
  const Icon = visual > 10 ? Challenger : MARKS[visual - 1] ?? Level1;
  return (
    <span
      className="faceit-level-mark"
      data-tier={visual > 10 ? 'challenger' : undefined}
      style={{ color: `var(--faceit-level-${visual}, ${LEVEL_COLOR[visual - 1]})`, display: 'contents' }}
    >
      <Icon />
    </span>
  );
}
