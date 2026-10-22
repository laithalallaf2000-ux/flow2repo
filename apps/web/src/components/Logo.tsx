/**
 * The mark reads left to right: a design screen, an orange flow, and a code prompt (›_).
 * Design in, repository out.
 */
export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo__mark" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#EDEBE6" />
        <rect x="6.5" y="7.5" width="15" height="11.5" rx="2.6" fill="none" stroke="#0A0A09" strokeWidth="2.4" />
        <path d="M10.5 11.8h5.5" stroke="#0A0A09" strokeWidth="2.4" strokeLinecap="round" />
        <path
          className="logo__flow"
          d="M14 19c0 6.5 4 9.5 11 9.5"
          fill="none"
          stroke="#FF5A1F"
          strokeWidth="2.8"
          strokeLinecap="round"
          pathLength="1"
        />
        <path
          className="logo__prompt"
          d="M26 23.5l4.5 5-4.5 5M32.5 33.5H35"
          fill="none"
          stroke="#0A0A09"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="logo__text">
        Flow<span className="logo__two">2</span>Repo
      </span>
    </span>
  );
}
