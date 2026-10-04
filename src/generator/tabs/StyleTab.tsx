import {
  broadcastPresets,
  colorSchemes,
  resolveBannerStyle,
  styles,
} from '../../../widget/src/styles/styles';
import { ColorPicker } from '../../components/ColorPicker.tsx';
import { useContext, useEffect, useRef, useState } from 'react';
import { Checkbox } from '../../components/Checkbox.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import { LanguageContext, SettingsContext } from '../Generator.tsx';
import { ShowRanking } from '../../../widget/src/widget/Widget.tsx';
import { PresetSettings } from '../../components/PresetSettings';
import { PresetCards } from '../../components/PresetCards';
import {
  BannerRadiusControl,
  BannerSizeControls,
} from '../../components/BannerSizeControls';

export const StyleTab = ({
  username,
  playerAvatar,
  playerBanner,
}: {
  username: string;
  playerAvatar?: string;
  playerBanner?: string;
}) => {
  const customCSSInputRef = useRef<HTMLInputElement>(null);
  const customInlineCSSInputRef = useRef<HTMLTextAreaElement>(null);
  const [showHiddenStyles, setShowHiddenStyles] = useState(false);
  const [isEditingInlineCss, setIsEditingInlineCss] = useState(false);
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const bannerDesign = settings?.get('bannerDesign');
  const currentStyle = settings?.get('style');

  useEffect(() => {
    if (!settings || !bannerDesign || !currentStyle) return;
    const resolved = resolveBannerStyle(currentStyle, bannerDesign);
    if (resolved !== currentStyle) {
      settings.set('style', resolved);
    }
  }, [settings, bannerDesign, currentStyle]);

  if (!settings || !tl) {
    return null;
  }

  const bannerFonts: { id: string; name: string }[] = [
    { id: 'dm_sans', name: 'DM Sans' }, // Zostawione na początku
    { id: 'arial', name: 'Arial' },
    { id: 'comic_sans_ms', name: 'Comic Sans MS' },
    { id: 'courier_new', name: 'Courier New' },
    { id: 'garamond', name: 'Garamond' },
    { id: 'georgia', name: 'Georgia' },
    { id: 'helvetica', name: 'Helvetica' },
    { id: 'impact', name: 'Impact' },
    { id: 'inter', name: 'Inter' },
    { id: 'kick_font', name: 'Kick Font' },
    { id: 'lucida_sans', name: 'Lucida Sans' },
    { id: 'merriweather', name: 'Merriweather' },
    { id: 'montserrat', name: 'Montserrat' },
    { id: 'open_sans', name: 'Open Sans' },
    { id: 'oswald', name: 'Oswald' },
    { id: 'palatino_linotype', name: 'Palatino Linotype' },
    { id: 'playfair_display', name: 'Playfair Display' },
    { id: 'poppins', name: 'Poppins' },
    { id: 'roboto', name: 'Roboto' },
    { id: 'segoe_ui', name: 'Segoe UI' },
    { id: 'tahoma', name: 'Tahoma' },
    { id: 'times_new_roman', name: 'Times New Roman' },
    { id: 'trebuchet_ms', name: 'Trebuchet MS' },
    { id: 'verdana', name: 'Verdana' },
  ];

  const bannerFontFamilies: Record<string, string> = {
    dm_sans: "'DM Sans', sans-serif",
    arial: 'Arial, sans-serif',
    comic_sans_ms: "'Comic Sans MS', cursive",
    courier_new: "'Courier New', monospace",
    garamond: 'Garamond, serif',
    georgia: 'Georgia, serif',
    helvetica: 'Helvetica, Arial, sans-serif',
    impact: 'Impact, sans-serif',
    inter: "'Inter', sans-serif",
    kick_font: "'KickFont', sans-serif",
    lucida_sans: "'Lucida Sans', sans-serif",
    merriweather: "'Merriweather', serif",
    montserrat: "'Montserrat', sans-serif",
    open_sans: "'Open Sans', sans-serif",
    oswald: "'Oswald', sans-serif",
    palatino_linotype: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    playfair_display: "'Playfair Display', serif",
    poppins: "'Poppins', sans-serif",
    roboto: "'Roboto', sans-serif",
    segoe_ui: "'Segoe UI', sans-serif",
    tahoma: 'Tahoma, sans-serif',
    times_new_roman: "'Times New Roman', serif",
    trebuchet_ms: "'Trebuchet MS', sans-serif",
    verdana: 'Verdana, sans-serif',
  };

  const defaultHiddenStyleIds = new Set<string>([
    'terminal',
    'stack',
    'justelo',
    'justelomatches',
    'justelomatchesname',
    'justeloname',
    'horizon',
    'glass',
    'circle',
    'banner',
    'amoled',
  ]);

  const inlineCssSelectors = [
    '.wrapper',
    '.widget',
    '.level',
    '.elo',
    '.ranking',
    '.average',
    '.stat',
    '.progress-bar',
    '.progress',
    '.flag',
  ];

  const animatedOrderOptions = [1, 2, 3];

  const addSelectorSnippet = (selector: string) => {
    const currentCss = String(settings.get('customInlineCSS') || '');
    if (currentCss.includes(selector)) {
      return;
    }

    const snippet = `${selector} {\n  background: red;\n}`;
    const nextCss =
      currentCss.trim().length > 0
        ? `${currentCss.trimEnd()}\n\n${snippet}`
        : snippet;

    settings.set('customInlineCSS', nextCss);

    requestAnimationFrame(() => {
      customInlineCSSInputRef.current?.focus();
      customInlineCSSInputRef.current?.setSelectionRange(
        nextCss.length,
        nextCss.length
      );
    });
  };

  return (
    <>
      <div className={'settings design-version'}>
        <h3 className="card-heading">{tl('studio.design_version')}</h3>
        <div
          className="design-switch"
          role="group"
          aria-label={tl('generator.theme.design')}
        >
          {(['2026', 'legacy'] as const).map((design) => (
            <button
              key={design}
              type="button"
              className="design-switch-option"
              aria-pressed={settings.get('bannerDesign') === design}
              disabled={design === 'legacy' && settings.get('widgetMode') === 'versus'}
              title={
                design === 'legacy' && settings.get('widgetMode') === 'versus'
                  ? tl('generator.theme.design.legacy_locked')
                  : undefined
              }
              onClick={() => {
                settings.set('bannerDesign', design);
                settings.set(
                  'style',
                  resolveBannerStyle(settings.get('style'), design)
                );
              }}
            >
              <span className="design-switch-mark" aria-hidden="true">
                {design === '2026' ? '26' : 'Cl'}
              </span>
              <span className="design-switch-text">
                <strong>{tl(`generator.theme.design.${design}`)}</strong>
                <small>{tl(`generator.theme.design.${design}.tagline`)}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="subtext">
          {settings.get('widgetMode') === 'versus'
            ? tl('generator.theme.design.legacy_locked')
            : tl('generator.theme.design.help')}
        </p>
      </div>
      <div className={'settings'}>
        <h3 className="card-heading">{tl('studio.appearance')}</h3>
        {settings.get('bannerDesign') === '2026' && (
          <PresetCards versus={settings.get('widgetMode') === 'versus'} />
        )}
        <BannerSizeControls />
        <BannerRadiusControl />
        <div className={'setting'}>
          <div className={'flex style-mode-row'}>
            <div>
              <p>{tl('generator.theme.color_scheme')}</p>
              <select
                aria-label={tl('generator.theme.color_scheme')}
                value={settings.get('colorScheme') as string}
                onChange={(e) => settings.set('colorScheme', e.target.value)}
              >
                {colorSchemes.map((scheme) => {
                  return (
                    <option key={scheme} value={scheme}>
                      {tl(`scheme.${scheme}`)}
                    </option>
                  );
                })}
              </select>
            </div>
            {settings.get('bannerDesign') !== '2026' && <div>
              <p>{tl('generator.theme.style')}</p>
              <select
                aria-label={tl('generator.theme.style')}
                value={resolveBannerStyle(
                  settings.get('style'),
                  settings.get('bannerDesign')
                )}
                onChange={(e) => settings.set('style', e.target.value)}
              >
                {styles.map((style) => {
                  if (style.hidden) return;
                  if (settings.get('bannerDesign') === '2026' && !style.modernOnly) return;
                  if (
                    style.modernOnly &&
                    settings.get('bannerDesign') !== '2026'
                  )
                    return;
                  if (!showHiddenStyles && defaultHiddenStyleIds.has(style.id))
                    return;
                  return (
                    <option key={style.id} value={style.id}>
                      {tl(`style.${style.id}`)}{' '}
                      {style.experimental
                        ? `(${tl('generator.experimental')})`
                        : ''}
                    </option>
                  );
                })}
              </select>
              {settings.get('bannerDesign') !== '2026' && <Checkbox
                text={tl('generator.theme.style.show_hidden')}
                state={showHiddenStyles}
                setState={setShowHiddenStyles}
              />}

              {settings.get('style') === 'animated' && (
                <div
                  className={'setting animated-settings'}
                  style={{ marginTop: '8px' }}
                >
                  <p>{tl('generator.theme.animated.animation_type')}</p>
                  <select
                    value={settings.get('animatedDeckAnimation') as string}
                    onChange={(event) => {
                      settings.set('animatedDeckAnimation', event.target.value);
                    }}
                  >
                    <option value={'fade'}>
                      {tl('generator.theme.animated.animation.fade')}
                    </option>
                    <option value={'slide_up'}>
                      {tl('generator.theme.animated.animation.slide_up')}
                    </option>
                    <option value={'zoom'}>
                      {tl('generator.theme.animated.animation.zoom')}
                    </option>
                  </select>

                  <p style={{ marginTop: '8px' }}>
                    {tl('generator.theme.animated.sections_title')}
                  </p>

                  <Checkbox
                    text={tl('generator.theme.animated.section.header')}
                    setting={'animatedDeckShowHeader'}
                  />
                  <Checkbox
                    text={tl('generator.theme.animated.section.stats')}
                    setting={'animatedDeckShowStats'}
                  />
                  <Checkbox
                    text={tl('generator.theme.animated.section.matches')}
                    setting={'animatedDeckShowMatches'}
                  />

                  <p style={{ marginTop: '8px' }}>
                    {tl('generator.theme.animated.order_title')}
                  </p>
                  <div className={'animated-order-row'}>
                    <div className={'animated-order-item'}>
                      <p>{tl('generator.theme.animated.section.header')}</p>
                      <select
                        value={
                          settings.get('animatedDeckOrderHeader') as number
                        }
                        onChange={(event) => {
                          settings.set(
                            'animatedDeckOrderHeader',
                            parseInt(event.target.value)
                          );
                        }}
                      >
                        {animatedOrderOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={'animated-order-item'}>
                      <p>{tl('generator.theme.animated.section.stats')}</p>
                      <select
                        value={settings.get('animatedDeckOrderStats') as number}
                        onChange={(event) => {
                          settings.set(
                            'animatedDeckOrderStats',
                            parseInt(event.target.value)
                          );
                        }}
                      >
                        {animatedOrderOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={'animated-order-item'}>
                      <p>{tl('generator.theme.animated.section.matches')}</p>
                      <select
                        value={
                          settings.get('animatedDeckOrderMatches') as number
                        }
                        onChange={(event) => {
                          settings.set(
                            'animatedDeckOrderMatches',
                            parseInt(event.target.value)
                          );
                        }}
                      >
                        {animatedOrderOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>}
          </div>
        </div>

        {/* Custom CSS */}

        {settings.get('style') === 'custom' && (
          <div className={'setting'}>
            <p>
              {tl('generator.theme.custom_css.title')}{' '}
              <span
                className={'badge'}
                title={tl('generator.experimental.help')}
              >
                {tl('generator.experimental')}
              </span>
            </p>
            <input
              defaultValue={settings.get('customCSS')}
              ref={customCSSInputRef}
              onKeyDown={(e) => {
                if (e.code !== 'Enter') return;
                settings.set(
                  'customCSS',
                  customCSSInputRef.current?.value as string
                );
              }}
            />
            <small>{tl('generator.theme.custom_css.apply')}</small>
          </div>
        )}
      </div>

      <PresetSettings />
      <div className={'settings'}>
        <Checkbox
          text={tl('generator.theme.banner_font.adjust')}
          setting={'adjustBannerFont'}
        />
        {settings.get('adjustBannerFont') && (
          <div className={'setting'}>
            <p>{tl('generator.theme.banner_font')}</p>
            <select
              value={settings.get('bannerFont') as string}
              onChange={(event) => {
                settings.set('bannerFont', event.target.value);
              }}
            >
              {bannerFonts.map((font) => {
                return (
                  <option
                    key={font.id}
                    value={font.id}
                    style={{ fontFamily: bannerFontFamilies[font.id] }}
                  >
                    {font.name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <Checkbox
          text={tl('generator.theme.banner_font_size.adjust')}
          setting={'adjustBannerFontSize'}
        />
        {settings.get('adjustBannerFontSize') && (
          <div className={'setting'}>
            <p style={{ fontWeight: 700, margin: '8px 0 6px' }}>
              {tl('generator.theme.banner_font_size.category')}
            </p>

            <Checkbox
              text={tl('generator.theme.banner_font_size.nickname.adjust')}
              setting={'adjustBannerFontSizeNickname'}
            />
            {settings.get('adjustBannerFontSizeNickname') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeNickname')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeNickname',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeNickname')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.elo.adjust')}
              setting={'adjustBannerFontSizeElo'}
            />
            {settings.get('adjustBannerFontSizeElo') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeElo')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeElo',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeElo')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.elo_suffix.adjust')}
              setting={'adjustBannerFontSizeEloSuffix'}
            />
            {settings.get('adjustBannerFontSizeEloSuffix') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeEloSuffix')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeEloSuffix',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeEloSuffix')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.elo_diff.adjust')}
              setting={'adjustBannerFontSizeEloDiff'}
            />
            {settings.get('adjustBannerFontSizeEloDiff') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeEloDiff')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeEloDiff',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeEloDiff')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.wins_value.adjust')}
              setting={'adjustBannerFontSizeWinsValue'}
            />
            {settings.get('adjustBannerFontSizeWinsValue') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeWinsValue')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeWinsValue',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeWinsValue')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.wins_label.adjust')}
              setting={'adjustBannerFontSizeWinsLabel'}
            />
            {settings.get('adjustBannerFontSizeWinsLabel') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeWinsLabel')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeWinsLabel',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeWinsLabel')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.losses_value.adjust')}
              setting={'adjustBannerFontSizeLossesValue'}
            />
            {settings.get('adjustBannerFontSizeLossesValue') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeLossesValue')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeLossesValue',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeLossesValue')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.losses_label.adjust')}
              setting={'adjustBannerFontSizeLossesLabel'}
            />
            {settings.get('adjustBannerFontSizeLossesLabel') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeLossesLabel')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeLossesLabel',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeLossesLabel')}%
                </p>
              </div>
            )}

            <Checkbox
              text={tl('generator.theme.banner_font_size.statistics.adjust')}
              setting={'adjustBannerFontSizeStatistics'}
            />
            {settings.get('adjustBannerFontSizeStatistics') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_size.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontSizeStatistics')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontSizeStatistics',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontSizeStatistics')}%
                </p>
              </div>
            )}

            {settings.get('showRanking') !== ShowRanking.DISABLED && (
              <>
                <Checkbox
                  text={tl('generator.theme.ranking_font_size.adjust')}
                  setting={'adjustRankingFontSize'}
                />
                {settings.get('adjustRankingFontSize') && (
                  <div className={'flex'} style={{ alignItems: 'center' }}>
                    <p style={{ whiteSpace: 'nowrap' }}>
                      {tl('generator.theme.banner_font_size.percent')}
                    </p>
                    <input
                      type={'range'}
                      value={settings.get('rankingFontSize')}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(event) => {
                        settings.set(
                          'rankingFontSize',
                          parseFloat(event.currentTarget.value)
                        );
                      }}
                    />
                    <p style={{ width: '50px', textAlign: 'right' }}>
                      {settings.get('rankingFontSize')}%
                    </p>
                  </div>
                )}
              </>
            )}

          </div>
        )}
        {settings.get('adjustBannerFont') && (
          <div className={'setting'}>
            <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>
              {tl('generator.theme.banner_font_weight.category')}
            </p>

            <Checkbox
              text={tl('generator.theme.banner_font_weight.nickname.adjust')}
              setting={'adjustBannerFontWeightNickname'}
            />
            {settings.get('adjustBannerFontWeightNickname') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightNickname')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightNickname',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightNickname')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.elo.adjust')}
              setting={'adjustBannerFontWeightElo'}
            />
            {settings.get('adjustBannerFontWeightElo') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightElo')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightElo',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightElo')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.elo_suffix.adjust')}
              setting={'adjustBannerFontWeightEloSuffix'}
            />
            {settings.get('adjustBannerFontWeightEloSuffix') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightEloSuffix')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightEloSuffix',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightEloSuffix')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.elo_diff.adjust')}
              setting={'adjustBannerFontWeightEloDiff'}
            />
            {settings.get('adjustBannerFontWeightEloDiff') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightEloDiff')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightEloDiff',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightEloDiff')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.wins_value.adjust')}
              setting={'adjustBannerFontWeightWinsValue'}
            />
            {settings.get('adjustBannerFontWeightWinsValue') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightWinsValue')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightWinsValue',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightWinsValue')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.wins_label.adjust')}
              setting={'adjustBannerFontWeightWinsLabel'}
            />
            {settings.get('adjustBannerFontWeightWinsLabel') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightWinsLabel')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightWinsLabel',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightWinsLabel')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl(
                'generator.theme.banner_font_weight.losses_value.adjust'
              )}
              setting={'adjustBannerFontWeightLossesValue'}
            />
            {settings.get('adjustBannerFontWeightLossesValue') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightLossesValue')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightLossesValue',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightLossesValue')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl(
                'generator.theme.banner_font_weight.losses_label.adjust'
              )}
              setting={'adjustBannerFontWeightLossesLabel'}
            />
            {settings.get('adjustBannerFontWeightLossesLabel') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightLossesLabel')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightLossesLabel',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightLossesLabel')}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_font_weight.statistics.adjust')}
              setting={'adjustBannerFontWeightStatistics'}
            />
            {settings.get('adjustBannerFontWeightStatistics') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.banner_font_weight.percent')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('bannerFontWeightStatistics')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'bannerFontWeightStatistics',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('bannerFontWeightStatistics')}%
                </p>
              </div>
            )}
          </div>
        )}

        {settings.get('showEloSuffix') && (
          <>
            <div
              style={{
                margin: '16px 0 8px 0',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              {tl('generator.theme.banner_font_size.elo_suffix.category')}
            </div>

            <Checkbox
              text={tl('generator.theme.elo_suffix_spacing.adjust')}
              setting={'adjustEloSuffixSpacing'}
            />

            {settings.get('adjustEloSuffixSpacing') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.elo_suffix_spacing')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('eloSuffixSpacing')}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'eloSuffixSpacing',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('eloSuffixSpacing')}px
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className={'settings'}>
        <Checkbox
          text={tl('generator.theme.level_icon_scale.adjust')}
          setting={'adjustLevelIconScale'}
        />
        {settings.get('adjustLevelIconScale') && (
          <div className={'flex'} style={{ alignItems: 'center' }}>
            <p>{tl('generator.theme.level_icon_scale')}</p>
            <input
              type={'range'}
              value={settings.get('levelIconScale')}
              min={-50}
              max={50}
              step={1}
              disabled={!settings.get('adjustLevelIconScale')}
              onChange={(event) => {
                settings.set(
                  'levelIconScale',
                  parseFloat(event.currentTarget.value)
                );
              }}
            />
            <p style={{ width: '50px', textAlign: 'right' }}>
              {settings.get('levelIconScale') > 0
                ? `+${settings.get('levelIconScale')}%`
                : `${settings.get('levelIconScale')}%`}
            </p>
          </div>
        )}

        {settings.get('showRanking') !== ShowRanking.DISABLED && (
          <>
            <Checkbox
              text={tl('generator.theme.ranking_icon_scale.adjust')}
              setting={'adjustRankingIconScale'}
            />
            {settings.get('adjustRankingIconScale') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p>{tl('generator.theme.ranking_icon_scale')}</p>
                <input
                  type={'range'}
                  value={settings.get('rankingIconScale')}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(event) => {
                    settings.set(
                      'rankingIconScale',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('rankingIconScale')}%
                </p>
              </div>
            )}
          </>
        )}

        {/* Banner background settings */}

        <Checkbox
          text={tl('generator.theme.banner_as_background')}
          state={settings.get('useBannerAsBackground')}
          setState={(value) => {
            settings.set('useBannerAsBackground', value);
            if (value) {
              settings.set('useAvatarAsBackground', false);
            }
          }}
        />
        <Checkbox
          text={tl('generator.theme.avatar_as_background')}
          state={settings.get('useAvatarAsBackground')}
          setState={(value) => {
            settings.set('useAvatarAsBackground', value);
            if (value) {
              settings.set('useBannerAsBackground', false);
            }
          }}
        />

        {(settings.get('useBannerAsBackground') ||
          settings.get('useAvatarAsBackground')) && (
          <>
            <Checkbox
              text={tl('generator.theme.banner_as_background.adjust_opacity')}
              setting={'adjustBackgroundOpacity'}
            />
            {settings.get('adjustBackgroundOpacity') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <input
                  type={'range'}
                  value={settings.get('backgroundOpacity')}
                  min={0.01}
                  max={1}
                  step={0.01}
                  disabled={!settings.get('adjustBackgroundOpacity')}
                  onChange={(event) => {
                    settings.set(
                      'backgroundOpacity',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {Math.round(settings.get('backgroundOpacity') * 100)}%
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.banner_as_background.adjust_blur')}
              setting={'adjustBackgroundBlur'}
            />
            {settings.get('adjustBackgroundBlur') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <input
                  type={'range'}
                  value={settings.get('backgroundBlur')}
                  min={0}
                  max={20}
                  step={0.5}
                  disabled={!settings.get('adjustBackgroundBlur')}
                  onChange={(event) => {
                    settings.set(
                      'backgroundBlur',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('backgroundBlur')}px
                </p>
              </div>
            )}
            {/*<Checkbox
              text={tl('generator.theme.banner_shadow.adjust')}
              setting={'adjustBannerShadow'}
            />
            {settings.get('adjustBannerShadow') && (
              <>
                <ColorPicker
                  text={tl('generator.theme.banner_shadow.color')}
                  setting={'bannerShadowColor'}
                />
                <div className={'flex'} style={{ alignItems: 'center' }}>
                  <p style={{ whiteSpace: 'nowrap' }}>
                    {tl('generator.theme.banner_shadow.opacity')}
                  </p>
                  <input
                    type={'range'}
                    value={settings.get('bannerShadowOpacity')}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(event) => {
                      settings.set(
                        'bannerShadowOpacity',
                        parseFloat(event.currentTarget.value)
                      );
                    }}
                  />
                  <p style={{ width: '50px', textAlign: 'right' }}>
                    {Math.round(settings.get('bannerShadowOpacity') * 100)}%
                  </p>
                </div>
                <div className={'flex'} style={{ alignItems: 'center' }}>
                  <p style={{ whiteSpace: 'nowrap' }}>
                    {tl('generator.theme.banner_shadow.strength')}
                  </p>
                  <input
                    type={'range'}
                    value={settings.get('bannerShadowStrength')}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(event) => {
                      settings.set(
                        'bannerShadowStrength',
                        parseFloat(event.currentTarget.value)
                      );
                    }}
                  />
                  <p style={{ width: '50px', textAlign: 'right' }}>
                    {settings.get('bannerShadowStrength')}%
                  </p>
                </div>
              </>
            )}*/}
            {settings.get('adjustBackgroundOpacity') &&
              settings.get('backgroundOpacity') > 0.5 && (
                <InfoBox
                  style={'warn'}
                  content={
                    <p>
                      {tl(
                        'generator.theme.banner_as_background.readability_warning'
                      )}
                    </p>
                  }
                />
              )}
            {settings.get('useBannerAsBackground') && !playerBanner && (
              <InfoBox
                style={'info'}
                content={
                  <p>
                    {tl('generator.theme.banner_as_background.no_banner', [
                      username,
                    ])}
                  </p>
                }
              />
            )}
            {settings.get('useAvatarAsBackground') && !playerAvatar && (
              <InfoBox
                style={'info'}
                content={
                  <p>
                    {tl('generator.theme.avatar_as_background.no_avatar', [
                      username,
                    ])}
                  </p>
                }
              />
            )}
          </>
        )}
      </div>

      {/* Custom color scheme settings */}

      {settings.get('colorScheme') === 'custom' && (
        <div className={'settings'}>
          <div className={'setting'}>
            <p style={{ fontWeight: 700, marginBottom: '8px' }}>
              {tl('generator.theme.border_options')}
            </p>
            <Checkbox
              text={tl('generator.theme.border_width.adjust')}
              setting={'adjustBorderWidth'}
            />
            {settings.get('adjustBorderWidth') && (
              <div className={'flex'} style={{ alignItems: 'center' }}>
                <p style={{ whiteSpace: 'nowrap' }}>
                  {tl('generator.theme.border_width')}
                </p>
                <input
                  type={'range'}
                  value={settings.get('borderWidth')}
                  min={0}
                  max={12}
                  step={0.25}
                  disabled={!settings.get('adjustBorderWidth')}
                  onChange={(event) => {
                    settings.set(
                      'borderWidth',
                      parseFloat(event.currentTarget.value)
                    );
                  }}
                />
                <p style={{ width: '50px', textAlign: 'right' }}>
                  {settings.get('borderWidth')}px
                </p>
              </div>
            )}
            <Checkbox
              text={tl('generator.theme.statistics_separator.adjust')}
              setting={'adjustStatisticsSeparator'}
            />
            {settings.get('adjustStatisticsSeparator') && (
              <>
                <ColorPicker
                  text={tl('generator.theme.statistics_separator.color')}
                  setting={'customStatisticsSeparatorColor'}
                />
                <div className={'flex'} style={{ alignItems: 'center' }}>
                  <p style={{ whiteSpace: 'nowrap' }}>
                    {tl('generator.theme.statistics_separator.opacity')}
                  </p>
                  <input
                    type={'range'}
                    value={settings.get('customStatisticsSeparatorOpacity')}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!settings.get('adjustStatisticsSeparator')}
                    onChange={(event) => {
                      settings.set(
                        'customStatisticsSeparatorOpacity',
                        parseFloat(event.currentTarget.value)
                      );
                    }}
                  />
                  <p style={{ width: '50px', textAlign: 'right' }}>
                    {Math.round(
                      settings.get('customStatisticsSeparatorOpacity') * 100
                    )}
                    %
                  </p>
                </div>
                <div className={'flex'} style={{ alignItems: 'center' }}>
                  <p style={{ whiteSpace: 'nowrap' }}>
                    {tl('generator.theme.statistics_separator.width')}
                  </p>
                  <input
                    type={'range'}
                    value={settings.get('statisticsSeparatorWidth')}
                    min={0}
                    max={12}
                    step={0.25}
                    disabled={!settings.get('adjustStatisticsSeparator')}
                    onChange={(event) => {
                      settings.set(
                        'statisticsSeparatorWidth',
                        parseFloat(event.currentTarget.value)
                      );
                    }}
                  />
                  <p style={{ width: '50px', textAlign: 'right' }}>
                    {settings.get('statisticsSeparatorWidth')}px
                  </p>
                </div>
              </>
            )}
            <div style={{ marginTop: '16px' }}>
              <ColorPicker
                text={tl('generator.theme.border_color_1')}
                setting={'customBorderColor1'}
              />
            </div>
            <div className={'flex'} style={{ alignItems: 'center' }}>
              <p style={{ whiteSpace: 'nowrap' }}>
                {tl('generator.theme.border_color_1_opacity')}
              </p>
              <input
                type={'range'}
                value={settings.get('customBorderColor1Opacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(event) => {
                  settings.set(
                    'customBorderColor1Opacity',
                    parseFloat(event.currentTarget.value)
                  );
                }}
              />
              <p style={{ width: '50px', textAlign: 'right' }}>
                {Math.round(settings.get('customBorderColor1Opacity') * 100)}%
              </p>
            </div>
            <ColorPicker
              text={tl('generator.theme.border_color_2')}
              setting={'customBorderColor2'}
            />
            <div className={'flex'} style={{ alignItems: 'center' }}>
              <p style={{ whiteSpace: 'nowrap' }}>
                {tl('generator.theme.border_color_2_opacity')}
              </p>
              <input
                type={'range'}
                value={settings.get('customBorderColor2Opacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(event) => {
                  settings.set(
                    'customBorderColor2Opacity',
                    parseFloat(event.currentTarget.value)
                  );
                }}
              />
              <p style={{ width: '50px', textAlign: 'right' }}>
                {Math.round(settings.get('customBorderColor2Opacity') * 100)}%
              </p>
            </div>
            <p style={{ fontWeight: 700, margin: '10px 0 8px' }}>
              {tl('generator.theme.other_options')}
            </p>
            <ColorPicker
              text={tl('generator.theme.text_color')}
              setting={'customTextColor'}
            />
            <ColorPicker
              text={tl('generator.theme.background_color')}
              setting={'customBackgroundColor'}
            />
          </div>
        </div>
      )}

      {/* Background opacity settings */}
      <div className={'settings'}>
        <div className={'setting'}>
          <p>{tl('generator.theme.adjust_opacity')}</p>

          <div className={'flex'} style={{ alignItems: 'center' }}>
            <input
              type={'range'}
              value={settings.get('widgetOpacity')}
              min={0}
              max={1}
              step={0.01}
              onChange={(event) => {
                settings.set(
                  'widgetOpacity',
                  parseFloat(event.currentTarget.value)
                );
              }}
            />

            <p style={{ width: '50px', textAlign: 'right' }}>
              {Math.round(settings.get('widgetOpacity') * 100)}%
            </p>
          </div>
          <small style={{ fontStyle: 'italic' }}>
            {tl('generator.theme.adjust_opacity.requirements')}
          </small>

          <div className={'setting'} style={{ marginTop: '14px' }}>
            <p>{tl('generator.theme.custom_inline_css.title')}</p>
            <textarea
              ref={customInlineCSSInputRef}
              className={'custom-inline-css-input'}
              value={settings.get('customInlineCSS') as string}
              rows={8}
              placeholder={tl('generator.theme.custom_inline_css.placeholder')}
              onFocus={() => setIsEditingInlineCss(true)}
              onBlur={() => {
                setTimeout(() => {
                  setIsEditingInlineCss(false);
                }, 120);
              }}
              onChange={(event) => {
                settings.set('customInlineCSS', event.currentTarget.value);
              }}
            />
            <small style={{ fontStyle: 'italic' }}>
              {tl('generator.theme.custom_inline_css.help')}
            </small>

            {isEditingInlineCss && (
              <InfoBox
                style={'info'}
                content={
                  <div>
                    <p>
                      {tl('generator.theme.custom_inline_css.editing_info')}
                    </p>
                    <div className={'css-selector-chips'}>
                      {inlineCssSelectors.map((selector) => (
                        <button
                          key={selector}
                          type={'button'}
                          className={'css-selector-chip'}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => addSelectorSnippet(selector)}
                        >
                          {selector}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
