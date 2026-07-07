// Slim placeholder above the message list. A future avatar component
// (HeyGen, or a local LivePortrait/ACE video — see DISCOVERY.md) mounts
// here as children without touching the surrounding layout.
export default function AvatarBanner({ children }) {
  if (children) return <div className="avatar-banner">{children}</div>;
  return (
    <div className="avatar-banner avatar-banner--placeholder">
      <svg
        className="avatar-banner__icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4v-1z" />
      </svg>
      <span>Avatar coming soon</span>
    </div>
  );
}
