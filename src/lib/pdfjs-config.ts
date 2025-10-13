// PDF.js configuration - client-side only
let pdfjsLib: any = null;

// Only load PDF.js on client-side
if (typeof window !== 'undefined') {
  pdfjsLib = require('pdfjs-dist');
  
  // Use .js extension for better Next.js compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export default pdfjsLib;
