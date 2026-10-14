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

const MARKS = [Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9, Level10];

export function LevelMark({ level }: { level: number }) {
  const Icon = MARKS[Math.min(10, Math.max(1, Math.round(level))) - 1] ?? Level1;
  return <Icon />;
}
