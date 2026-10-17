import { createHash } from 'node:crypto';

let version = '';

/** Tells the pages which stylesheet content they go with. Called once by the build, before the pages are written. */
export const useCssVersion = (content: string) => {
  version = content ? createHash('md5').update(content).digest('hex').slice(0, 10) : '';
};

/**
 * The address of docs.css. It carries a fingerprint of the file, so a CDN or a browser that kept an older copy
 * cannot show new pages with old styles: a changed stylesheet is a new address.
 */
export const docsCssHref = () => (version ? `/docs.css?v=${version}` : '/docs.css');
