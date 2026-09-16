"use client";

/**
 * Single gray glyph per work category — used by the create-page tiles and by
 * the cover placeholder for works without an image. The consumer sets `--tone`.
 */
export default function WorkTypeIcon({ category }: { category: string }) {
  const svg = {
    viewBox: "0 0 24 24",
    preserveAspectRatio: "xMidYMid meet",
    width: "100%",
    height: "100%",
    "aria-hidden": true,
    focusable: "false",
  } as const;

  switch (category) {
    case "novel":
      return (
        <svg {...svg}>
          <path
            d="M4 20.5 4.8 16.6 15.9 5.5a1.6 1.6 0 0 1 2.3 0l1.3 1.3a1.6 1.6 0 0 1 0 2.3L8.4 20.2 4 20.5z"
            fill="var(--tone)"
          />
          <path
            d="M4 20.5 4.8 16.6 8.4 20.2 4 20.5z"
            fill="var(--tone)"
            fillOpacity="0.45"
          />
          <path
            d="M13.7 7.7 16.3 10.3"
            stroke="rgba(243,239,230,0.9)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "artwork":
      return (
        <svg {...svg}>
          <path
            d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"
            fill="var(--tone)"
          />
          <circle cx="7.6" cy="11.2" r="1.25" fill="var(--tone)" fillOpacity="0.5" />
          <circle cx="10.6" cy="7.4" r="1.25" fill="var(--tone)" fillOpacity="0.5" />
          <circle cx="15.2" cy="8" r="1.25" fill="rgba(243,239,230,0.9)" />
        </svg>
      );
    case "program":
      return (
        <svg {...svg}>
          <path
            d="M8.5 6.5 3.5 12l5 5.5"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 6.5 20.5 12l-5 5.5"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.2 5 10.8 19"
            fill="none"
            stroke="var(--tone)"
            strokeOpacity="0.45"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "audio":
      return (
        <svg {...svg}>
          <g
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M5 10v4" />
            <path d="M9 7v10" />
            <path d="M13 5v14" />
            <path d="M17 8v8" />
          </g>
          <path
            d="M21 10v4"
            stroke="var(--tone)"
            strokeOpacity="0.45"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "video":
      return (
        <svg {...svg}>
          <rect
            x="3"
            y="5.5"
            width="18"
            height="13"
            rx="2.4"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
          />
          <path d="M10.2 9.2 15 12l-4.8 2.8z" fill="var(--tone)" />
        </svg>
      );
    default:
      return null;
  }
}
