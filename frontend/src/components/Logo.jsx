import { Link } from 'react-router-dom';

const SRC = '/darukaa-dark.avif';

export function LogoMark({ onDark = false, className = 'h-7' }) {
  return (
    <img
      src={SRC}
      alt="Darukaa.Earth"
      width={256}
      height={37}
      decoding="async"
      className={`${className} w-auto ${onDark ? 'brightness-0 invert' : ''}`}
    />
  );
}

export default function Logo({ to = '/', onDark = false, className = 'h-7' }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center" aria-label="Darukaa.Earth home">
      <LogoMark onDark={onDark} className={className} />
    </Link>
  );
}
