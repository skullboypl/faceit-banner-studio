import { StudioIcon } from './StudioIcon';

/** Shared brand mark for the generator and administration. */
export function StudioBrand() {
  return (
    <a className="studio-brand" href="/" aria-label="FACEIT Banner Studio">
      <span className="studio-mark" aria-hidden="true">
        <StudioIcon name="layers" />
      </span>
      <span>
        Banner<span className="brand-subtitle">STUDIO / FACEIT</span>
      </span>
    </a>
  );
}
