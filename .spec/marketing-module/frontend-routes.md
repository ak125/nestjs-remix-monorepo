# Frontend Routes - Module Marketing

## Routes MVP (Phase 1)

### 1. `admin.marketing._index.tsx` - Dashboard

**URL :** `/admin/marketing`

**Loader :** Fetch `/api/admin/marketing/dashboard`

**Contenu :**
- 4 KPI cards en haut (backlinks total, referring domains, couverture contenu %, trafic organique)
- Graphique timeline KPIs (30 derniers jours)
- Campagnes actives (mini-liste)
- Derniers backlinks acquis (5 derniers)
- Progression roadmap contenu (barre de progression par type)

**Composants shadcn/ui :**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` - KPI cards
- `Badge` - statuts
- `Table` - listes
- `Progress` - barres de progression

**Icons lucide-react :** `TrendingUp`, `Link2`, `FileText`, `BarChart3`

---

### 2. `admin.marketing.backlinks.tsx` - Tracker Backlinks

**URL :** `/admin/marketing/backlinks`

**Loader :** Fetch `/api/admin/marketing/backlinks?page=1&limit=20` + `/api/admin/marketing/backlinks/stats`

**Contenu :**
- Stats en haut : total backlinks, live vs lost, DA moyen, top domaines
- Filtres : status (live/lost/pending), DA min, domaine, categorie source
- Table paginee : source_url, target_url, anchor, DA, status, first_seen
- Bouton "Importer CSV" (upload GSC export)
- Bouton "Ajouter manuellement"

**Composants shadcn/ui :**
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `Badge` - status (live=green, lost=red, pending=yellow)
- `Input` - filtres
- `Select` - dropdowns filtre
- `Button` - actions
- `Dialog` - modal import CSV / ajout manuel

**Actions Remix :**
- `POST` avec intent `import` - import CSV
- `POST` avec intent `create` - ajout manuel
- `PATCH` avec intent `update` - mise a jour status
- `DELETE` avec intent `delete` - suppression

---

### 3. `admin.marketing.content-roadmap.tsx` - Roadmap Contenu

**URL :** `/admin/marketing/content-roadmap`

**Loader :** Fetch `/api/admin/marketing/content-roadmap` + `/api/admin/marketing/content-roadmap/coverage`

**Contenu :**
- Vue couverture en haut :
  - Barre : X/221 gammes couvertes
  - Mini-barres par type : advice (85/221), reference (0/221), diagnostic (1/221), guides (1/16)
- Filtres : content_type, priority, status, famille
- Table paginee : titre, type, priorite, status, famille, deadline, trafic GA4
- Actions : creer, editer, changer status
- Vue "gaps" : gammes sans contenu triees par trafic GA4

**Composants shadcn/ui :**
- `Card` - vue couverture
- `Progress` - barres de progression
- `Table` - liste roadmap items
- `Badge` - priorite (critical=red, high=orange, medium=blue, low=gray)
- `Badge` - status (planned=gray, writing=blue, review=yellow, published=green)
- `Select` - filtres
- `Dialog` - modal creation/edition

---

## Sidebar Navigation

**Fichier :** `frontend/app/components/AdminSidebar.tsx`

**Position :** apres le bloc "Blog", avant "Dashboard Commercial"

```typescript
// Nouveaux imports lucide-react
import {
  Megaphone, Link2, Target, Mail, FileEdit, CalendarRange
} from 'lucide-react';

// Nouveau nav item dans getNavigationItems()
{
  name: "Marketing",
  href: "/admin/marketing",
  icon: Megaphone,
  description: "Campagnes & backlinks",
  badge: { count: "NEW", color: "bg-emerald-500" },
  notification: false,
  subItems: [
    {
      name: "Dashboard",
      href: "/admin/marketing",
      icon: TrendingUp,
      description: "KPIs et vue d'ensemble",
    },
    {
      name: "Backlinks",
      href: "/admin/marketing/backlinks",
      icon: Link2,
      description: "Suivi des backlinks",
    },
    {
      name: "Roadmap Contenu",
      href: "/admin/marketing/content-roadmap",
      icon: CalendarRange,
      description: "Planification contenu",
    },
  ],
}
```

**Nota :** les sous-items Campagnes, Outreach, Guest Posts seront ajoutes en P1/P2.

---

## Patterns a suivre

| Pattern | Fichier de reference |
|---------|---------------------|
| Loader avec cookie forwarding | `frontend/app/routes/admin.seo-hub._index.tsx` |
| Table paginee + filtres | `frontend/app/routes/admin.users._index.tsx` |
| KPI cards dashboard | `frontend/app/routes/admin._index.tsx` |
| Actions Remix (POST) | `frontend/app/routes/admin.seo-hub.content.references.$slug.tsx` |
| Dialog modal | `frontend/app/routes/admin.seo-hub.content.references.new.tsx` |
| Meta noindex | `createNoIndexMeta()` de `~/utils/meta-helpers` |
| API URL interne | `getInternalApiUrl()` de `~/utils/internal-api.server` |

---

## Routes P1/P2 (plus tard)

| Route | URL | Priorite | Description |
|-------|-----|----------|-------------|
| `admin.marketing.campaigns.tsx` | `/admin/marketing/campaigns` | P1 | Liste campagnes avec stats |
| `admin.marketing.campaigns.$id.tsx` | `/admin/marketing/campaigns/:id` | P2 | Detail campagne + backlinks/outreach lies |
| `admin.marketing.outreach.tsx` | `/admin/marketing/outreach` | P2 | Pipeline outreach (kanban-like) |
| `admin.marketing.guest-posts.tsx` | `/admin/marketing/guest-posts` | P2 | Gestion articles invites |
