import { useId } from 'react';

/** FACEIT skill mark for a season that is still in placements: silver arc and a question mark. */
export const Calibrating = () => {
  const id = useId().replace(/:/g, '');
  const track = `cal-track-${id}`;
  const ring = `cal-ring-${id}`;
  const mark = `cal-mark-${id}`;
  const arc = 'M 6.5 18.4 A 8.4 8.4 0 1 1 17.5 18.4';
  return (
    <svg className="faceit-level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={track} cx="0.5" cy="0.5" r="0.55">
          <stop offset="0.4" stopColor="#5D5D5D" />
          <stop offset="1" stopColor="#242424" />
        </radialGradient>
        <radialGradient id={ring} cx="0" cy="0.9" r="2">
          <stop offset="0.09" stopColor="#2A2A2A" />
          <stop offset="0.38" stopColor="#4A4A4A" />
          <stop offset="0.71" stopColor="#8D8D8D" />
          <stop offset="1" stopColor="#A6A6A6" />
        </radialGradient>
        <linearGradient id={mark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stopColor="#F1F1F1" />
          <stop offset="1" stopColor="#383838" />
        </linearGradient>
      </defs>
      <circle r="50%" cx="50%" cy="50%" fill="#060606" />
      <path d={arc} stroke={`url(#${track})`} strokeWidth="2.4" />
      <path className="calibration" d={arc} stroke={`url(#${ring})`} strokeWidth="2.4" />
      <path
        fill={`url(#${mark})`}
        d="M10.955 13v-.586c0-.224.025-.402.076-.534.05-.132.123-.233.217-.302.101-.069.224-.126.369-.172l.312-.095c.132-.04.23-.077.293-.112.07-.04.114-.097.132-.172.026-.08.038-.195.038-.345 0-.172-.028-.296-.085-.37-.057-.075-.151-.118-.284-.13-.126-.017-.305-.025-.539-.025-.094 0-.208.003-.34.009-.126.005-.262.014-.407.026-.139.005-.274.014-.406.025-.126.006-.237.015-.331.026v-1.086c.176-.029.378-.055.605-.078.227-.028.457-.049.69-.06.24-.011.46-.017.662-.017.322 0 .608.023.86.069.253.046.467.129.644.25.176.115.309.279.397.491.095.207.142.477.142.811 0 .235-.022.434-.066.595-.044.161-.107.293-.189.396-.082.098-.18.178-.293.242-.114.063-.237.117-.369.163l-.312.095c-.107.029-.192.057-.255.086-.063.023-.11.055-.142.095-.025.034-.044.086-.057.155-.006.069-.009.164-.009.284V13h-1.352zm-.123 2v-1.25h1.617V15h-1.617z"
      />
    </svg>
  );
};
