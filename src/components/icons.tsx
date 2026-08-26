interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const PlusIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);

export const TrashIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

export const SunIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
);

export const ResetIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const WarningIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M10.3 3.9L2.4 17.3A1.9 1.9 0 004 20.2h16a1.9 1.9 0 001.6-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const DownloadIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const UploadIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 8l5-5 5 5M12 3v12" />
  </svg>
);
