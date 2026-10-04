import { Language, tl } from '../translations/translations.ts';

import nukePreview from '../assets/previews/nuke.png';
import miragePreview from '../assets/previews/mirage.png';
import ancientPreview from '../assets/previews/ancient.png';
import dust2Preview from '../assets/previews/dust2.png';
import overpassPreview from '../assets/previews/overpass.png';

type PreviewOption = {
  id: string;
  label: string;
  img: string;
};

const previews: PreviewOption[] = [
  { id: 'nuke', label: 'Nuke', img: nukePreview },
  { id: 'mirage', label: 'Mirage', img: miragePreview },
  { id: 'ancient', label: 'Ancient', img: ancientPreview },
  { id: 'dust2', label: 'Dust2', img: dust2Preview },
  { id: 'overpass', label: 'Overpass', img: overpassPreview },
];

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
        {previews.map((preview) => (
          <button
            type="button"
            key={preview.id}
            aria-pressed={previewBackground === preview.id}
            onClick={() => setPreviewBackground(preview.id)}
          >
            <img src={preview.img} alt="" />
            <span>{tl(language, `generator.preview.${preview.id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
