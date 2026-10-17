import { Language, tl } from '../translations/translations.ts';
import { MAP_ART, MAP_PREVIEW_IDS } from '../../widget/src/widget/map-art';

export const PreviewCarousel = ({
  language,
  previewBackground,
  setPreviewBackground,
}: {
  language: Language;
  previewBackground: string;
  setPreviewBackground: (id: string) => void;
}) => {
  return (
    <div
      className="map-selector"
      role="group"
      aria-label={tl(language, 'studio.background')}
    >
      <div className="map-selector-label">
        {tl(language, 'studio.background')}
        <span>{tl(language, 'studio.preview_only')}</span>
      </div>
      <div className="map-options">
        {MAP_PREVIEW_IDS.map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={previewBackground === id}
            onClick={() => setPreviewBackground(id)}
          >
            <img src={MAP_ART[id]} alt="" />
            <span>{tl(language, `generator.preview.${id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
