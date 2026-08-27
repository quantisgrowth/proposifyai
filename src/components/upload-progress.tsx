import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface UploadProgressOverlayProps {
  open: boolean;
  progress: number;
  statusText: string;
  title?: string;
}

export function UploadProgressOverlay({
  open,
  progress,
  statusText,
  title = "Salvando Configurações",
}: UploadProgressOverlayProps) {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-xs bg-card/95 border-red-900/30 backdrop-blur p-6 flex flex-col items-center justify-center text-center [&>button]:hidden select-none"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative flex items-center justify-center mb-4">
          {/* Animated red ring loader */}
          <Loader2 className="size-12 text-red-600 animate-spin" />
          <span className="absolute text-[10px] font-bold text-foreground tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="space-y-2 w-full">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          
          {/* Custom progress bar */}
          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-600 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground animate-pulse font-medium min-h-[16px]">
            {statusText}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
