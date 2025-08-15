/**
 * Dialog Component - Version simple pour les modales
 */

import { ReactNode } from "react";

interface DialogProps {
  children: ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: ReactNode;
}

interface DialogHeaderProps {
  children: ReactNode;
}

interface DialogTitleProps {
  children: ReactNode;
}

interface DialogDescriptionProps {
  children: ReactNode;
}

interface DialogFooterProps {
  children: ReactNode;
}

interface DialogTriggerProps {
  asChild?: boolean;
  children: ReactNode;
}

export function Dialog({ children }: DialogProps) {
  return <div className="dialog-container">{children}</div>;
}

export function DialogTrigger({ children }: DialogTriggerProps) {
  return <div className="dialog-trigger">{children}</div>;
}

export function DialogContent({ className = "", children }: DialogContentProps) {
  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="p-6 pb-2">{children}</div>;
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="text-sm text-gray-600 mt-1">{children}</p>;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return <div className="flex justify-end gap-2 p-6 pt-2">{children}</div>;
}
