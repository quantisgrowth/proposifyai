import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawImageSrc: string;
  aspectRatio: number; // e.g. 3 for 3:1, 1 for 1:1
  title?: string;
  description?: string;
  onConfirm: (croppedBase64: string) => void;
}

export function ImageCropperDialog({
  open,
  onOpenChange,
  rawImageSrc,
  aspectRatio,
  title = "Ajustar Imagem",
  description = "Arraste a imagem e use o zoom para enquadrar a imagem dentro da área destacada.",
  onConfirm,
}: ImageCropperDialogProps) {
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset offset and zoom when a new image is loaded or dialog opens
  useEffect(() => {
    if (open) {
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
    }
  }, [open, rawImageSrc]);

  const handleCropSave = () => {
    const img = new Image();
    img.src = rawImageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Output dimensions: 300px base width, height depends on aspect ratio
      const outputWidth = 300;
      const outputHeight = 300 / aspectRatio;
      
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, outputWidth, outputHeight);
        
        // Base width inside cropper container is fixed at 300px.
        // Base height scales proportionally based on image aspect ratio.
        const baseWidth = 300;
        const baseHeight = 300 * (img.naturalHeight / img.naturalWidth);
        
        // We draw the image offset by our dragged x/y coordinate relative to crop area top-left
        ctx.drawImage(
          img,
          cropOffset.x,
          cropOffset.y,
          baseWidth * cropZoom,
          baseHeight * cropZoom
        );
        const croppedBase64 = canvas.toDataURL("image/png");
        onConfirm(croppedBase64);
      }
      onOpenChange(false);
    };
  };

  // Dimensions of the crop visual helper box
  const cropBoxWidth = 300;
  const cropBoxHeight = 300 / aspectRatio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cropper Draggable Workspace */}
          <div
            className="relative w-full h-[260px] bg-slate-950/20 overflow-hidden rounded-lg border border-border flex items-center justify-center select-none cursor-move"
            onMouseDown={(e) => {
              setIsDragging(true);
              setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
            }}
            onMouseMove={(e) => {
              if (!isDragging) return;
              setCropOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
              });
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (!touch) return;
              setIsDragging(true);
              setDragStart({ x: touch.clientX - cropOffset.x, y: touch.clientY - cropOffset.y });
            }}
            onTouchMove={(e) => {
              if (!isDragging) return;
              const touch = e.touches[0];
              if (!touch) return;
              setCropOffset({
                x: touch.clientX - dragStart.x,
                y: touch.clientY - dragStart.y,
              });
            }}
            onTouchEnd={() => setIsDragging(false)}
          >
            {/* The Raw Image */}
            {rawImageSrc && (
              <img
                src={rawImageSrc}
                alt="Crop Target"
                style={{
                  position: "absolute",
                  left: `calc(50% - ${cropBoxWidth / 2}px)`,
                  top: `calc(50% - ${cropBoxHeight / 2}px)`,
                  transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                  transformOrigin: "0 0",
                  maxWidth: "none",
                  width: `${cropBoxWidth}px`,
                  height: "auto",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Dotted Crop Area Overlay */}
            <div
              className="absolute border-2 border-dashed border-red-500 pointer-events-none rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                width: `${cropBoxWidth}px`,
                height: `${cropBoxHeight}px`,
                top: `calc(50% - ${cropBoxHeight / 2}px)`,
                left: `calc(50% - ${cropBoxWidth / 2}px)`,
              }}
            />
          </div>

          {/* Zoom Slider Control */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground font-semibold">
              <span>Zoom</span>
              <span>{Math.round(cropZoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={cropZoom}
              onChange={(e) => setCropZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCropSave}
              className="rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Cortar e Confirmar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
