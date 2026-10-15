import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { GeneratedWidgetModal, fitScale } from './GeneratedWidgetModal';
import { languages } from '../translations/translations';

const language = languages.find((entry) => entry.id === 'pl')!;
const popupUrl = 'https://faceitbanner.test/widget/?username=donk666&design=2026&style=livecard&mode=popup';
const bannerUrl = 'https://faceitbanner.test/widget/?username=donk666&design=2026&style=prime';

const open = (url: string) => render(<GeneratedWidgetModal language={language} url={url} setURL={() => undefined} />).baseElement;

afterEach(() => vi.unstubAllGlobals());

describe('fitScale', () => {
  test('shrinks a wide frame to the room there is and never enlarges it', () => {
    expect(fitScale(960, 1920)).toBe(0.5);
    expect(fitScale(1920, 1920)).toBe(1);
    expect(fitScale(2400, 1920)).toBe(1);
  });

  test('an unmeasured container keeps the frame at full size', () => {
    expect(fitScale(0, 1920)).toBe(1);
  });
});

describe('GeneratedWidgetModal for the popup', () => {
  test('recommends the full-screen OBS source: 1920 x 1080, not the 640 x 520 of a small banner', () => {
    const root = open(popupUrl);
    expect(root.querySelector('.obs-size-value')?.textContent).toBe('1920 × 1080 px');
    const iframe = root.querySelector('.obs-frame iframe') as HTMLIFrameElement;
    expect(iframe.style.width).toBe('1920px');
    expect(iframe.style.height).toBe('1080px');
  });

  test('a normal banner keeps its own recommended size', () => {
    const root = open(bannerUrl);
    expect(root.querySelector('.obs-size-value')?.textContent).not.toBe('1920 × 1080 px');
  });
});

describe('GeneratedWidgetModal preview scales instead of scrolling', () => {
  test('the frame is scaled to the width of its container', () => {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 960 });
    let notify: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    try {
      const root = open(popupUrl);
      act(() => notify());
      const iframe = root.querySelector('.obs-frame iframe') as HTMLIFrameElement;
      expect(iframe.style.transform).toBe('scale(0.5)');
      expect((root.querySelector('.obs-frame .fit-frame') as HTMLElement).style.height).toBe('540px');
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'clientWidth', original);
      else delete (Element.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });

  test('without a measurement the frame is shown at full size', () => {
    const iframe = open(popupUrl).querySelector('.obs-frame iframe') as HTMLIFrameElement;
    expect(iframe.style.transform).toBe('');
  });
});
