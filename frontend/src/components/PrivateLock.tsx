import styles from "./PrivateLock.module.css";

/**
 * Small lock glyph shown beside a private world's name. Only viewers who are
 * allowed to read the world (creator or invited member) ever render it.
 */
export default function PrivateLock({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `${styles.lock} ${className}` : styles.lock}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="私密世界观"
    >
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
