// PDF.js configuration helpers
// Lazy-loads pdfjs-dist on the client whenever needed

let pdfjsInstance: typeof import('pdfjs-dist') | null = null;
let pdfjsPromise: Promise<typeof import('pdfjs-dist') | null> | null = null;

async function loadPdfjsInternal(): Promise<typeof import('pdfjs-dist') | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (pdfjsInstance) {
    return pdfjsInstance;
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist')
      .then((mod) => {
        const lib = (mod as any).default ?? mod;
        if (lib?.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        }
        pdfjsInstance = lib;
        return lib;
      })
      .catch((error) => {
        console.error('Failed to load pdfjs-dist:', error);
        pdfjsInstance = null;
        return null;
      });
  }

  return pdfjsPromise;
}

export async function loadPdfjs() {
  return loadPdfjsInternal();
}

export function getPdfjs() {
  return pdfjsInstance;
}

export default pdfjsInstance;
