import { Dispatch, useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator.tsx';
import { SettingKey } from '../settings/manager.ts';
import { CheckIcon } from '../assets/icons/tabler/CheckIcon.tsx';
export const Checkbox = ({
  text,
  setting,
  state,
  setState,
  experimental,
  helpTitle,
}: {
  text: string;
  setting?: SettingKey;
  state?: boolean;
  setState?: Dispatch<boolean>;
  experimental?: boolean;
  helpTitle?: string;
}) => {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);

  if (!tl || !settings) {
    return null;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(state ?? (setting && settings.get(setting)))}
      className={'checkbox'}
      onClick={
        setState !== undefined
          ? () => setState(!state)
          : setting
            ? () => {
                settings.set(setting, !(settings.get(setting) as boolean));
              }
            : () => {}
      }
    >
      <span
        aria-hidden="true"
        className={`check${(state ?? (setting && settings.get(setting))) ? ' checked' : ''}`}
      >
        <CheckIcon />
      </span>
      <span>
        {text}
        {experimental && (
          <span className={'badge'} title={tl('generator.experimental.help')}>
            {tl('generator.experimental')}
          </span>
        )}
        {helpTitle && (
          <span className={'badge help'} title={helpTitle}>
            ?
          </span>
        )}
      </span>
    </button>
  );
};
