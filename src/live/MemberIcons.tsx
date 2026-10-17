import { ReactNode, useId } from 'react';

/** The octagon frame FACEIT draws around its badges; `accent` is the light and main colour of the face, `inner` the dark core. */
function BadgeFrame({
  accent,
  inner,
  size,
  children,
}: {
  accent: [string, string];
  inner: string;
  size: number;
  children: (glyph: string) => ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const gid = (name: string) => `${name}-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="live-badge-icon"
      aria-hidden="true"
    >
      <path
        d="M46.8802 12.8631C46.2683 12.309 45.4708 12.0001 44.6414 12H19.3586C18.474 12.0001 17.6253 12.3518 16.9998 12.9773L12.9773 16.9998C12.3518 17.6253 12.0001 18.474 12 19.3586V44.6414C12.0001 45.5261 12.3518 46.3747 12.9773 47.0002L16.9998 51.0227C17.6253 51.6482 18.474 51.9999 19.3586 52H44.6414C45.5261 51.9999 46.3747 51.6482 47.0002 51.0227L51.0227 47.0002C51.6482 46.3747 51.9999 45.5261 52 44.6414V19.3586C51.9999 18.474 51.6482 17.6253 51.0227 16.9998L47.0002 12.9773L46.8802 12.8631Z"
        fill="#060606"
      />
      <path
        d="M13.667 19.3559C13.667 18.9138 13.8426 18.4898 14.1552 18.1773L18.1792 14.1532C18.4918 13.8406 18.9158 13.665 19.3579 13.665H44.6461C45.0882 13.665 45.5121 13.8406 45.8247 14.1532L49.8488 18.1773C50.1614 18.4898 50.337 18.9138 50.337 19.3559V44.6441C50.337 45.0862 50.1614 45.5102 49.8488 45.8227L45.8247 49.8468C45.5121 50.1594 45.0882 50.335 44.6461 50.335H19.3579C18.9158 50.335 18.4918 50.1594 18.1792 49.8468L14.1552 45.8227C13.8426 45.5102 13.667 45.0862 13.667 44.6441V19.3559Z"
        fill={`url(#${gid('face')})`}
      />
      <path
        d="M44.6465 49.0850V50.3350H19.3574V49.0850H44.6465ZM49.087 44.6446V19.3554C49.0869 19.2451 49.0429 19.1395 48.9649 19.0615L44.9405 15.0371C44.8625 14.9591 44.7568 14.9151 44.6465 14.915H19.3574C19.2472 14.9151 19.1415 14.9591 19.0635 15.0371L15.0391 19.0615C14.9611 19.1395 14.9171 19.2452 14.917 19.3554V44.6446C14.9171 44.7548 14.9611 44.8605 15.0391 44.9385L19.0635 48.9629C19.1415 49.0409 19.2471 49.0849 19.3574 49.085V50.335C18.9709 50.3349 18.5982 50.2008 18.3018 49.958L18.1797 49.8467L14.1553 45.8233C13.8817 45.5497 13.7126 45.1903 13.6748 44.8086L13.667 44.6446V19.3554C13.6671 18.9688 13.802 18.5963 14.0449 18.2998L14.1553 18.1777L18.1797 14.1533C18.4922 13.8409 18.9156 13.6651 19.3574 13.665H44.6465L44.8106 13.6728C45.1923 13.7106 45.5517 13.8797 45.8253 14.1533L49.8487 18.1777C50.1611 18.4902 50.3369 18.9136 50.337 19.3554V44.6446L50.3292 44.8086C50.2914 45.1903 50.1223 45.5497 49.8487 45.8233L45.8253 49.8467L45.7022 49.958C45.448 50.1662 45.1376 50.2948 44.8106 50.3272L44.6465 50.335V49.085C44.7569 49.0849 44.8625 49.0409 44.9405 48.9629L48.9649 44.9385C49.0429 44.8605 49.0869 44.7549 49.087 44.6446Z"
        fill={`url(#${gid('rim')})`}
      />
      <path
        d="M17.8369 20.3933V43.6067L20.3952 46.165H43.6086L46.1669 43.6067V20.3933L43.6086 17.835H20.3952L17.8369 20.3933Z"
        fill={inner}
      />
      <path
        d="M43.6083 17.835L46.1669 20.3936V43.6064L43.6083 46.165H20.3955L17.8369 43.6064V20.3936L20.3955 17.835H43.6083ZM19.0869 20.9112V43.0888L20.9131 44.915H43.0908L44.9169 43.0888V20.9112L43.0908 19.085H20.9131L19.0869 20.9112Z"
        fill={`url(#${gid('edge')})`}
      />
      {children(gid('glyph'))}
      <defs>
        <linearGradient id={gid('face')} x1="32" y1="13.665" x2="32" y2="50.335" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent[0]} />
          <stop offset="0.5" stopColor={accent[1]} />
        </linearGradient>
        <linearGradient id={gid('rim')} x1="32" y1="13.665" x2="32" y2="50.335" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1F1F1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#F1F1F1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gid('edge')} x1="32" y1="17.835" x2="32" y2="46.165" gradientUnits="userSpaceOnUse">
          <stop stopColor="#060606" />
          <stop offset="1" stopColor="#060606" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={gid('glyph')} x1="32" y1="22" x2="32" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent[0]} />
          <stop offset="1" stopColor={accent[1]} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** FACEIT Plus: the lime badge with the double chevron. */
export function PlusIcon({ size = 26 }: { size?: number }) {
  return (
    <BadgeFrame accent={['#DCFF82', '#B4FF00']} inner="#1D2706" size={size}>
      {(glyph) => (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M31.2052 21.2923C31.6933 20.8883 32.4181 20.9112 32.879 21.3656L40.2218 28.6039C40.5183 28.8962 40.7012 29.2821 40.7423 29.6927L40.7511 29.8695V33.9974C40.7511 34.503 40.4467 34.9592 39.9796 35.1527C39.7526 35.2467 39.509 35.2681 39.2775 35.2259L40.2218 36.1566C40.5605 36.4906 40.7511 36.9466 40.7511 37.4222V41.5492C40.7511 42.0548 40.4467 42.5109 39.9796 42.7045C39.5126 42.8979 38.9748 42.7913 38.6173 42.434L32.0021 35.8187L25.3849 42.4359C25.0274 42.7934 24.4897 42.9009 24.0226 42.7074C23.5554 42.5139 23.2511 42.0577 23.2511 41.5521V37.6322C23.2511 37.1652 23.435 36.7167 23.7628 36.3841L24.9757 35.1527C24.6758 35.2761 24.3341 35.2837 24.0226 35.1547C23.5555 34.9611 23.2511 34.505 23.2511 33.9994V30.0795C23.2511 29.6124 23.4349 29.164 23.7628 28.8314L31.1105 21.3783L31.2052 21.2923ZM24.6525 37.2611C24.5552 37.3598 24.5011 37.4936 24.5011 37.6322V41.5521L32.0021 34.0511L39.5011 41.5502V37.4222C39.5011 37.2812 39.4442 37.1463 39.3439 37.0472L32.0011 29.809L24.6525 37.2611ZM24.6525 29.7093C24.5554 29.808 24.5011 29.941 24.5011 30.0795V33.9994L32.0021 26.4984L39.5011 33.9974V29.8705C39.5011 29.7293 39.4444 29.5936 39.3439 29.4945L32.0011 22.2562L24.6525 29.7093Z"
          fill={`url(#${glyph})`}
        />
      )}
    </BadgeFrame>
  );
}

/** FACEIT Premium: the same frame in gold, with a star. */
export function PremiumIcon({ size = 26 }: { size?: number }) {
  return (
    <BadgeFrame accent={['#FFE08A', '#F0A21B']} inner="#2A1C04" size={size}>
      {(glyph) => (
        <path
          d="M32 22.3 L34.59 29.24 L41.99 29.56 L36.18 34.16 L38.17 41.29 L32 37.2 L25.83 41.29 L27.82 34.16 L22.01 29.56 L29.41 29.24Z"
          fill={`url(#${glyph})`}
          stroke="#060606"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      )}
    </BadgeFrame>
  );
}

/** ESEA membership: the frame in ESEA blue with a lettermark (not the official logo). */
export function EseaIcon({ size = 26 }: { size?: number }) {
  return (
    <BadgeFrame accent={['#8FA8FF', '#4B6BE8']} inner="#0E1530" size={size}>
      {(glyph) => (
        <path
          d="M25 23H40V26.4H28.6V30.3H38.6V33.7H28.6V37.6H40V41H25Z"
          fill={`url(#${glyph})`}
        />
      )}
    </BadgeFrame>
  );
}

/** Super Match Token: a small coin with a bolt; deliberately plainer than the plan badges. */
export function TokenIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="live-badge-icon"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" fill="#102a33" stroke="#4fd1c5" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.6" stroke="#4fd1c5" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M13 6.2 8.6 12.6h3l-.9 5.2 4.7-6.6h-3.1Z" fill="#4fd1c5" />
    </svg>
  );
}

/** The Twitch glitch logo. */
export function TwitchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="live-badge-icon"
      aria-hidden="true"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.43l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}
