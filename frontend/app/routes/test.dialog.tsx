/**
 * 🧪 TEST DIALOG - Page de démonstration Shadcn Dialog
 * 
 * Démontre l'utilisation des Dialogs avec :
 * - QuickNoteDialog réutilisable
 * - Dialog de confirmation
 * - Dialog avec formulaire complexe
 * - Animations et accessibilité
 */

import { useState } from 'react';

import { Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

import { AdminBreadcrumb } from '../components/admin/AdminBreadcrumb';
import { QuickNoteDialog } from '../components/admin/QuickNoteDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

export default function TestDialog() {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: number; text: string; date: string }>>([
    { id: 1, text: 'Première note de test', date: new Date().toLocaleString('fr-FR') },
  ]);

  const handleAddNote = async (note: string) => {
    // Simuler un délai réseau
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newNote = {
      id: Date.now(),
      text: note,
      date: new Date().toLocaleString('fr-FR'),
    };

    setNotes([...notes, newNote]);
    toast.success('Note ajoutée', {
      description: 'Votre note a été enregistrée avec succès',
    });
  };

  const handleDeleteAll = () => {
    setNotes([]);
    setConfirmDialogOpen(false);
    toast.success('Notes supprimées', {
      description: `${notes.length} note(s) supprimée(s)`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage="Test Dialog" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Shadcn Dialog
          </h1>
          <p className="text-gray-600">
            Démonstration des Dialogs réutilisables avec Radix UI
          </p>
        </div>

        {/* Grid de cartes démo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1 : QuickNoteDialog */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                QuickNoteDialog
              </CardTitle>
              <CardDescription>
                Dialog réutilisable pour ajouter des notes rapides
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setNoteDialogOpen(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une note
              </Button>

              {/* Liste des notes */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Notes ({notes.length})
                </h3>
                {notes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucune note pour le moment
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                      >
                        <p className="text-sm text-gray-900">{note.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{note.date}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2 : Dialog de confirmation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Dialog de confirmation
              </CardTitle>
              <CardDescription>
                Dialog avec actions destructives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={notes.length === 0}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer toutes les notes
              </Button>
            </CardContent>
          </Card>

          {/* Card 3 : Dialog avec trigger inline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-green-600" />
                Dialog avec DialogTrigger
              </CardTitle>
              <CardDescription>
                Utilise DialogTrigger pour l'ouverture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier les paramètres
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Paramètres</DialogTitle>
                    <DialogDescription>
                      Modifiez les paramètres de l'application
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600">
                      Formulaire de paramètres ici...
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Annuler</Button>
                    <Button onClick={() => toast.success('Paramètres sauvegardés')}>
                      Sauvegarder
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Card 4 : Avantages */}
          <Card>
            <CardHeader>
              <CardTitle>✨ Avantages Shadcn Dialog</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Accessibilité native (Radix UI)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Animations fluides automatiques</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Gestion Escape/backdrop intégrée</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Focus trap automatique</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Responsive mobile/desktop</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Composable et réutilisable</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QuickNoteDialog instance */}
      <QuickNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        title="Ajouter une note"
        description="Saisissez votre note ci-dessous. Maximum 500 caractères."
        placeholder="Exemple: Contacter le client demain..."
        onSubmit={handleAddNote}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Êtes-vous sûr ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera toutes les notes ({notes.length}). Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
