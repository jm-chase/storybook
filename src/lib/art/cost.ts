// Cost model for image generation. Single source of truth so the spike (now)
// and the studio (later) show the same numbers. Gemini 2.5 Flash Image bills
// per generated image; iterations and pages are just more images.

export const COST_PER_IMAGE_USD = 0.039;

export function usd(images: number): string {
  return `$${(images * COST_PER_IMAGE_USD).toFixed(3)}`;
}

/** Images in a book: 1 character + environments + one per page, times an iteration factor. */
export function bookImages(opts: {
  pages: number;
  environments?: number;
  character?: number;
  iterationsPerImage?: number;
}): number {
  const { pages, environments = 1, character = 1, iterationsPerImage = 0 } = opts;
  return Math.round((character + environments + pages) * (1 + iterationsPerImage));
}

export interface Projection {
  label: string;
  images: number;
  cost: string;
}

/** Lean / typical / heavy per-book projections for a given page count. */
export function bookProjections(pages: number): Projection[] {
  const mk = (label: string, iterationsPerImage: number): Projection => {
    const images = bookImages({ pages, iterationsPerImage });
    return { label, images, cost: usd(images) };
  };
  return [
    mk("lean — no iteration", 0),
    mk("typical — ~2 iterations / image", 2),
    mk("heavy — ~5 iterations / image", 5),
  ];
}
