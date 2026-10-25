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

const SHAPE = new Set(['circle', 'ellipse', 'path', 'polygon', 'polyline', 'rect', 'line', 'text', 'tspan']);

function painted(color: string): boolean {
  return color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)';
}

/**
 * The plate and the profile cover live on ::after / ::before with a negative z-index.
 * A still drops those, so the preview scene shows through. Paint them as real layers.
 */
function bakeBannerBackground(wrapper: HTMLElement) {
  wrapper.querySelectorAll<HTMLElement>('.widget').forEach((widget) => {
    const plate = getComputedStyle(widget, '::after');
    const cover = getComputedStyle(widget, '::before');
    const plateColor = plate.backgroundColor;
    const coverImage = cover.backgroundImage;
    const hasPlate = plate.content !== 'none' && painted(plateColor);
    const hasCover = cover.content !== 'none' && coverImage !== '' && coverImage !== 'none';
    if (!hasPlate && !hasCover) return;

    if (hasPlate) widget.style.backgroundColor = plateColor;
    if (!hasCover) return;

    const photo = document.createElement('div');
    photo.setAttribute('data-png-cover', '');
    photo.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:0',
      'border-radius:inherit',
      'pointer-events:none',
      `background-image:${coverImage}`,
      'background-size:cover',
      'background-position:center',
      'background-repeat:no-repeat',
      `filter:${cover.filter}`,
      `opacity:${cover.opacity}`,
    ].join(';');
    widget.insertBefore(photo, widget.firstChild);
    Array.from(widget.children).forEach((child) => {
      if (!(child instanceof HTMLElement) || child === photo) return;
      if (getComputedStyle(child).position === 'static') child.style.position = 'relative';
      if (getComputedStyle(child).zIndex === 'auto') child.style.zIndex = '1';
    });
  });
}

/** SVG paint comes from CSS. The still keeps the markup, not the stylesheet, so write the computed paint onto each shape. */
function bakeVectorPaint(root: HTMLElement) {
  root.querySelectorAll<SVGElement>('svg *').forEach((node) => {
    if (!SHAPE.has(node.localName)) return;
    const style = getComputedStyle(node);
    for (const name of ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'color']) {
      const value = style.getPropertyValue(name);
      if (value) node.style.setProperty(name, value);
    }
  });
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
    /* Copied computed styles include print-color-adjust: economy, which drops text color in the raster. */
    wrapper.style.setProperty('print-color-adjust', 'exact');
    wrapper.style.setProperty('-webkit-print-color-adjust', 'exact');
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
    bakeBannerBackground(wrapper);
    bakeVectorPaint(wrapper);
    const quiet = document.createElement('style');
    quiet.textContent = '[data-png-host] .widget::before,[data-png-host] .widget::after{content:none !important;display:none !important;}';
    host.appendChild(quiet);
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
