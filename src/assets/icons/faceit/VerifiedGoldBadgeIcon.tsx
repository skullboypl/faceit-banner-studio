import { useId } from 'react';

export const VerifiedGoldBadgeIcon = () => {
  const id = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      height="24"
      width="24"
      className="icon icon-faceit-verified-gold-badge"
      aria-hidden="true"
    >
      <path
        fill={`url(#${id}-a)`}
        fillRule="evenodd"
        d="M5 5h4l3-3 3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3zm6.098 11.737-5.414-5.684 5.414 1.894 7.218-5.684z"
        clipRule="evenodd"
      />
      <mask
        id={`${id}-c`}
        width="20"
        height="20"
        x="2"
        y="2"
        maskUnits="userSpaceOnUse"
        style={{ maskType: 'alpha' }}
      >
        <path
          fill={`url(#${id}-b)`}
          fillRule="evenodd"
          d="M5 5h4l3-3 3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3zm6.098 11.737-5.414-5.684 5.414 1.894 7.218-5.684z"
          clipRule="evenodd"
        />
      </mask>
      <g mask={`url(#${id}-c)`}>
        <path
          fill={`url(#${id}-d)`}
          d="M25.678.178c-9.964-5.37-19.835-1.61-23.525.941l.062 2.252C8.272 10.572 17.682 14.05 21.63 14.887c4.416-6.392 4.539-12.47 4.048-14.71"
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-a`}
          x1="12"
          x2="12"
          y1="2"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFB4" />
          <stop offset="1" stopColor="#F4982F" />
        </linearGradient>
        <linearGradient
          id={`${id}-b`}
          x1="12"
          x2="12"
          y1="2"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFB4" />
          <stop offset="1" stopColor="#F4982F" />
        </linearGradient>
        <linearGradient
          id={`${id}-d`}
          x1="13.899"
          x2="14.385"
          y1="-2.538"
          y2="15.087"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".35" />
        </linearGradient>
      </defs>
    </svg>
  );
};
