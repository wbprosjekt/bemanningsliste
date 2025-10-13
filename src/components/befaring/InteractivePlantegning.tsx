'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

interface Plantegning {
  id: string;
  title: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

interface Oppgave {
  id: string;
  plantegning_id: string;
  oppgave_nummer: number;
  fag: string;
  fag_color: string;
  x_position: number;
  y_position: number;
  title?: string;
  description?: string;
  status: string;
  prioritet: string;
  frist?: string;
  created_at: string;
  plantegninger: {
    id: string;
    title: string;
    image_url: string;
    display_order: number;
  };
}

interface InteractivePlantegningProps {
  plantegning: Plantegning;
  oppgaver: Oppgave[];
  befaringId: string;
  onTaskCreate: (plantegningId: string, x: number, y: number) => void;
  onTaskEdit: (oppgave: Oppgave) => void;
  onTaskDelete: (oppgaveId: string) => void;
}

export default function InteractivePlantegning({
  plantegning,
  oppgaver,
  befaringId,
  onTaskCreate,
  onTaskEdit,
  onTaskDelete
}: InteractivePlantegningProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showTaskNumbers, setShowTaskNumbers] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Oppgave | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Filter oppgaver for denne plantegningen
  const plantegningOppgaver = oppgaver.filter(o => o.plantegning_id === plantegning.id);

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // Sjekk om vi klikket på en eksisterende oppgave
    const clickedTask = plantegningOppgaver.find(oppgave => {
      const taskX = oppgave.x_position;
      const taskY = oppgave.y_position;
      const distance = Math.sqrt(Math.pow(x - taskX, 2) + Math.pow(y - taskY, 2));
      return distance < 3; // 3% tolerance
    });

    if (clickedTask) {
      setSelectedTask(clickedTask);
      onTaskEdit(clickedTask);
    } else {
      // Opprett ny oppgave
      onTaskCreate(plantegning.id, x, y);
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.target === imageRef.current) return; // Ikke dra hvis vi klikker på bildet
    
    setIsDragging(true);
    setDragStart({
      x: event.clientX - pan.x,
      y: event.clientY - pan.y
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;

    setPan({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'apen': return 'bg-amber-500';
      case 'under_arbeid': return 'bg-blue-500';
      case 'lukket': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTaskPriorityColor = (prioritet: string) => {
    switch (prioritet) {
      case 'kritisk': return 'border-red-500';
      case 'høy': return 'border-orange-500';
      case 'medium': return 'border-yellow-500';
      case 'lav': return 'border-gray-500';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{plantegning.title}</h3>
          <Badge variant="outline">
            {plantegningOppgaver.length} oppgaver
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom kontroller */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          {/* Reset view */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          {/* Toggle task numbers */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTaskNumbers(!showTaskNumbers)}
          >
            {showTaskNumbers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Interaktiv plantegning */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-gray-50 cursor-move"
            style={{ height: '600px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {imageError ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-lg mb-2">Bilde kunne ikke lastes</div>
                  <div className="text-sm">Sjekk at bildet eksisterer og er tilgjengelig</div>
                </div>
              </div>
            ) : (
              <>
                <img
                  ref={imageRef}
                  src={plantegning.image_url}
                  alt={plantegning.title}
                  className="absolute cursor-crosshair select-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  onClick={handleImageClick}
                  draggable={false}
                />

                {/* Oppgave-punkter */}
                {imageLoaded && plantegningOppgaver.map((oppgave) => (
                  <div
                    key={oppgave.id}
                    className="absolute cursor-pointer group"
                    style={{
                      left: `${oppgave.x_position}%`,
                      top: `${oppgave.y_position}%`,
                      transform: `translate(-50%, -50%) scale(${1/zoom})`
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(oppgave);
                      onTaskEdit(oppgave);
                    }}
                  >
                    {/* Oppgave-punkt */}
                    <div
                      className={`
                        w-8 h-8 rounded-full border-4 border-white shadow-lg
                        ${getTaskStatusColor(oppgave.status)}
                        ${getTaskPriorityColor(oppgave.prioritet)}
                        hover:scale-110 transition-transform duration-200
                      `}
                    >
                      {showTaskNumbers && (
                        <div className="flex items-center justify-center h-full text-white text-xs font-bold">
                          {oppgave.oppgave_nummer}
                        </div>
                      )}
                    </div>

                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        <div className="font-semibold">{oppgave.title || `Oppgave ${oppgave.oppgave_nummer}`}</div>
                        <div className="text-gray-300">{oppgave.fag}</div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                ))}

                {/* Loading overlay */}
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <div className="text-gray-600">Laster plantegning...</div>
                    </div>
                  </div>
                )}

                {/* Instruksjoner */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs rounded px-3 py-2">
                  <div>🖱️ Klikk på plantegningen for å legge til oppgave</div>
                  <div>📍 Klikk på punkt for å redigere oppgave</div>
                  <div>🔍 Scroll for å zoome, dra for å pan</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Oppgave-liste */}
      {plantegningOppgaver.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3">Oppgaver på denne plantegningen</h4>
            <div className="space-y-2">
              {plantegningOppgaver.map((oppgave) => (
                <div
                  key={oppgave.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${getTaskStatusColor(oppgave.status)}`}></div>
                    <div>
                      <div className="font-medium">
                        {oppgave.oppgave_nummer}. {oppgave.title || 'Uten tittel'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {oppgave.fag} • {oppgave.status} • {oppgave.prioritet}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTaskEdit(oppgave)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTaskDelete(oppgave.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

