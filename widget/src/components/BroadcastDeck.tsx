import { CSSProperties, ReactNode, useEffect, useId, useState } from 'react';

export type BroadcastSlide = { id: string; label: string; content: ReactNode };

export function BroadcastDeck({ slides, seconds, motion, autoplay, glow, intro, title, pauseLabel, playLabel }: {
  slides: BroadcastSlide[];
  seconds: number;
  motion: string;
  autoplay: boolean;
  glow: boolean;
  intro: boolean;
  title: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const [activeId, setActiveId] = useState(slides[0]?.id);
  const [paused, setPaused] = useState(false);
  const [introFinished, setIntroFinished] = useState(!intro);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const instanceId = useId();
  const ids = slides.map((slide) => slide.id).join(',');
  const active = slides.find((slide) => slide.id === activeId) || slides[0];
  const duration = Math.max(3, Math.min(20, Number(seconds) || 6));
  const running = autoplay && !paused && !reducedMotion && introFinished && slides.length > 1;

  useEffect(() => {
    if (!intro) { setIntroFinished(true); return; }
    const timer = window.setTimeout(() => setIntroFinished(true), 6200);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const sequence = ids.split(',').filter(Boolean);
    if (sequence.includes(activeId || '')) return;
    setActiveId(sequence[0]);
  }, [ids, activeId]);

  useEffect(() => {
    if (!running) return;
    const sequence = ids.split(',');
    const timer = window.setTimeout(() => {
      setActiveId(sequence[(sequence.indexOf(active?.id) + 1) % sequence.length]);
    }, duration * 1000);
    return () => window.clearTimeout(timer);
  }, [running, ids, active?.id, duration]);

  if (!active) return null;
  return (
    <div className={`broadcast-deck motion-${motion} ${glow ? 'deck-glow' : ''}`} data-screen={active.id} style={{ '--deck-duration': `${duration}s` } as CSSProperties}>
      <div className="deck-stage">
        {slides.map((slide) => (
          <div
            key={slide.id}
            id={`${instanceId}-${slide.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${instanceId}-${slide.id}-tab`}
            aria-hidden={slide.id !== active.id}
            className={`deck-screen deck-screen--${slide.id} ${slide.id === active.id ? 'is-active' : ''}`}
          >
            {slide.content}
          </div>
        ))}
      </div>
      <div className="deck-foot">
        <div className="deck-rule" aria-hidden="true">
          {running && <i key={`${active.id}-${duration}`} className="deck-rule-fill" />}
        </div>
        <div className="deck-masthead">
          <span className="deck-brand">FACEIT</span>
          <div className="deck-tabs" role="tablist" aria-label={title}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                id={`${instanceId}-${slide.id}-tab`}
                className="deck-tab"
                role="tab"
                aria-selected={slide.id === active.id}
                aria-controls={`${instanceId}-${slide.id}-panel`}
                tabIndex={slide.id === active.id ? 0 : -1}
                onClick={() => setActiveId(slide.id)}
                onKeyDown={(event) => {
                  const next = event.key === 'ArrowRight' ? (index + 1) % slides.length : event.key === 'ArrowLeft' ? (index - 1 + slides.length) % slides.length : event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setActiveId(slides[next].id);
                  document.getElementById(`${instanceId}-${slides[next].id}-tab`)?.focus();
                }}
              >
                {slide.label}
              </button>
            ))}
          </div>
          {autoplay && slides.length > 1 && (
            <button type="button" className="deck-pause" aria-label={paused ? playLabel : pauseLabel} aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? (
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.2 10.2 6 3 10.8z" fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1.2h2.6v9.6H2zm5.4 0H10v9.6H7.4z" fill="currentColor" /></svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
