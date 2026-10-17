import { describe, expect, test } from 'vitest';
import { TEAM_DEFAULTS, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import type { SettingKey } from '../settings/manager';
import {
  PREVIEW_ICON_MAX_HEIGHT,
  paintPreviewPage,
  previewFrame,
  previewIconScale,
  previewIconTransform,
  previewSubject,
  previewUrl,
} from './banner-preview';

const get = (overrides: Record<string, unknown> = {}) => (key: SettingKey) =>
  Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key]
    : (SETTINGS_DEFINITIONS[key] as { defaultValue?: unknown }).defaultValue;

describe('previewFrame: a thumbnail is the recommended banner, then CSS-scaled', () => {
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

  test('a saved OBS size is ignored: the thumbnail stays at the recommended width', () => {
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
    const recommended = previewFrame(get({ bannerDesign: '2026', style: 'prime' }));
    expect(frame).toEqual(recommended);
    expect(frame.width).toBeLessThan(720);
  });
});

describe('previewUrl: a thumbnail, and a popup always before the match', () => {
  test('marks the widget as a thumbnail and pins a popup to the pre phase', () => {
    const solo = new URL(previewUrl(get({ style: 'prime' }), 'pl', 'https://faceitbanner.test'));
    expect(solo.searchParams.get('thumb')).toBe('true');
    expect(solo.searchParams.get('banner_width_mode')).toBe('recommended');
    expect(solo.searchParams.get('banner_height_mode')).toBe('recommended');
    const popup = new URL(previewUrl(get({ widgetMode: 'popup' }), 'pl', 'https://faceitbanner.test'));
    expect(popup.searchParams.get('popup_preview')).toBe('pre');
    expect(popup.searchParams.get('thumb')).toBe('true');
  });
});

describe('previewIconScale: a thumbnail is a small icon, never an enlarged widget', () => {
  test('never scales a banner up, and a tall square stays under the icon cap', () => {
    expect(previewIconScale({ width: 320, height: 320 }, 414)).toBeLessThanOrEqual(PREVIEW_ICON_MAX_HEIGHT / 320);
    expect(previewIconScale({ width: 320, height: 320 }, 414)).toBeLessThan(1);
    expect(previewIconScale({ width: 540, height: 250 }, 414)).toBeLessThanOrEqual(414 / 540);
    expect(previewIconScale({ width: 540, height: 250 }, 414)).toBeLessThanOrEqual(PREVIEW_ICON_MAX_HEIGHT / 250);
  });

  test('a popup thumbnail zooms to the card, not the empty 1920 overlay', () => {
    const overlay = previewIconScale({ width: 1920, height: 1080 }, 414);
    const card = previewIconScale({ width: 900, height: 298 }, 414);
    expect(card).toBeGreaterThan(overlay * 2);
    expect(298 * card).toBeLessThanOrEqual(PREVIEW_ICON_MAX_HEIGHT);
  });
});

describe('previewSubject: zoom the popup card, leave other banners on their frame', () => {
  test('reads the article box and builds a translate+scale that pins it to the icon', () => {
    document.body.innerHTML = '<div class="match-popup"><article></article></div>';
    const article = document.querySelector('article')!;
    article.getBoundingClientRect = () =>
      ({ left: 510, top: 41, width: 900, height: 298, x: 510, y: 41, right: 1410, bottom: 339, toJSON: () => {} }) as DOMRect;
    expect(previewSubject(document)).toEqual({ x: 510, y: 41, width: 900, height: 298 });
    expect(previewIconTransform(0.43, { x: 510, y: 41, width: 900, height: 298 })).toBe(
      'scale(0.43) translate(-510px, -41px)'
    );
    expect(previewIconTransform(0.5, null)).toBe('scale(0.5)');
  });

  test('a banner without a popup card has no crop', () => {
    document.body.innerHTML = '<div class="widget banner"></div>';
    expect(previewSubject(document)).toBeNull();
  });
});

describe('paintPreviewPage: no white sheet around the scaled banner', () => {
  test('drops the white sheet', () => {
    paintPreviewPage(document);
    expect(document.documentElement.style.background).toBe('transparent');
    expect(document.body.style.background).toBe('transparent');
  });
});
