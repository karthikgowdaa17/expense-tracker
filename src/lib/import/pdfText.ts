'use client';

/**
 * PDF text extraction with positional information.
 * Loaded lazily so pdfjs stays out of the initial bundle.
 */

export interface PdfTextItem {
  x: number;
  y: number;
  str: string;
}

/** One visually-joined line of a page, items sorted left-to-right. */
export interface PdfLine {
  page: number;
  y: number;
  items: PdfTextItem[];
  text: string;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * The worker is vendored under /public/vendor (bundler-independent URL).
 * Keep it in sync with the pdfjs-dist version in package.json.
 */
const PDF_WORKER_SRC = '/vendor/pdf.worker.min.mjs';

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

const Y_TOLERANCE = 3;

/**
 * Extracts all text items of the PDF grouped into visually accurate lines
 * (left-to-right items sharing a baseline). Column x positions are preserved
 * so callers can reconstruct table structure.
 */
export async function extractPdfLines(input: ArrayBuffer | Uint8Array): Promise<PdfLine[]> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: input instanceof Uint8Array ? input : new Uint8Array(input) });
  const doc = await loadingTask.promise;

  const allLines: PdfLine[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      const ti = item as { str?: string; transform?: number[] };
      const str = (ti.str ?? '').trim();
      if (!str) continue;
      const t = ti.transform || [0, 0, 0, 0, 0, 0];
      items.push({ x: t[4], y: t[5], str });
    }

    // Group items into lines by y position (same baseline)
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines: PdfLine[] = [];
    let current: PdfTextItem[] = [];
    let currentY: number | null = null;

    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= Y_TOLERANCE) {
        current.push(it);
        currentY = currentY === null ? it.y : currentY;
      } else {
        current.sort((a, b) => a.x - b.x);
        lines.push({ page: pageNum, y: currentY, items: current, text: joinItems(current) });
        current = [it];
        currentY = it.y;
      }
    }
    if (current.length) {
      current.sort((a, b) => a.x - b.x);
      lines.push({ page: pageNum, y: currentY ?? 0, items: current, text: joinItems(current) });
    }

    // Lines are already top-to-bottom due to the y sort above
    allLines.push(...lines);
  }

  await loadingTask.destroy();
  return allLines;
}

/** Join items of one line preserving column separation with heuristic spacing. */
function joinItems(items: PdfTextItem[]): string {
  let out = '';
  let prevEnd: number | null = null;
  for (const it of items) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      if (gap > 2) out += ' ';
      else if (gap > -2 && gap <= 2) out += ' ';
    } else {
      out += ' ';
    }
    out += it.str;
    // Approximate end x: start x + rough char width (5.5px per char at typical 10pt font)
    prevEnd = it.x + Math.max(it.str.length * 4.5, 2);
  }
  return out.trim();
}
