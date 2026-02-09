/**
 * 📝 Quick Note Dialog - Composant réutilisable pour ajouter des notes rapides
 *
 * Cas d'usage :
 * - Ajouter une note sur une commande
 * - Commentaire rapide sur un client
 * - Remarque interne sur un produit
 * - Todo admin rapide
 *
 * @example
 * ```tsx
 * <QuickNoteDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Ajouter une note"
 *   onSubmit={(note) => console.log(note)}
 * />
 * ```
 */

import { MessageSquarePlus } from "lucide-react";
import { memo, useState } from "react";

import { logger } from "~/utils/logger";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface QuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  onSubmit: (note: string) => void | Promise<void>;
  submitLabel?: string;
  maxLength?: number;
}

export const QuickNoteDialog = memo(function QuickNoteDialog({
  open,
  onOpenChange,
  title = "Ajouter une note",
  description = "Saisissez votre note ci-dessous",
  placeholder = "Votre note...",
  onSubmit,
  submitLabel = "Enregistrer",
  maxLength = 500,
}: QuickNoteDialogProps) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!note.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(note);
      setNote(""); // Reset après succès
      onOpenChange(false);
    } catch (error) {
      logger.error("Erreur lors de la soumission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder={placeholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={maxLength}
                rows={5}
                className="resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-right">
                {note.length}/{maxLength} caractères
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!note.trim() || isSubmitting}>
              {isSubmitting ? "Enregistrement..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
