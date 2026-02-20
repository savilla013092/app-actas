import * as React from "react"
import { cn } from "@/lib/utils/cn"
import { LucideBuilding2 } from "lucide-react"

interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  compact?: boolean
}

function Footer({ className, compact = false, ...props }: FooterProps) {
  if (compact) {
    return (
      <footer 
        className={cn(
          "py-3 px-4 text-center border-t bg-card/50",
          className
        )}
        {...props}
      >
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <span className="font-semibold text-foreground">SERVICIUDAD ESP</span> - Sistema de Actas de Revisión
        </p>
      </footer>
    )
  }

  return (
    <footer 
      className={cn(
        "py-6 px-8 border-t bg-gradient-to-b from-card to-muted/30",
        className
      )}
      {...props}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/15 rounded-lg flex items-center justify-center ring-1 ring-primary/20">
              <LucideBuilding2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">SERVICIUDAD ESP</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Empresa de Servicios Públicos
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>Sistema de Actas de Revisión de Activos Fijos</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">v1.0.0</span>
          </div>
          
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
