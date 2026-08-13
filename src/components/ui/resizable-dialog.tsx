"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface ResizableDialogProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function ResizableDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  ...props
}: ResizableDialogProps) {
  const [size, setSize] = React.useState({ width: 1100, height: 750 });
  const [isMaximized, setIsMaximized] = React.useState(false);
  const isResizing = React.useRef(false);

  // Garantir que a janela caiba na tela inicial
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const w = Math.min(window.innerWidth - 40, 1100);
      const h = Math.min(window.innerHeight - 40, 750);
      setSize({ width: w, height: h });
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(550, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(450, startHeight + (moveEvent.clientY - startY));
      setSize({
        width: Math.min(window.innerWidth - 20, newWidth),
        height: Math.min(window.innerHeight - 20, newHeight),
      });
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const currentStyle: React.CSSProperties = isMaximized
    ? {
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        borderRadius: "0",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }
    : {
        width: `${size.width}px`,
        height: `${size.height}px`,
        maxWidth: "96vw",
        maxHeight: "96vh",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col border bg-background shadow-2xl transition-all duration-150 ease-out sm:rounded-xl overflow-hidden"
          )}
          style={currentStyle}
        >
          {/* Header customizado com suporte a Maximizar */}
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-card/50">
            <div className="flex flex-col space-y-0.5">
              {title && (
                <DialogPrimitive.Title className="text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Botão de Maximizar / Restaurar */}
              <button
                onClick={toggleMaximize}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
                title={isMaximized ? "Restaurar tamanho" : "Maximizar"}
              >
                {isMaximized ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>

              {/* Botão Fechar padrão */}
              <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer">
                <X className="size-3.5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Área de Conteúdo */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-background">
            {children}
          </div>

          {/* Handle de Redimensionamento */}
          {!isMaximized && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute bottom-0 right-0 size-4 cursor-se-resize flex items-end justify-end p-0.5 group z-50 bg-transparent"
              title="Arraste para redimensionar"
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                className="text-muted-foreground/30 group-hover:text-primary transition-colors duration-150"
              >
                <line x1="6" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" />
                <line x1="6" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
