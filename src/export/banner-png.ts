/**
 * A still of the studio preview, for a video edit. The live OBS link keeps updating;
 * this picture does not.
 */

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Oswald:wght@400;500;700&display=swap';

/** Stand-in for a picture the browser cannot read (a flag CDN, an empty src). */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let embeddedFonts: Promise<string> | null = null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Google fonts as data URLs, so the PNG keeps DM Sans instead of a fallback face. Cached after the first save. */
async function fontEmbedCSS(): Promise<string> {
  if (!embeddedFonts) {
    embeddedFonts = (async () => {
      const response = await fetch(FONT_CSS);
      if (!response.ok) throw new Error(String(response.status));
      let css = (await response.text())
        .split('@font-face')
        .filter((block, index) => {
          if (index === 0) return true;
          return !block.includes('unicode-range') || /U\+0000-00FF|U\+0100-02BA|U\+0100-02AF/.test(block);
        })
        .join('@font-face');
      const urls = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1].replace(/["']/g, '')))];
      const data = new Map<string, string>();
      await Promise.all(
        urls.map(async (url) => {
          const file = await fetch(url);
          if (!file.ok) return;
          data.set(url, await blobToDataUrl(await file.blob()));
        })
      );
      for (const [url, encoded] of data) css = css.split(url).join(encoded);
      return css;
    })().catch((error: unknown) => {
      embeddedFonts = null;
      throw error;
    });
  }
  return embeddedFonts;
}

/** The preview theme box. The popup close-up, not the small monitor that repeats it. */
export function stillSource(root: ParentNode = document): HTMLElement | null {
  const theme =
    root.querySelector('.popup-closeup .preview-stage > .preview') ??
    root.querySelector('.preview-card .preview-stage > .preview');
  return theme instanceof HTMLElement ? theme : null;
}

/** Raster of the banner at its own size, transparent around it, with motion held on the resting frame. */
export async function bannerToPng(theme: HTMLElement): Promise<string> {
  const host = document.createElement('div');
  host.setAttribute('data-png-host', '');
  host.style.cssText = 'position:fixed;left:0;top:0;transform:translateX(-100%);pointer-events:none;';
  const copy = theme.cloneNode(true) as HTMLElement;
  host.appendChild(copy);
  document.body.appendChild(host);
  try {
    const wrapper = copy.querySelector('.wrapper');
    if (!(wrapper instanceof HTMLElement)) throw new Error('missing banner');
    wrapper.style.zoom = '1';
    wrapper.style.maxWidth = 'none';
    wrapper.style.animation = 'none';
    wrapper.classList.remove('banner-load-enter');
    copy.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.setProperty('animation', 'none', 'important');
      element.style.setProperty('transition', 'none', 'important');
    });
    /* Deck slides stay clipped until their intro animation finishes. A still wants the open frame. */
    copy.querySelectorAll<HTMLElement>('.deck-screen.is-active').forEach((element) => {
      element.style.setProperty('clip-path', 'none', 'important');
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const fonts = await fontEmbedCSS().catch(() => '');
    const { toPng } = await import('html-to-image');
    const width = wrapper.offsetWidth || wrapper.scrollWidth;
    return await toPng(wrapper, {
      pixelRatio: width > 1200 ? 1 : 2,
      cacheBust: false,
      imagePlaceholder: TRANSPARENT_PIXEL,
      onImageErrorHandler: () => undefined,
      ...(fonts ? { fontEmbedCSS: fonts } : { skipFonts: true }),
    });
  } finally {
    host.remove();
  }
}
