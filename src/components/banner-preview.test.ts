import { describe, expect, test } from 'vitest';
import { TEAM_DEFAULTS, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import type { SettingKey } from '../settings/manager';
import { measureBanner, paintPreviewPage, previewFrame, previewStage, previewUrl } from './banner-preview';

const get = (overrides: Record<string, unknown> = {}) => (key: SettingKey) =>
  Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key]
    : (SETTINGS_DEFINITIONS[key] as { defaultValue?: unknown }).defaultValue;

describe('previewFrame: the saved-banner picture matches the banner, not a leftover OBS slot', () => {
  test('a two-player roster is as wide as its columns and only as tall as two rows', () => {
    const frame = previewFrame(
      get({
        widgetMode: 'team',
        bannerDesign: '2026',
        style: 'lineup',
        teamRoster: 'SkullBoy,SweetGrandpa',
      })
    );
    expect(frame.width).toBe(teamRecommendedWidth(TEAM_DEFAULTS, 'lineup'));
    expect(frame.height).toBe(teamRecommendedHeight(TEAM_DEFAULTS, 'lineup', 2));
    expect(frame.height).toBeLessThan(280);
  });

  test('five players need more height than two, and the sheet is shorter than the lineup', () => {
    const two = previewFrame(get({ widgetMode: 'team', style: 'lineup', teamRoster: 'a,b' }));
    const five = previewFrame(get({ widgetMode: 'team', style: 'lineup', teamRoster: 'a,b,c,d,e' }));
    const sheet = previewFrame(get({ widgetMode: 'team', style: 'sheet', teamRoster: 'a,b,c,d,e' }));
    expect(five.height).toBeGreaterThan(two.height);
    expect(sheet.height).toBeLessThan(five.height);
  });

  test('a saved OBS size is the preview size, not the preset slot', () => {
    const frame = previewFrame(
      get({
        bannerDesign: '2026',
        style: 'prime',
        bannerWidthMode: 'manual',
        bannerWidth: 720,
        bannerHeightMode: 'manual',
        bannerHeight: 160,
      })
    );
    expect(frame.width).toBe(720);
    expect(frame.height).toBe(160);
  });
});

describe('previewUrl: a thumbnail, and a popup always before the match', () => {
  test('marks the widget as a thumbnail and pins a popup to the pre phase', () => {
    const solo = new URL(previewUrl(get({ style: 'prime' }), 'pl', 'https://faceitbanner.test'));
    expect(solo.searchParams.get('thumb')).toBe('true');
    expect(solo.searchParams.get('banner_height_mode')).toBe('recommended');
    const popup = new URL(previewUrl(get({ widgetMode: 'popup' }), 'pl', 'https://faceitbanner.test'));
    expect(popup.searchParams.get('popup_preview')).toBe('pre');
    expect(popup.searchParams.get('thumb')).toBe('true');
  });
});

describe('measureBanner: the painted widget, not the leftover iframe page', () => {
  test('reads the roster panel, not a stretched wrapper around it', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';
    const team = document.createElement('div');
    team.className = 'team-banner';
    wrapper.append(team);
    document.body.append(wrapper);
    wrapper.getBoundingClientRect = () =>
      ({ width: 1100, height: 720, top: 0, left: 0, bottom: 720, right: 1100, x: 0, y: 0, toJSON: () => undefined }) as DOMRect;
    team.getBoundingClientRect = () =>
      ({ width: 640, height: 168, top: 0, left: 0, bottom: 168, right: 640, x: 0, y: 0, toJSON: () => undefined }) as DOMRect;
    Object.defineProperty(team, 'scrollWidth', { value: 640 });
    Object.defineProperty(team, 'scrollHeight', { value: 168 });
    expect(measureBanner(document)).toEqual({ width: 640, height: 168, left: 0, top: 0 });
    wrapper.remove();
  });

  test('a popup card that sits in the middle of the page is cropped from its own corner', () => {
    const popup = document.createElement('div');
    popup.className = 'match-popup';
    const article = document.createElement('article');
    popup.append(article);
    document.body.append(popup);
    article.getBoundingClientRect = () =>
      ({ width: 900, height: 298, top: 40, left: 510, bottom: 338, right: 1410, x: 510, y: 40, toJSON: () => undefined }) as DOMRect;
    Object.defineProperty(article, 'scrollWidth', { value: 900 });
    Object.defineProperty(article, 'scrollHeight', { value: 298 });
    expect(measureBanner(document)).toEqual({ width: 900, height: 298, left: 510, top: 40 });
    popup.remove();
  });

  test('a column that paints past the panel still counts, so the scale does not slice it', () => {
    const team = document.createElement('div');
    team.className = 'team-banner';
    const extra = document.createElement('span');
    team.append(extra);
    document.body.append(team);
    team.getBoundingClientRect = () =>
      ({ width: 440, height: 168, top: 0, left: 0, bottom: 168, right: 440, x: 0, y: 0, toJSON: () => undefined }) as DOMRect;
    extra.getBoundingClientRect = () =>
      ({ width: 80, height: 24, top: 8, left: 620, bottom: 32, right: 700, x: 620, y: 8, toJSON: () => undefined }) as DOMRect;
    Object.defineProperty(team, 'scrollWidth', { value: 440 });
    Object.defineProperty(team, 'scrollHeight', { value: 168 });
    expect(measureBanner(document)).toEqual({ width: 700, height: 168, left: 0, top: 0 });
    team.remove();
  });

  test('a roomy stage is wider than the banner so the painting is not clipped', () => {
    const stage = previewStage({ width: 440, height: 200 });
    expect(stage.width).toBe(1920);
    expect(stage.width).toBeGreaterThan(440);
    expect(previewStage({ width: 1920, height: 1080 })).toEqual({ width: 1920, height: 1080 });
  });

  test('paintPreviewPage drops the white sheet and lets a roster paint past the OBS slot', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper banner-sized';
    document.body.append(wrapper);
    document.documentElement.classList.add('banner-sized');
    paintPreviewPage(document);
    expect(document.documentElement.style.background).toBe('transparent');
    expect(document.body.style.background).toBe('transparent');
    expect(document.documentElement.classList.contains('banner-sized')).toBe(false);
    expect(wrapper.style.width).toBe('max-content');
    expect(wrapper.style.overflow).toBe('visible');
    wrapper.remove();
  });
});
