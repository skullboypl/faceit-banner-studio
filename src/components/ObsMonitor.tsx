import { ReactNode, useContext } from 'react';
import { LanguageContext } from '../generator/contexts';
import { POPUP_FRAME_WIDTH } from '../../widget/src/widget/popup-options';

/** A small screen showing the whole OBS source (1920 x 1080), so the card is seen where it will really sit. */
export function ObsMonitor({
  cardWidth,
  screenRef,
  children,
}: {
  cardWidth: number;
  /** Receives the screen element, so the owner can measure the card drawn on it. */
  screenRef?: (element: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const tl = useContext(LanguageContext);
  if (!tl) return null;
  const share = Math.round((cardWidth / POPUP_FRAME_WIDTH) * 100);
  return (
    <div className="obs-monitor">
      <div className="obs-monitor-head">
        <strong>{tl('obs.monitor.title')}</strong>
        <span>1920 × 1080</span>
      </div>
      <div className="obs-monitor-screen" ref={screenRef} style={{ aspectRatio: '1920 / 1080' }}>
        {children}
        <i className="obs-monitor-rule obs-monitor-rule--x">1920</i>
        <i className="obs-monitor-rule obs-monitor-rule--y">1080</i>
      </div>
      <p className="subtext">{tl('obs.monitor.card', [String(cardWidth), String(share)])}</p>
    </div>
  );
}
