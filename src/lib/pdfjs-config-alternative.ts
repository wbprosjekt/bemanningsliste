// Alternate PDF.js configuration with CDN fallback

let pdfjsInstance: typeof import('pdfjs-dist') | null = null;
let pdfjsPromise: Promise<typeof import('pdfjs-dist') | null> | null = null;

async function configurePdfjs() {
  if (!pdfjsInstance) {
    return null;
  }

  const workerCandidates = [
    `/pdf.worker.min.js`,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsInstance.version}/build/pdf.worker.min.js`,
    `https://unpkg.com/pdfjs-dist@${pdfjsInstance.version}/build/pdf.worker.min.js`,
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsInstance.version}/pdf.worker.min.js`,
  ];

  for (const src of workerCandidates) {
    try {
      pdfjsInstance.GlobalWorkerOptions.workerSrc = src;
      return pdfjsInstance;
    } catch (error) {
      console.warn('Failed to set PDF.js worker source:', src, error);
    }
  }

  pdfjsInstance.GlobalWorkerOptions.workerSrc = '';
  return pdfjsInstance;
}

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
        pdfjsInstance = lib;
        return configurePdfjs();
      })
      .catch((error) => {
        console.error('Failed to load pdfjs-dist alternative config:', error);
        pdfjsInstance = null;
        return null;
      });
  }

  return pdfjsPromise;
}

export async function loadPdfjsAlternative() {
  return loadPdfjsInternal();
}

export function getPdfjsAlternative() {
  return pdfjsInstance;
}

export default pdfjsInstance;
