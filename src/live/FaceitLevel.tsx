import { Level1 } from '../../widget/src/components/levels/Level1';
import { Level2 } from '../../widget/src/components/levels/Level2';
import { Level3 } from '../../widget/src/components/levels/Level3';
import { Level4 } from '../../widget/src/components/levels/Level4';
import { Level5 } from '../../widget/src/components/levels/Level5';
import { Level6 } from '../../widget/src/components/levels/Level6';
import { Level7 } from '../../widget/src/components/levels/Level7';
import { Level8 } from '../../widget/src/components/levels/Level8';
import { Level9 } from '../../widget/src/components/levels/Level9';
import { Level10 } from '../../widget/src/components/levels/Level10';

const icons = [
  Level1,
  Level2,
  Level3,
  Level4,
  Level5,
  Level6,
  Level7,
  Level8,
  Level9,
  Level10,
];
const colors = [
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
];

export function FaceitLevel({
  level,
  label,
}: {
  level?: number;
  label: string;
}) {
  const Icon = Number.isInteger(level) ? icons[(level ?? 0) - 1] : null;
  return (
    <span
      className="live-level"
      role="img"
      aria-label={label}
      title={label}
      style={{ color: colors[(level ?? 0) - 1] }}
    >
      {Icon ? <Icon /> : <span className="live-level-unknown">—</span>}
    </span>
  );
}
