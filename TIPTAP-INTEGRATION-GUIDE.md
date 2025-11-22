# 📝 Intégration TipTap - Éditeur Riche pour Contenu SEO

**Status:** 📋 DOCUMENTATION  
**Date:** 22 novembre 2025  
**Priorité:** Moyenne (Todo 2/6)

---

## 🎯 Objectif

Intégrer TipTap (éditeur WYSIWYG) pour permettre l'édition du contenu SEO enrichi (avec balises `<b>`, `<strong>`, `<i>`, etc.) directement depuis le backoffice admin.

---

## 📦 Installation

### 1. Installer les packages TipTap

```bash
cd frontend

# Core packages
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm

# Extensions utiles pour SEO
npm install @tiptap/extension-bold \
            @tiptap/extension-italic \
            @tiptap/extension-link \
            @tiptap/extension-heading \
            @tiptap/extension-paragraph
```

### 2. Créer le composant RichTextEditor

**Fichier:** `frontend/app/components/editor/RichTextEditor.tsx`

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import { Button } from '../ui/button';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Commencez à écrire...',
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3], // H2, H3 seulement pour SEO
        },
        paragraph: true,
        bold: true,
        italic: true,
      }),
      Bold,
      Italic,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 ${className}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Mettre à jour le contenu si la prop change
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Barre d'outils */}
      <div className="border-b bg-gray-50 p-2 flex gap-1 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'outline'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-8 px-2"
        >
          <strong>B</strong>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'outline'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 px-2"
        >
          <em>I</em>
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="h-8 px-2"
        >
          H2
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="h-8 px-2"
        >
          H3
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 px-2"
        >
          ↶ Annuler
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 px-2"
        >
          ↷ Rétablir
        </Button>
      </div>

      {/* Éditeur */}
      <EditorContent editor={editor} className="bg-white" />

      {/* Stats */}
      <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500 flex justify-between">
        <span>{editor.storage.characterCount?.characters() || 0} caractères</span>
        <span>{editor.storage.characterCount?.words() || 0} mots</span>
      </div>
    </div>
  );
}
```

---

## 🔧 Intégration dans les Formulaires

### Exemple: Édition contenu marque

**Fichier:** `frontend/app/routes/admin.brands.$id.tsx` (à créer)

```tsx
import { useState } from 'react';
import { Form } from '@remix-run/react';
import { RichTextEditor } from '~/components/editor/RichTextEditor';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export default function BrandEditor() {
  const [content, setContent] = useState('<b>Renault</b> est une marque...');

  return (
    <Form method="post">
      <Card>
        <CardHeader>
          <CardTitle>Contenu SEO Marque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Champ hidden pour envoyer le HTML au backend */}
          <input type="hidden" name="content" value={content} />

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              📝 Contenu enrichi
            </label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Décrivez la marque..."
            />
          </div>

          <Button type="submit">
            💾 Enregistrer
          </Button>
        </CardContent>
      </Card>
    </Form>
  );
}
```

---

## 🎨 Styles TipTap

**Fichier:** `frontend/app/styles/tiptap.css`

```css
/* Styles de base pour l'éditeur TipTap */
.ProseMirror {
  outline: none;
}

.ProseMirror p {
  margin: 0.5rem 0;
}

.ProseMirror h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1rem 0 0.5rem;
}

.ProseMirror h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
}

.ProseMirror strong {
  font-weight: 700;
}

.ProseMirror em {
  font-style: italic;
}

.ProseMirror a {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}

.ProseMirror a:hover {
  color: #1d4ed8;
}

/* Placeholder */
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}
```

Importer dans `frontend/app/root.tsx` :

```tsx
import './styles/tiptap.css';
```

---

## 🔌 Backend: Récupération et Enregistrement

### Action pour sauvegarder

```tsx
// frontend/app/routes/admin.brands.$id.tsx
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const content = formData.get('content') as string;
  const brandId = params.id;

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/brands/${brandId}/seo`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('Cookie') || '',
    },
    body: JSON.stringify({
      content, // HTML enrichi
    }),
  });

  if (!response.ok) {
    return json({ error: 'Erreur sauvegarde' }, { status: 500 });
  }

  return json({ success: true });
}
```

### Loader pour charger le contenu existant

```tsx
export async function loader({ params, request }: LoaderFunctionArgs) {
  const brandId = params.id;
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/brands/brand/${brandId}`, {
    headers: {
      'Cookie': request.headers.get('Cookie') || '',
    },
  });

  const data = await response.json();

  return json({
    brand: data.data,
    seo: data.data.seo || null,
  });
}
```

---

## ✅ Checklist Implémentation

- [ ] Installer packages TipTap (`@tiptap/react`, `@tiptap/starter-kit`)
- [ ] Créer composant `RichTextEditor.tsx`
- [ ] Créer styles `tiptap.css`
- [ ] Créer route admin édition marque (`admin.brands.$id.tsx`)
- [ ] Implémenter loader/action
- [ ] Tester édition + sauvegarde
- [ ] Valider HTML généré (seulement balises autorisées)
- [ ] Tests E2E édition contenu

---

## 🎯 Balises HTML Autorisées

Pour SEO, limiter aux balises suivantes :

- `<b>`, `<strong>` - Texte en gras
- `<i>`, `<em>` - Texte italique
- `<h2>`, `<h3>` - Titres secondaires
- `<p>` - Paragraphes
- `<a href="...">` - Liens (avec validation URL)

**Pas de balises dangereuses :** `<script>`, `<iframe>`, `<object>`, etc.

---

## 📊 Effort Estimé

| Tâche | Temps | Priorité |
|-------|-------|----------|
| Installation packages | 10min | 🔴 Haute |
| Composant RichTextEditor | 1h | 🔴 Haute |
| Styles CSS | 20min | 🟡 Moyenne |
| Intégration formulaire | 45min | 🔴 Haute |
| Backend endpoints | 30min | 🟡 Moyenne |
| Tests | 45min | 🟢 Basse |
| **TOTAL** | **~3h30** | - |

---

## 🚀 Déploiement

### Production Checklist

1. ✅ TipTap installé
2. ✅ Composant testé en dev
3. ✅ Sanitization HTML côté backend
4. ✅ Tests E2E éditeur
5. ✅ Documentation utilisateur
6. ✅ Build frontend sans erreur

### Commandes

```bash
# Dev
cd frontend && npm run dev

# Build
npm run build

# Type check
npm run typecheck
```

---

## 📝 Notes

- TipTap génère du HTML propre et valide
- Le service `BrandSeoService` backend supporte déjà les balises HTML dans `content`
- Le champ `contentText` (texte pur) est généré automatiquement par le backend
- Pas besoin de modifier le backend, juste ajouter endpoint PUT si manquant

---

**Status:** 📋 Prêt à implémenter
**Bloqueurs:** Aucun
**Dépendances:** TipTap packages (npm install)
