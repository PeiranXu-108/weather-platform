import React from 'react';

interface IconProps {
  src: string;
  className?: string;
  title?: string;
}

/**
 * Renders an SVG from `public/` using CSS mask so the icon color follows `currentColor`.
 *
 * Usage:
 * - size: `w-5 h-5`
 * - color: `text-sky-500` (the icon uses `bg-current`)
 * - animation: `animate-spin`
 */
export default function Icon({ src, className = '', title }: IconProps) {
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block bg-current ${className}`}
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}


