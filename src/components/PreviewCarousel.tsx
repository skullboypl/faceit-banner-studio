import { Language, tl } from '../translations/translations.ts';
import { MAP_ART, MAP_PREVIEW_IDS, mapStillLayers } from '../../widget/src/widget/map-art';

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
            <i
              className="map-thumb"
              style={{ backgroundImage: mapStillLayers(MAP_ART[id]) }}
            />
            <span>{tl(language, `generator.preview.${id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
