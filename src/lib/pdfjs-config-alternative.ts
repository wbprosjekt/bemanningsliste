// Alternative PDF.js configuration with better worker handling
let pdfjsLib: any = null;

// Only load PDF.js on client-side
if (typeof window !== 'undefined') {
  pdfjsLib = require('pdfjs-dist');
  
  // Try multiple worker sources for better compatibility
  const workerUrls = [
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  ];
  
  // Use the first worker URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrls[0];
  
  // Fallback: if worker fails, disable it
  try {
    // Test if worker URL is accessible
    fetch(workerUrls[0], { method: 'HEAD' })
      .catch(() => {
        console.warn('PDF.js worker not accessible, using fallback');
        // Disable worker for this session
        pdfjsLib.GlobalWorkerOptions.workerSrc = null;
      });
  } catch (error) {
    console.warn('PDF.js worker setup failed:', error);
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
  }
}

export default pdfjsLib;


