'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, FileText, Trash2, Maximize2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import pdfjsLib from '@/lib/pdfjs-config';
import { supabase } from '@/integrations/supabase/client';
import { useCookieConsent } from '@/components/providers/CookieConsentProvider';

interface Oppgave {
  id: string;
  oppgave_nummer: number;
  fag: string;
  fag_color: string;
  x_position: number;
  y_position: number;
  title?: string;
  description?: string;
  status: 'apen' | 'under_arbeid' | 'lukket';
  prioritet: 'kritisk' | 'høy' | 'medium' | 'lav';
  frist?: string;
  underleverandor_navn?: string;
}

interface Plantegning {
  id: string;
  title: string;
  image_url: string;
  display_order: number;
  oppgaver: Oppgave[];
  file_type?: string; // Add file type to distinguish PDF from images
  rotation?: number; // Rotation in degrees (0, 90, 180, 270)
}

interface PlantegningViewerProps {
  plantegninger: Plantegning[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onOppgaveClick: (oppgave: Oppgave) => void;
  onAddOppgave: (x: number, y: number) => void;
  onUpdateOppgave: (oppgaveId: string, updates: Partial<Oppgave>) => Promise<void>;
  onDeleteOppgave: (oppgaveId: string) => Promise<void>;
  onDeletePlantegning?: (plantegningId: string) => Promise<void>;
}

export default function PlantegningViewer({
  plantegninger,
  currentIndex,
  onClose,
  onNavigate,
  onOppgaveClick,
  onAddOppgave,
  onUpdateOppgave,
  onDeleteOppgave,
  onDeletePlantegning,
}: PlantegningViewerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Viewport state - replaces scale and position
  const [vp, setVp] = useState({ s: 1, tx: 0, ty: 0 }); // Start with 1, will be adjusted by fitToScreen
  const [imgWH, setImgWH] = useState({ W: 0, H: 0 }); // Image dimensions
  
  // Track previous currentIndex to detect navigation
  const prevIndexRef = useRef(currentIndex);
  
  // Pan state for pointer events
  const pan = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [isAddingOppgave, setIsAddingOppgave] = useState(false);
  const [selectedOppgave, setSelectedOppgave] = useState<Oppgave | null>(null);
  const [pdfCanvas, setPdfCanvas] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rotation, setRotation] = useState(0); // Rotation in degrees (0, 90, 180, 270)
  const [showRotationTip, setShowRotationTip] = useState(false); // Show tip for rotation
  const { toast } = useToast();
  const { hasFunctionalConsent } = useCookieConsent();
  const functionalEnabled = hasFunctionalConsent();
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef<boolean>(false);

  const rotationMeta = useMemo(() => {
    const rotationMod = ((rotation % 360) + 360) % 360;
    const halfW = imgWH.W / 2;
    const halfH = imgWH.H / 2;

    const rotateVector = (x: number, y: number) => {
      switch (rotationMod) {
        case 0:
          return { x, y };
        case 90:
          return { x: y, y: -x };
        case 180:
          return { x: -x, y: -y };
        case 270:
          return { x: -y, y: x };
        default: {
          const rad = (rotationMod * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return {
            x: x * cos - y * sin,
            y: x * sin + y * cos,
          };
        }
      }
    };

    const inverseRotateVector = (x: number, y: number) => {
      switch (rotationMod) {
        case 0:
          return { x, y };
        case 90:
          return { x: -y, y: x };
        case 180:
          return { x: -x, y: -y };
        case 270:
          return { x: y, y: -x };
        default: {
          const rad = (-rotationMod * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return {
            x: x * cos - y * sin,
            y: x * sin + y * cos,
          };
        }
      }
    };

    if (imgWH.W === 0 || imgWH.H === 0) {
      return {
        size: { W: imgWH.W, H: imgWH.H },
        offset: { x: 0, y: 0 },
        halfW,
        halfH,
        toAligned: (x: number, y: number) => ({ x, y }),
        fromAligned: (x: number, y: number) => ({ x, y }),
      };
    }

    const corners = [
      rotateVector(-halfW, -halfH),
      rotateVector(halfW, -halfH),
      rotateVector(-halfW, halfH),
      rotateVector(halfW, halfH),
    ];

    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const offset = { x: -minX, y: -minY };

    const toAligned = (x: number, y: number) => {
      const vec = rotateVector(x - halfW, y - halfH);
      return {
        x: vec.x + offset.x,
        y: vec.y + offset.y,
      };
    };

    const fromAligned = (x: number, y: number) => {
      const vec = inverseRotateVector(x - offset.x, y - offset.y);
      return {
        x: vec.x + halfW,
        y: vec.y + halfH,
      };
    };

    return {
      size: { W: maxX - minX, H: maxY - minY },
      offset,
      halfW,
      halfH,
      toAligned,
      fromAligned,
    };
  }, [imgWH.W, imgWH.H, rotation]);

  const currentPlantegning = plantegninger[currentIndex];
  const currentTitle = currentPlantegning?.title ?? 'Uten tittel';
  const currentImageUrl = currentPlantegning?.image_url ?? '';
  const currentOppgaver = currentPlantegning?.oppgaver ?? [];
  const selectedStatusLabel =
    selectedOppgave?.status === 'apen'
      ? 'Åpen'
      : selectedOppgave?.status === 'under_arbeid'
        ? 'Under arbeid'
        : selectedOppgave?.status === 'lukket'
          ? 'Lukket'
          : 'Ukjent status';
  const selectedPriorityLabel =
    selectedOppgave?.prioritet === 'kritisk'
      ? 'Kritisk'
      : selectedOppgave?.prioritet === 'høy'
        ? 'Høy'
        : selectedOppgave?.prioritet === 'medium'
          ? 'Medium'
          : selectedOppgave?.prioritet === 'lav'
            ? 'Lav'
            : 'Ukjent';
  const selectedOppgaveNummer = selectedOppgave ? selectedOppgave.oppgave_nummer : '-';
  const selectedOppgaveFag = selectedOppgave?.fag ?? 'Ukjent fag';

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-fit when image dimensions are available
  useEffect(() => {
    if (imgWH.W > 0 && imgWH.H > 0) {
      setTimeout(() => {
        fitToScreen();
      }, 100); // Slightly longer delay to ensure container is ready
    }
  }, [imgWH.W, imgWH.H]);

  // Handle zoom and prevent browser zoom on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Smooth wheel zoom with Math.pow (increased from 1.0015 to 1.0025 for better responsiveness)
    const handleWheelCombined = (e: WheelEvent) => {
      e.preventDefault(); // Always prevent default (browser zoom)
      
      if (!containerRef.current || imgWH.W === 0 || imgWH.H === 0) return;
      
      const delta = e.deltaMode === 1 ? e.deltaY * 15 : e.deltaY; // normalize
      const factor = Math.pow(1.003, -delta); // smooth zoom (increased from 1.0025 to 1.003 for better responsiveness)
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      setVp(v => {
        if (imgWH.W === 0 || imgWH.H === 0) {
          return v;
        }

        const sNew = Math.max(0.1, Math.min(6, v.s * factor));

        // screen -> aligned coordinates (after scale/viewport)
        const alignedX = (cx - v.tx) / v.s;
        const alignedY = (cy - v.ty) / v.s;

        const imagePoint = rotationMeta.fromAligned(alignedX, alignedY);
        const alignedAfter = rotationMeta.toAligned(imagePoint.x, imagePoint.y);

        return {
          s: sNew,
          tx: cx - alignedAfter.x * sNew,
          ty: cy - alignedAfter.y * sNew,
        };
      });
    };

    // Add non-passive wheel listener with zoom logic
    container.addEventListener('wheel', handleWheelCombined, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelCombined);
    };
  }, [imgWH.W, imgWH.H, rotation]); // Depend on image dimensions and rotation

  // Handle pinch-to-zoom for touch devices (iPad, tablets, phones)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialTouchDistance = 0;
    let initialScale = 1;
    let pinchCenter = { x: 0, y: 0 };
    let initialVp = { s: 1, tx: 0, ty: 0 };

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: TouchList, rect: DOMRect) => {
      if (touches.length < 2) return { x: 0, y: 0 };
      return {
        x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
        y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialTouchDistance = getTouchDistance(e.touches);
        const rect = container.getBoundingClientRect();
        pinchCenter = getTouchCenter(e.touches, rect);
        
        // Store initial viewport state
        initialVp = vpRef.current;
        initialScale = initialVp.s;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && imgWH.W > 0 && imgWH.H > 0 && initialTouchDistance > 0) {
        e.preventDefault();
        
        const currentDistance = getTouchDistance(e.touches);
        
        // Calculate scale factor relative to initial distance
        const scaleFactor = currentDistance / initialTouchDistance;
        const newScale = Math.max(0.1, Math.min(6, initialScale * scaleFactor));
        const alignedX = (pinchCenter.x - initialVp.tx) / initialVp.s;
        const alignedY = (pinchCenter.y - initialVp.ty) / initialVp.s;
        const imagePoint = rotationMeta.fromAligned(alignedX, alignedY);
        const alignedAfter = rotationMeta.toAligned(imagePoint.x, imagePoint.y);
        
        // Calculate new translation to keep pinch center fixed
        const newTx = pinchCenter.x - alignedAfter.x * newScale;
        const newTy = pinchCenter.y - alignedAfter.y * newScale;
        
        setVp({
          s: newScale,
          tx: newTx,
          ty: newTy,
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialTouchDistance = 0;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [imgWH.W, imgWH.H, rotation]);

  // Save viewport to ref whenever it changes
  const vpRef = useRef(vp);
  useEffect(() => {
    vpRef.current = vp;
  }, [vp]);

  // Reset viewport and image state ONLY when user navigates (currentIndex changes)
  useEffect(() => {
    // Only reset if currentIndex actually changed (navigation), not on data updates
    if (prevIndexRef.current !== currentIndex) {
      prevIndexRef.current = currentIndex;
      
      setVp({ s: 1, tx: 0, ty: 0 });
      setImgWH({ W: 0, H: 0 });
      setImageLoaded(false);
      setImageError(false);
      setPdfCanvas(null);
      setIsPdf(false);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      isRenderingRef.current = false;
    }
  }, [currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      isRenderingRef.current = false;
    };
  }, []);

  // Handle Escape key to close viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load PDF and render to canvas
  useEffect(() => {
    console.log('🔄 PlantegningViewer useEffect triggered:', {
      file_type: currentPlantegning?.file_type,
      has_image_url: !!currentImageUrl,
      current_title: currentPlantegning?.title
    });
    
    if (currentPlantegning?.file_type === 'pdf' && currentImageUrl) {
      console.log('📄 Loading PDF...');
      loadAndRenderPDF();
    } else if (currentPlantegning?.file_type === 'image') {
      console.log('🖼️ Loading image...');
      setIsPdf(false);
      setImageLoaded(false);
      setImageError(false);
    } else {
      console.log('⚠️ Unknown file type or no URL');
    }
    
    // Set rotation from plantegning
    if (currentPlantegning?.rotation !== undefined) {
      setRotation(currentPlantegning.rotation);
    }
  }, [currentPlantegning, currentImageUrl]);
  
  // Re-fit to screen when rotation changes (only when dialogen åpnes igjen)
  useEffect(() => {
    console.log('🔄 Rotation changed:', rotation, 'imageLoaded:', imageLoaded, 'imgWH.W:', imgWH.W);
    if (imageLoaded && imgWH.W > 0) {
      console.log('✅ Running fitToScreen after rotation change (from useEffect)');
      // Small delay to ensure dimensions are set
      setTimeout(() => {
        fitToScreen();
      }, 50);
    } else {
      console.log('❌ Cannot run fitToScreen:', { imageLoaded, imgWH_W: imgWH.W });
    }
  }, [rotation]); // Re-fit when rotation changes (for when dialogen åpnes igjen)
  
  // Show rotation tip on first open (only if 0 oppgaver)
  useEffect(() => {
    if (!functionalEnabled) {
      setShowRotationTip(false);
      return;
    }

    if (currentOppgaver.length === 0 && !showRotationTip) {
      // Check if user has dismissed this tip before
      const tipDismissed = localStorage.getItem('rotation-tip-dismissed');
      if (!tipDismissed) {
        setShowRotationTip(true);
      }
    }
  }, [currentOppgaver.length, showRotationTip, functionalEnabled]);

  const loadAndRenderPDF = async () => {
    // Prevent multiple simultaneous renders
    if (isRenderingRef.current) {
      console.log('Render already in progress, skipping...');
      return;
    }

    if (!currentPlantegning || !currentImageUrl) {
      setImageError(true);
      isRenderingRef.current = false;
      return;
    }
    
    try {
      isRenderingRef.current = true;
      setIsPdf(true);
      setImageLoaded(false);
      setImageError(false);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        console.log('Cancelling previous render task');
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.log('Error cancelling task:', e);
        }
        renderTaskRef.current = null;
      }
      
      // Check if pdfjsLib is loaded
      if (!pdfjsLib) {
        console.error('PDF.js not loaded');
        setImageError(true);
        isRenderingRef.current = false;
        return;
      }
      
      // Load PDF
      const loadingTask = pdfjsLib.getDocument(currentImageUrl);
      const pdf = await loadingTask.promise;
      
      // Get first page
      const page = await pdf.getPage(1);
      
      // Create a NEW canvas element for each render to avoid conflicts
      const tempCanvas = document.createElement('canvas');
      const context = tempCanvas.getContext('2d');
      if (!context) {
        isRenderingRef.current = false;
        return;
      }
      
      // Calculate scale to fit container with high DPI support
      const containerWidth = containerRef.current?.clientWidth || 800;
      const containerHeight = containerRef.current?.clientHeight || 600;
      
      // Get device pixel ratio for Retina/HiDPI displays
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Calculate base scale to fit container
      const viewport = page.getViewport({ scale: 1 });
      const baseScale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
      
      // Multiply by pixel ratio for high-resolution rendering (2x for Retina, 3x for higher DPI)
      const highResScale = baseScale * pixelRatio * 1.5; // Extra 1.5x for better quality
      const scaledViewport = page.getViewport({ scale: highResScale });
      
      // Set canvas size to high-resolution
      tempCanvas.width = scaledViewport.width;
      tempCanvas.height = scaledViewport.height;
      
      // Render PDF page to temporary canvas
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        canvas: tempCanvas,
      };
      
      const newRenderTask = page.render(renderContext);
      renderTaskRef.current = newRenderTask;
      
      await newRenderTask.promise;
      
      // Set image dimensions BEFORE setting the canvas
      setImgWH({ W: scaledViewport.width, H: scaledViewport.height });
      
      // Convert canvas to data URL with high quality
      const dataUrl = tempCanvas.toDataURL('image/png', 1.0); // 1.0 = maximum quality
      setPdfCanvas(dataUrl);
      setImageLoaded(true);
      renderTaskRef.current = null;
      isRenderingRef.current = false;
      
      // Auto-fit to screen after PDF loads
      setTimeout(() => {
        fitToScreen();
      }, 50); // Small delay to ensure image is rendered
    } catch (error: any) {
      // Ignore cancellation errors
      if (error.name === 'RenderingCancelledException') {
        console.log('Rendering cancelled');
      } else {
        console.error('Error loading PDF:', error);
        setImageError(true);
      }
      renderTaskRef.current = null;
      isRenderingRef.current = false;
    }
  };

  const handleImageLoad = () => {
    if (!imageRef.current || !containerRef.current) return;
    
    const W = imageRef.current.naturalWidth;
    const H = imageRef.current.naturalHeight;
    
    setImgWH({ W, H });
    setImageLoaded(true);
    setImageError(false);
    
    // Auto-fit to screen for all devices - use fitToScreen function for consistency
    setTimeout(() => {
      fitToScreen();
    }, 50); // Small delay to ensure dimensions are set
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };
  
  // Helper function to get display dimensions based on rotation
  const getDisplayDimensions = () => rotationMeta.size;

  // Removed handleWheel - now handled in useEffect with addEventListener

  // Pointer events for smooth pan
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent default behavior
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    pan.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pan.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    
    setVp(v => ({ 
      ...v, 
      tx: v.tx + dx, 
      ty: v.ty + dy 
    }));
    
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    pan.current = false;
  };

  // State for delayed click handling
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pendingClickPosition, setPendingClickPosition] = useState<{x: number, y: number} | null>(null);

  const handleContainerClick = (e: React.MouseEvent) => {
    // If we have a pending click, cancel it
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      setPendingClickPosition(null);
    }

    if (isAddingOppgave && containerRef.current && imgWH.W > 0 && imgWH.H > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      
      const { offset, size } = rotationMeta;
      
      console.log('🖱️ handleContainerClick:', {
        rotation,
        imgWH: { W: imgWH.W, H: imgWH.H },
        displayDims: size,
        offset,
        vp: { s: vp.s, tx: vp.tx, ty: vp.ty },
        clickPos: { cx, cy }
      });
      
      const alignedX = (cx - vp.tx) / vp.s;
      const alignedY = (cy - vp.ty) / vp.s;
      const imagePoint = rotationMeta.fromAligned(alignedX, alignedY);
      const u = imagePoint.x / imgWH.W;
      const v = imagePoint.y / imgWH.H;
      
      console.log('📍 Calculated coordinates:', { u, v, imageX: imagePoint.x, imageY: imagePoint.y });
      
      const withinBounds = u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01;
      
      // Only proceed if click is within bounds
      if (withinBounds) {
        const clampedU = Math.min(Math.max(u, 0), 1);
        const clampedV = Math.min(Math.max(v, 0), 1);
        // Convert to percentage for storage
        const x = clampedU * 100;
        const y = clampedV * 100;
        
        console.log('✅ Adding oppgave at:', { x, y });
        
        // Show pending position immediately
        setPendingClickPosition({ x, y });
        
        // Set new timeout for delayed placement (300ms)
        const timeout = setTimeout(() => {
          onAddOppgave(x, y);
          setIsAddingOppgave(false);
          setPendingClickPosition(null);
        }, 300);

        setClickTimeout(timeout);
      } else {
        console.log('❌ Click outside bounds:', { u, v });
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  const handleDeleteOppgave = async () => {
    if (!selectedOppgave) return;

    setIsDeleting(true);
    try {
      await onDeleteOppgave(selectedOppgave.id);

      toast({
        title: 'Oppgave slettet',
        description: 'Oppgaven ble slettet.',
      });

      setSelectedOppgave(null);
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Error deleting oppgave:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke slette oppgave: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fitToScreen = () => {
    if (!containerRef.current || imgWH.W === 0 || imgWH.H === 0) {
      console.log('❌ fitToScreen: Cannot fit - no container or image dimensions');
      return;
    }
    
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    
    // Get display dimensions based on rotation
    const { W: displayW, H: displayH } = getDisplayDimensions();
    if (displayW === 0 || displayH === 0) {
      console.log('❌ fitToScreen: Display dimensions unavailable', { displayW, displayH });
      return;
    }
    
    console.log('📐 fitToScreen:', {
      rotation,
      imgWH: { W: imgWH.W, H: imgWH.H },
      displayDims: { W: displayW, H: displayH },
      container: { W: cW, H: cH }
    });
    
    const s = Math.min(cW / displayW, cH / displayH) * 0.9;
    const tx = (cW - displayW * s) / 2;
    const ty = (cH - displayH * s) / 2;
    
    console.log('📊 fitToScreen result:', { s, tx, ty });
    
    setVp({ s, tx, ty });
  };

  const zoomIn = () => setVp(v => ({ ...v, s: Math.min(6, v.s * 1.2) }));
  const zoomOut = () => setVp(v => ({ ...v, s: Math.max(0.1, v.s / 1.2) }));
  const resetZoom = () => {
    fitToScreen(); // This will set scale to optimal fit-to-screen (100% in our new display)
  };
  
  const rotateImage = async () => {
    if (currentOppgaver.length > 0) {
      toast({
        title: 'Kan ikke rotere',
        description: 'Rotasjon kan kun endres når plantegningen har 0 oppgaver',
        variant: 'destructive',
      });
      return;
    }

    const previousRotation = rotation;
    const newRotation = (previousRotation + 90) % 360;
    setRotation(newRotation);

    console.log('🔄 rotateImage called, newRotation:', newRotation);

    try {
      const { error } = await supabase
        .from('plantegninger')
        .update({ rotation: newRotation })
        .eq('id', currentPlantegning.id);

      if (error) {
        throw error;
      }

      console.log('✅ Rotation saved to database');
      currentPlantegning.rotation = newRotation;
    } catch (error) {
      console.error('❌ Error saving rotation:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke lagre rotasjon',
        variant: 'destructive',
      });
      setRotation(previousRotation);
      currentPlantegning.rotation = previousRotation;
    }
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'apen': return 'bg-amber-100 border-amber-500 text-amber-700';
      case 'under_arbeid': return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'lukket': return 'bg-green-100 border-green-500 text-green-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getPriorityColor = (prioritet?: string | null) => {
    switch (prioritet) {
      case 'kritisk': return 'border-red-500 bg-red-50';
      case 'høy': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'lav': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getFagColor = (color?: string | null) => {
    return color && color.trim().length > 0 ? color : '#6366f1';
  };


  if (!currentPlantegning) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Ingen plantegning funnet</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Lukk visning
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Ingen plantegning å vise.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div 
      className="fixed inset-0 z-[50] bg-background flex flex-col"
      style={{
        touchAction: 'none', // Disable all touch gestures at root level
      }}
    >
      {/* Screen reader accessibility */}
      <div className="sr-only">
        <h1>Plantegning Viewer</h1>
        <p>Viser plantegning med interaktive oppgave-punkter. Bruk zoom-kontroller og klikk på plantegningen for å legge til oppgaver.</p>
      </div>
          {/* Minimal Header - Mobile Optimized */}
          <div className="flex items-center justify-between p-2 sm:p-4 border-b bg-background">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              {/* Navigation */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(currentIndex + 1)}
                  disabled={currentIndex === plantegninger.length - 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Title */}
              <div className="flex items-center space-x-2 min-w-0">
                {isPdf ? (
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <div className="h-4 w-4 sm:h-5 sm:w-5 rounded bg-gray-300 flex-shrink-0"></div>
                )}
                <h2 className="text-sm sm:text-xl font-semibold truncate">{currentTitle}</h2>
              </div>
              
              {/* Counter */}
              <Badge variant="outline" className="hidden sm:inline-flex">
                {currentIndex + 1} av {plantegninger.length}
              </Badge>
              
              {/* Mobile Counter */}
              <Badge variant="outline" className="sm:hidden text-xs">
                {currentIndex + 1}/{plantegninger.length}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              
              {/* Zoom controls */}
              <div className="flex items-center space-x-1 border-l pl-2">
                <Button variant="outline" size="sm" onClick={zoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={zoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetZoom}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={rotateImage} 
                  title={currentOppgaver.length > 0 ? "Kan ikke rotere når det er oppgaver" : "Roter 90°"}
                  disabled={currentOppgaver.length > 0}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  {(() => {
                    if (!containerRef.current || rotationMeta.size.W === 0 || rotationMeta.size.H === 0) {
                      return '100%';
                    }
                    
                    // Calculate optimal fit-to-screen scale (same logic as fitToScreen)
                    const cW = containerRef.current.clientWidth;
                    const cH = containerRef.current.clientHeight;
                    const optimalScale = Math.min(
                      cW / rotationMeta.size.W,
                      cH / rotationMeta.size.H
                    ) * 0.9;
                    
                    // Show percentage relative to optimal scale
                    const percentage = Math.round((vp.s / optimalScale) * 100);
                    return `${percentage}%`;
                  })()}
                </span>
              </div>
              
              {/* Add oppgave button - Desktop only */}
              <Button
                variant={isAddingOppgave ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAddingOppgave(!isAddingOppgave)}
                className="hidden sm:flex"
              >
                <Plus className="h-4 w-4 mr-1" />
                {isAddingOppgave ? 'Avbryt' : 'Legg til oppgave'}
              </Button>
              
              {/* Close button - Mobile optimized */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose} 
                className="h-8 w-8 p-0 sm:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
              
              {/* Desktop close button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClose} 
                className="hidden sm:flex border-l ml-2 pl-2"
              >
                <X className="h-4 w-4 mr-1" />
                Lukk visning
              </Button>
            </div>
          </div>

          {/* Image container */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-gray-100 pb-16 sm:pb-0" // Reduced padding for compact mobile bottom sheet
            style={{ 
              touchAction: 'pan-x pan-y', // Allow panning but handle pinch-zoom ourselves
              userSelect: 'none', // Prevent text selection
              WebkitUserSelect: 'none',
            }}
          >
            {imageError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-500 mb-2">Kunne ikke laste plantegning</p>
                  <p className="text-sm text-muted-foreground">
                    Sjekk at filen eksisterer og er et gyldig format
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Interaction overlay - catches all pointer events */}
                <div
                  className="absolute inset-0"
                  style={{
                    cursor: isAddingOppgave ? 'crosshair' : pan.current ? 'grabbing' : 'grab',
                    zIndex: 10,
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onClick={handleContainerClick}
                />
                
                {/* Viewport wrapper with transform */}
                <div
                  className="absolute"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: imgWH.W || 800, // Fallback width
                    height: imgWH.H || 600, // Fallback height
                    transform: `translate(${vp.tx}px, ${vp.ty}px) scale(${vp.s}) translate(${rotationMeta.offset.x}px, ${rotationMeta.offset.y}px) rotate(${rotation}deg) translate(${-rotationMeta.halfW}px, ${-rotationMeta.halfH}px)`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                    pointerEvents: 'none', // Let overlay handle all events
                  }}
                >
                  {/* Image for regular images */}
                  {!isPdf && (
                    <img
                      ref={imageRef}
                      src={currentImageUrl}
                      alt={currentTitle}
                      className={cn(
                        "block transition-opacity duration-300",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                      style={{
                        width: imgWH.W,
                        height: imgWH.H,
                        display: 'block',
                        pointerEvents: 'none',
                      }}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      draggable={false}
                    />
                  )}
                  
                  {/* Rendered PDF image */}
                  {isPdf && pdfCanvas && (
                    <img
                      ref={imageRef}
                      src={pdfCanvas}
                      alt={currentTitle}
                      className={cn(
                        "block transition-opacity duration-300",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                      style={{
                        width: imgWH.W,
                        height: imgWH.H,
                        display: 'block',
                        pointerEvents: 'none',
                      }}
                      draggable={false}
                    />
                  )}
                </div>
                
                {/* Oppgave markers - OUTSIDE viewport wrapper, screen-space positioning */}
                {imageLoaded && imgWH.W > 0 && imgWH.H > 0 && currentOppgaver.map((oppgave) => {
                  const oppgaveNummer = oppgave.oppgave_nummer;
                  const u = oppgave.x_position / 100;
                  const v = oppgave.y_position / 100;
                  const imageX = u * imgWH.W;
                  const imageY = v * imgWH.H;
                  const alignedPoint = rotationMeta.toAligned(imageX, imageY);
                  const alignedX = alignedPoint.x;
                  const alignedY = alignedPoint.y;
                  const xScreen = vp.tx + alignedX * vp.s;
                  const yScreen = vp.ty + alignedY * vp.s;
                  
                  return (
                    <div
                      key={oppgave.id}
                      style={{
                        position: 'absolute',
                        left: xScreen - 12,
                        top: yScreen - 12,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        background: getFagColor(oppgave.fag_color),
                        color: '#fff',
                        fontWeight: 700,
                        boxShadow: '0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,.35)',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        zIndex: 30, // Above overlay (10) and viewport (0)
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedOppgave(oppgave);
                      }}
                      title={`#${oppgaveNummer}`}
                    >
                      {oppgaveNummer}
                    </div>
                  );
                })}
                
                {/* Pending click indicator - screen-space positioning */}
                {pendingClickPosition && imgWH.W > 0 && imgWH.H > 0 && (() => {
                  const imageX = (pendingClickPosition.x / 100) * imgWH.W;
                  const imageY = (pendingClickPosition.y / 100) * imgWH.H;
                  const alignedPoint = rotationMeta.toAligned(imageX, imageY);
                  const alignedX = alignedPoint.x;
                  const alignedY = alignedPoint.y;
                  
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: vp.tx + alignedX * vp.s - 24,
                        top: vp.ty + alignedY * vp.s - 24,
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '4px solid #3b82f6',
                      color: '#3b82f6',
                      fontWeight: 700,
                      boxShadow: '0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,.35)',
                      cursor: 'pointer',
                      animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                      zIndex: 30,
                      pointerEvents: 'none',
                    }}
                    title="Oppretting oppgave..."
                  >
                    +
                  </div>
                  );
                })()}
                
                {!imageLoaded && !imageError && (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </>
            )}

            {/* Instructions when adding oppgave */}
            {isAddingOppgave && (
              <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-50">
                <p className="text-sm font-medium">Klikk på plantegningen for å legge til oppgave</p>
              </div>
            )}
            
            {/* Rotation tip popup */}
            {showRotationTip && currentOppgaver.length === 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-6 max-w-md z-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">💡</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Tips: Roter plantegningen</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Du kan rotere plantegningen før du legger til punkter. Klikk på rotasjons-knappen (🔄) for å justere orienteringen.
                    </p>
                    <p className="text-xs text-amber-600 mb-4">
                      ⚠️ Viktig: Rotasjon kan kun endres når plantegningen har 0 oppgaver.
                    </p>
                    <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (functionalEnabled) {
                                localStorage.setItem('rotation-tip-dismissed', 'true');
                              }
                              setShowRotationTip(false);
                            }}
                          >
                            Ikke vis igjen
                          </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowRotationTip(false)}
                      >
                        Forstått
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div> {/* End Image container */}

          {/* Oppgave details panel */}
          {selectedOppgave && (
            <div className="border-t p-4 bg-gray-50">
              <Card className="p-4">
                <div className="flex items-start justify-between min-h-[120px]">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge 
                        className={cn(getStatusColor(selectedOppgave?.status))}
                      >
                        {selectedStatusLabel}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={getPriorityColor(selectedOppgave?.prioritet)}
                      >
                        {selectedPriorityLabel}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-lg">
                      Oppgave #{selectedOppgaveNummer} - {selectedOppgaveFag}
                    </h3>
                    
                    {selectedOppgave.title && (
                      <p className="text-gray-600 mt-1">{selectedOppgave.title}</p>
                    )}
                    
                    {selectedOppgave.description && (
                      <div className="mt-2 max-h-20 overflow-y-auto">
                        <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap break-words">{selectedOppgave.description}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                      {selectedOppgave.frist && (
                        <span>Frist: {new Date(selectedOppgave.frist).toLocaleDateString('no-NO')}</span>
                      )}
                      {selectedOppgave.underleverandor_navn && (
                        <span>UL: {selectedOppgave.underleverandor_navn}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOppgaveClick(selectedOppgave)}
                      >
                        Rediger
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOppgave(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slett oppgave
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
      </div>
      
      {/* Mobile Bottom Sheet - Compact Actions */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-2 z-[60] shadow-lg" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {/* Single row - All controls */}
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" onClick={zoomOut} className="h-9 w-9 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={zoomIn} className="h-9 w-9 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom} className="h-9 w-9 p-0">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={rotateImage} 
            disabled={currentOppgaver.length > 0}
            className="h-9 w-9 p-0"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          
          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeletePlantegning && onDeletePlantegning(currentPlantegning.id)}
            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant={isAddingOppgave ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setIsAddingOppgave(!isAddingOppgave)}
            className="h-9 w-9 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette oppgave #{selectedOppgaveNummer}.
              Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOppgave}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Sletter...' : 'Slett oppgave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
