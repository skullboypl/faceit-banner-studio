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

const MARKS = [Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9, Level10];

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

export function LevelMark({ level, ranking }: { level: number; ranking?: number }) {
  const visual = levelVisual(level, ranking);
  const Icon = visual > 10 ? Challenger : MARKS[visual - 1] ?? Level1;
  if (visual <= 10) return <Icon />;
  return (
    <span
      className="faceit-level-mark"
      data-tier="challenger"
      style={{ color: `var(--faceit-level-${visual}, #e80128)`, display: 'contents' }}
    >
      <Icon />
    </span>
  );
}
