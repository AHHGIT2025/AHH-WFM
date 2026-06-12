import * as React from "react";

// Helper to join classes
const cn = (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(" ");

// 1. Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "success" | "error" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-lg",
          // Sizes
          size === "sm" && "px-3 py-1 text-xs",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-6 py-3 text-base",
          // Variants
          variant === "primary" && "bg-secondary text-white hover:bg-[#0047a3] focus:ring-2 focus:ring-[rgba(0,88,190,0.35)] outline-none",
          variant === "secondary" && "bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-container-highest",
          variant === "ghost" && "bg-transparent text-on-surface-variant hover:bg-surface-container-low",
          variant === "success" && "bg-status-success text-white hover:opacity-90",
          variant === "error" && "bg-status-error text-white hover:opacity-90",
          variant === "warning" && "bg-status-warning text-white hover:opacity-90",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// 2. Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={id} className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50",
            error && "border-status-error focus:ring-status-error/20 focus:border-status-error",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-error font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// 3. Card Component
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  padded?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padded = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden",
          padded && "p-4 md:p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

// 4. Badge Component
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "error" | "warning" | "pending" | "info" | "neutral";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "info", className, children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap",
        variant === "success" && "bg-status-success/10 text-status-success border-status-success/20",
        variant === "error" && "bg-status-error/10 text-status-error border-status-error/20",
        variant === "warning" && "bg-status-warning/10 text-status-warning border-status-warning/20",
        variant === "pending" && "bg-status-pending/10 text-status-pending border-status-pending/20",
        variant === "info" && "bg-secondary/10 text-secondary border-secondary/20",
        variant === "neutral" && "bg-surface-container-high text-on-surface-variant border-outline-variant",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
Badge.displayName = "Badge";

// 5. Modal Component
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content */}
      <div className="relative bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col z-10 overflow-hidden">
        <header className="flex justify-between items-center p-4 md:p-6 border-b border-outline-variant bg-surface-container-low">
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="p-4 md:p-6 overflow-y-auto flex-1 text-sm text-on-surface">
          {children}
        </div>
      </div>
    </div>
  );
};
Modal.displayName = "Modal";
