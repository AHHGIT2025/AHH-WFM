import * as React from "react";

// Helper to join classes
const cn = (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(" ");

// 1. Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "workflow" | "info" | "success" | "error" | "warning";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:pointer-events-none rounded-lg",
          // Sizes
          size === "xs" && "px-2 py-0.5 text-[10px] rounded",
          size === "sm" && "px-3 py-1 text-xs",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-6 py-3 text-base",
          // Variants
          variant === "primary" && "bg-[#093FA6] text-white hover:bg-[#116BEE] focus:ring-2 focus:ring-[#116BEE]/40 outline-none active:bg-[#031751]",
          variant === "secondary" && "bg-white border border-[#093FA6] text-[#093FA6] hover:bg-[#093FA6]/10 focus:ring-2 focus:ring-[#093FA6]/30",
          variant === "workflow" && "bg-[#4643F3] text-white hover:bg-[#4643F3]/90 focus:ring-2 focus:ring-[#4643F3]/40",
          variant === "info" && "bg-[#5FAFD8] text-[#031751] font-semibold hover:bg-[#5FAFD8]/90 focus:ring-2 focus:ring-[#5FAFD8]/40",
          variant === "ghost" && "bg-transparent text-on-surface-variant hover:bg-[#093FA6]/10 hover:text-primary",
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
  variant?: "success" | "error" | "warning" | "pending" | "info" | "neutral" | "primary" | "secondary" | "workflow";
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
        variant === "pending" && "bg-[#116BEE]/10 text-[#116BEE] border-[#116BEE]/20",
        variant === "info" && "bg-[#5FAFD8]/20 text-[#031751] border-[#5FAFD8]/40",
        variant === "workflow" && "bg-[#4643F3]/15 text-[#4643F3] border-[#4643F3]/30",
        variant === "neutral" && "bg-slate-100 text-slate-700 border-slate-200",
        variant === "primary" && "bg-[#031751]/10 text-[#031751] border-[#031751]/20",
        variant === "secondary" && "bg-[#093FA6]/10 text-[#093FA6] border-[#093FA6]/20",
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
  size?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size }) => {
  if (!isOpen) return null;

  let sizeClasses = "max-w-lg w-full"; // default
  if (size === "md") {
    sizeClasses = "max-w-md w-full";
  } else if (size === "lg") {
    sizeClasses = "max-w-lg w-full";
  } else if (size === "xl") {
    sizeClasses = "max-w-xl w-full";
  } else if (size === "2xl") {
    sizeClasses = "max-w-2xl w-full";
  } else if (size === "4xl") {
    sizeClasses = "max-w-4xl w-full";
  } else if (size === "6xl") {
    sizeClasses = "max-w-6xl w-[92vw]";
  } else if (size === "7xl") {
    sizeClasses = "max-w-7xl w-[92vw]";
  } else if (size) {
    sizeClasses = size;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content */}
      <div className={`relative bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl ${sizeClasses} max-h-[90vh] flex flex-col z-10 overflow-hidden`}>
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
