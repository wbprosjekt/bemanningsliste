import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Check, X } from 'lucide-react';

interface ColorPickerDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  projectNumber: number;
  currentColor: string;
  onColorChange: (color: string) => void;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange  
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
  '#6b7280', // gray
];

const ColorPickerDialog = ({ 
  open, 
  onClose, 
  projectName, 
  projectNumber, 
  currentColor, 
  onColorChange 
}: ColorPickerDialogProps) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [customColor, setCustomColor] = useState(currentColor);

  const handleSave = () => {
    onColorChange(selectedColor);
    onClose();
  };

  const handlePresetColorClick = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
  };

  const handleColorInputChange = (value: string) => {
    if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
      setSelectedColor(value);
      setCustomColor(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Endre prosjektfarge
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-medium">{projectName}</div>
            <div className="text-sm text-muted-foreground">Prosjekt #{projectNumber}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Fargen vil oppdateres på alle forekomster av dette prosjektet
            </div>
          </div>

          {/* Current vs New Color Preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center space-y-2">
              <Label className="text-sm">Nåværende farge</Label>
              <div 
                className="w-full h-12 rounded border"
                style={{ backgroundColor: currentColor }}
              />
              <div className="text-xs font-mono">{currentColor}</div>
            </div>
            <div className="text-center space-y-2">
              <Label className="text-sm">Ny farge</Label>
              <div 
                className="w-full h-12 rounded border"
                style={{ backgroundColor: selectedColor }}
              />
              <div className="text-xs font-mono">{selectedColor}</div>
            </div>
          </div>

          {/* Preset Colors */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Forhåndsdefinerte farger</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                    selectedColor === color ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handlePresetColorClick(color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tilpasset farge</Label>
            <div className="flex flex-col items-center space-y-3">
              <HexColorPicker 
                color={customColor} 
                onChange={(color) => {
                  setCustomColor(color);
                  setSelectedColor(color);
                }}
                style={{ width: '200px', height: '150px' }}
              />
              <div className="flex items-center gap-2 w-full">
                <Label htmlFor="hex-input" className="text-sm">Hex:</Label>
                <Input
                  id="hex-input"
                  value={customColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomColor(value);
                    handleColorInputChange(value);
                  }}
                  placeholder="#000000"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Avbryt
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-1" />
              Lagre farge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColorPickerDialog;