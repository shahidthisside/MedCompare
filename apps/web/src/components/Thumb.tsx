'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { isPlaceholderImage } from '@/lib/parse';

/** Product image; falls back to the medicine name when there is no real photo or it fails to load. */
export function Thumb({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState<string>();
  const showImage = !!src && !isPlaceholderImage(src) && failed !== src;
  return (
    <div className={clsx('@container relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white dark:border-transparent dark:bg-[#e9eaec]', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-contain p-1.5 dark:mix-blend-multiply" onError={() => setFailed(src)} />
      ) : alt ? (
        <span title={alt} className="px-[8cqw] text-center font-semibold leading-[1.15] text-[#475467]">
          <span className="line-clamp-3 break-words text-[13cqw] @max-[71px]:hidden">{alt}</span>
          <span className="block truncate text-[20cqw] @min-[72px]:hidden">{alt.split(/\s+/)[0]}</span>
        </span>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden className="size-1/3 text-[#d0d5dd]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="M12 6.2v11.6" transform="rotate(-35 12 12)" />
        </svg>
      )}
    </div>
  );
}
