import { 
  Button,
  Input,
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  ProductCard,
  Combobox,
  type ComboboxItem
} from '@fafa/ui';
import { type MetaFunction } from '@remix-run/node';
import { useState } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Composants UI | Design System FAFA' },
    { name: 'description', content: 'Showcase des composants UI avec variantes CVA' },
  ];
};

export default function UIKitComponents() {
  const [inputValue, setInputValue] = useState('');
  
  // Combobox demo data
  const [selectedCountry, setSelectedCountry] = useState<string | number | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | number | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | number | null>(null);
  
  const countries: ComboboxItem[] = [
    { value: 'fr', label: 'France' },
    { value: 'be', label: 'Belgique' },
    { value: 'ch', label: 'Suisse' },
    { value: 'de', label: 'Allemagne' },
    { value: 'es', label: 'Espagne' },
    { value: 'it', label: 'Italie' },
    { value: 'pt', label: 'Portugal' },
    { value: 'nl', label: 'Pays-Bas' },
  ];
  
  const cities: ComboboxItem[] = [
    { value: 'paris', label: 'Paris' },
    { value: 'lyon', label: 'Lyon' },
    { value: 'marseille', label: 'Marseille' },
    { value: 'toulouse', label: 'Toulouse' },
    { value: 'bordeaux', label: 'Bordeaux' },
    { value: 'lille', label: 'Lille' },
    { value: 'nantes', label: 'Nantes' },
    { value: 'strasbourg', label: 'Strasbourg' },
  ];
  
  interface UserItem extends ComboboxItem {
    email: string;
  }
  
  const users: UserItem[] = [
    { value: 1, label: 'Jean Dupont', email: 'jean@example.com' },
    { value: 2, label: 'Marie Martin', email: 'marie@example.com' },
    { value: 3, label: 'Pierre Durand', email: 'pierre@example.com' },
    { value: 4, label: 'Sophie Bernard', email: 'sophie@example.com' },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">
          Composants UI
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Composants avec CVA, CSS variables, multi-thèmes et dark mode ready
        </p>
      </div>

      {/* Button Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Button</h2>
          <p className="text-[var(--text-secondary)]">
            Variantes: <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">intent</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">size</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">tone</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">radius</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">density</code>
          </p>
        </div>

        {/* Intent variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Intent variants</h3>
          <div className="flex flex-wrap gap-3">
            <Button intent="primary">Primary</Button>
            <Button intent="accent">Accent</Button>
            <Button intent="secondary">Secondary</Button>
            <Button intent="success">Success</Button>
            <Button intent="danger">Danger</Button>
            <Button intent="ghost">Ghost</Button>
            <Button intent="outline">Outline</Button>
            <Button intent="link">Link</Button>
          </div>
        </div>

        {/* Size variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Size variants</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
            <Button size="icon" aria-label="Icon button">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </Button>
          </div>
        </div>

        {/* Tone variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Tone variants (focus ring)</h3>
          <div className="flex flex-wrap gap-3">
            <Button tone="brand">Brand tone</Button>
            <Button tone="semantic">Semantic tone</Button>
            <Button tone="neutral">Neutral tone</Button>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            💡 Utilisez Tab pour voir le focus ring coloré selon le tone
          </p>
        </div>

        {/* Radius variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Radius variants</h3>
          <div className="flex flex-wrap gap-3">
            <Button radius="none">None</Button>
            <Button radius="sm">Small</Button>
            <Button radius="md">Medium</Button>
            <Button radius="lg">Large</Button>
            <Button radius="xl">XL</Button>
            <Button radius="full">Full</Button>
          </div>
        </div>

        {/* Density variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Density variants</h3>
          <div className="flex flex-wrap gap-3">
            <Button density="comfy">Comfy (default)</Button>
            <Button density="compact">Compact</Button>
          </div>
        </div>

        {/* Disabled state */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Disabled state</h3>
          <div className="flex flex-wrap gap-3">
            <Button disabled>Primary Disabled</Button>
            <Button intent="outline" disabled>Outline Disabled</Button>
            <Button intent="ghost" disabled>Ghost Disabled</Button>
          </div>
        </div>

        {/* asChild composition */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">asChild composition</h3>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/ui-kit">Lien avec style Button</a>
            </Button>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            💡 Utilise <code className="px-1 bg-[var(--bg-secondary)] rounded">@radix-ui/react-slot</code> pour appliquer les styles à un enfant
          </p>
        </div>
      </section>

      {/* Input Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Input</h2>
          <p className="text-[var(--text-secondary)]">
            Variantes: <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">size</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">state</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">radius</code>
          </p>
        </div>

        {/* State variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">State variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Default state
              </label>
              <Input 
                placeholder="Entrez votre email" 
                state="default"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-error)] mb-2">
                Error state
              </label>
              <Input 
                placeholder="Email invalide" 
                state="error"
              />
              <p className="mt-1 text-sm text-[var(--color-error)]">Email requis</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-success)] mb-2">
                Success state
              </label>
              <Input 
                placeholder="Email valide" 
                state="success"
              />
              <p className="mt-1 text-sm text-[var(--color-success)]">Email disponible</p>
            </div>
          </div>
        </div>

        {/* Size variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Size variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input size="sm" placeholder="Small input" />
            <Input size="md" placeholder="Medium input (default)" />
            <Input size="lg" placeholder="Large input" />
          </div>
        </div>

        {/* Radius variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Radius variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input radius="sm" placeholder="Small radius" />
            <Input radius="md" placeholder="Medium radius" />
            <Input radius="lg" placeholder="Large radius" />
            <Input radius="full" placeholder="Full radius" />
          </div>
        </div>

        {/* With icons */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">With icons</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              placeholder="Search..." 
              leftIcon={
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              }
            />
            <Input 
              placeholder="Email address" 
              type="email"
              rightIcon={
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              }
            />
          </div>
        </div>

        {/* Disabled state */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Disabled state</h3>
          <div className="max-w-md">
            <Input placeholder="Disabled input" disabled />
          </div>
        </div>
      </section>

      {/* Combobox Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Combobox</h2>
          <p className="text-[var(--text-secondary)]">
            Sélecteur avec recherche, keyboard navigation, CVA variants
          </p>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">
            💡 Basé sur Radix UI Popover + cmdk • Utilisez Arrow Up/Down, Enter, Escape
          </p>
        </div>

        {/* Simple usage */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Simple list</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Sélectionner un pays
            </label>
            <Combobox
              items={countries}
              value={selectedCountry}
              onChange={(value) => setSelectedCountry(value)}
              placeholder="Choisir un pays"
              searchPlaceholder="Rechercher un pays..."
              aria-label="Sélection de pays"
            />
            {selectedCountry && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Sélectionné: <strong>{countries.find(c => c.value === selectedCountry)?.label}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Searchable list */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Searchable list</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Sélectionner une ville
            </label>
            <Combobox
              items={cities}
              value={selectedCity}
              onChange={(value) => setSelectedCity(value)}
              placeholder="Choisir une ville"
              searchPlaceholder="Rechercher une ville..."
              emptyText="Aucune ville trouvée"
            />
          </div>
        </div>

        {/* With custom rendering */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Custom rendering</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Sélectionner un utilisateur
            </label>
            <Combobox
              items={users}
              value={selectedUser}
              onChange={(value) => setSelectedUser(value)}
              placeholder="Choisir un utilisateur"
              searchPlaceholder="Rechercher..."
              renderItem={(user) => (
                <div className="flex flex-col">
                  <span className="font-medium">{user.label}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">{user.email}</span>
                </div>
              )}
            />
          </div>
        </div>

        {/* Size variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Size variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Combobox
              items={countries}
              size="sm"
              placeholder="Small (sm)"
            />
            <Combobox
              items={countries}
              size="md"
              placeholder="Medium (md)"
            />
            <Combobox
              items={countries}
              size="lg"
              placeholder="Large (lg)"
            />
          </div>
        </div>

        {/* Radius variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Radius variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Combobox
              items={countries}
              radius="sm"
              placeholder="Small radius"
            />
            <Combobox
              items={countries}
              radius="md"
              placeholder="Medium radius"
            />
            <Combobox
              items={countries}
              radius="lg"
              placeholder="Large radius"
            />
            <Combobox
              items={countries}
              radius="full"
              placeholder="Full radius"
            />
          </div>
        </div>

        {/* Density variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Density variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Combobox
              items={countries}
              density="compact"
              placeholder="Compact density"
            />
            <Combobox
              items={countries}
              density="comfy"
              placeholder="Comfy density"
            />
          </div>
        </div>

        {/* States */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">States</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Loading state
              </label>
              <Combobox
                items={[]}
                loading
                placeholder="Chargement..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Disabled state
              </label>
              <Combobox
                items={countries}
                disabled
                placeholder="Disabled"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dialog Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Dialog</h2>
          <p className="text-[var(--text-secondary)]">
            Modal avec overlay, animations, z-index tokens et CSS variables
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Examples</h3>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Ouvrir Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Êtes-vous sûr ?</DialogTitle>
                  <DialogDescription>
                    Cette action est irréversible. Les données seront supprimées définitivement.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button intent="outline">
                    Annuler
                  </Button>
                  <Button intent="danger">
                    Confirmer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button intent="accent">Dialog avec formulaire</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un compte</DialogTitle>
                  <DialogDescription>
                    Remplissez le formulaire ci-dessous pour créer votre compte.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Nom complet
                    </label>
                    <Input placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Email
                    </label>
                    <Input 
                      type="email" 
                      placeholder="john@example.com"
                      leftIcon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2"/>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Mot de passe
                    </label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                </div>
                <DialogFooter>
                  <Button intent="outline">
                    Annuler
                  </Button>
                  <Button intent="success">
                    Créer le compte
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      {/* ProductCard Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">ProductCard</h2>
          <p className="text-[var(--text-secondary)]">
            Pattern métier stateless pour affichage produit. Variantes: <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">variant</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">density</code>,{' '}
            <code className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-sm">radius</code>
          </p>
        </div>

        {/* Default Product Cards Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Cas d'usage réels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Promo Active */}
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Filtre à huile MANN-FILTER"
              badge="-20%"
              badgeVariant="promo"
              title="Filtre à huile MANN-FILTER W 712/75"
              subtitle="Compatible Renault Clio 4"
              price="29.99€"
              oldPrice="37.49€"
              stock="in-stock"
              rating={4.5}
              reviewCount={127}
              onCtaClick={() => console.log('Ajouté au panier')}
            />

            {/* Card 2: New Product */}
            <ProductCard
              image="https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=400"
              imageAlt="Kit de freinage complet"
              badge="NOUVEAU"
              badgeVariant="new"
              title="Kit freinage avant Brembo"
              subtitle="Disques + Plaquettes"
              price="189.90€"
              stock="in-stock"
              rating={5}
              reviewCount={43}
              onCtaClick={() => console.log('Ajouté au panier')}
              variant="elevated"
            />

            {/* Card 3: Low Stock */}
            <ProductCard
              image="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400"
              imageAlt="Batterie Varta Blue"
              title="Batterie Varta Blue Dynamic E11"
              subtitle="74Ah 680A - 5 ans garantie"
              price="119.99€"
              stock="low-stock"
              rating={4}
              reviewCount={89}
              onCtaClick={() => console.log('Ajouté au panier')}
              density="compact"
            />

            {/* Card 4: Out of Stock */}
            <ProductCard
              image="https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400"
              imageAlt="Amortisseur Bilstein B6"
              title="Amortisseur Bilstein B6 Performance"
              subtitle="Arrière gauche/droite"
              price="149.90€"
              stock="out-of-stock"
              rating={4.8}
              reviewCount={201}
              onCtaClick={() => console.log('Ajouté au panier')}
              variant="outlined"
            />

            {/* Card 5: No CTA */}
            <ProductCard
              image="https://images.unsplash.com/photo-1600093377942-3d68e8ba4d38?w=400"
              imageAlt="Huile moteur Castrol"
              title="Huile moteur Castrol Edge 5W-30"
              subtitle="Bidon 5L - Longlife III"
              price="54.90€"
              stock="in-stock"
              footer={
                <div className="flex gap-2">
                  <Button size="sm" intent="outline" className="flex-1">
                    Détails
                  </Button>
                  <Button size="sm" intent="primary" className="flex-1">
                    Acheter
                  </Button>
                </div>
              }
            />

            {/* Card 6: Compact Density */}
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Filtre à air"
              title="Filtre à air K&N 33-2304"
              subtitle="Lavable et réutilisable"
              price="64.90€"
              stock="in-stock"
              density="compact"
              radius="sm"
              onCtaClick={() => console.log('Ajouté au panier')}
            />

            {/* Card 7: Spacious Density */}
            <ProductCard
              image="https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=400"
              imageAlt="Kit distribution"
              badge="KIT COMPLET"
              badgeVariant="stock"
              title="Kit distribution complet Gates"
              subtitle="Courroie + Galets + Pompe à eau"
              price="229.90€"
              oldPrice="279.90€"
              stock="in-stock"
              rating={4.7}
              reviewCount={156}
              density="spacious"
              radius="xl"
              onCtaClick={() => console.log('Ajouté au panier')}
            />

            {/* Card 8: Flat Variant */}
            <ProductCard
              image="https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400"
              imageAlt="Bougie d'allumage"
              title="Bougies NGK Iridium IX"
              subtitle="Lot de 4 bougies"
              price="39.90€"
              stock="in-stock"
              variant="flat"
              radius="md"
              onCtaClick={() => console.log('Ajouté au panier')}
            />
          </div>
        </div>

        {/* Variant Comparison */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Comparaison variants</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Variant Default"
              title="Variant Default"
              subtitle="Border + Hover effect"
              price="99.90€"
              variant="default"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Variant Outlined"
              title="Variant Outlined"
              subtitle="Transparent + Border"
              price="99.90€"
              variant="outlined"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Variant Elevated"
              title="Variant Elevated"
              subtitle="Shadow + Hover lift"
              price="99.90€"
              variant="elevated"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Variant Flat"
              title="Variant Flat"
              subtitle="Subtle background"
              price="99.90€"
              variant="flat"
              onCtaClick={() => {}}
            />
          </div>
        </div>

        {/* Image Aspect Ratios */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Ratios d'image</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"
              imageAlt="Square aspect"
              imageAspectRatio="square"
              title="Square (1:1)"
              price="99.90€"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=533"
              imageAlt="Portrait aspect"
              imageAspectRatio="portrait"
              title="Portrait (3:4)"
              price="99.90€"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=533&h=400"
              imageAlt="Landscape aspect"
              imageAspectRatio="landscape"
              title="Landscape (4:3)"
              price="99.90€"
              onCtaClick={() => {}}
            />
            <ProductCard
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=711&h=400"
              imageAlt="Wide aspect"
              imageAspectRatio="wide"
              title="Wide (16:9)"
              price="99.90€"
              onCtaClick={() => {}}
            />
          </div>
        </div>
      </section>

      {/* Info box */}
      <div className="border-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)] p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
          ✅ Règles "Pro-Ready" respectées
        </h3>
        <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
          <li>✅ Zéro HEX dans le code (uniquement CSS variables)</li>
          <li>✅ Tous les composants couvrent <code className="px-1 bg-white rounded">focus-visible</code> avec ring</li>
          <li>✅ Variantes via <code className="px-1 bg-white rounded">cva</code> (intent, size, tone, radius, density, state)</li>
          <li>✅ Slots <code className="px-1 bg-white rounded">asChild</code> partout pour composition</li>
          <li>✅ Support multi-thèmes (vitrine/admin) via <code className="px-1 bg-white rounded">[data-theme]</code></li>
          <li>✅ Dark mode ready via <code className="px-1 bg-white rounded">[data-mode]</code></li>
          <li>✅ Composants stateless (pas de fetch, pas de state global)</li>
        </ul>
      </div>

      {/* Planned Components */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Composants planifiés
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Button', status: 'planned' },
            { name: 'Dialog', status: 'planned' },
            { name: 'Input', status: 'planned' },
            { name: 'Select', status: 'planned' },
            { name: 'Checkbox', status: 'planned' },
            { name: 'Radio', status: 'planned' },
            { name: 'Switch', status: 'planned' },
            { name: 'Tabs', status: 'planned' },
            { name: 'Card', status: 'planned' },
            { name: 'Badge', status: 'planned' },
            { name: 'Alert', status: 'planned' },
            { name: 'Toast', status: 'planned' },
          ].map((component) => (
            <div 
              key={component.name}
              className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-4 text-center"
            >
              <div className="text-2xl mb-2">📦</div>
              <div className="font-medium text-secondary-900 dark:text-white text-sm">
                {component.name}
              </div>
              <span className="inline-block mt-2 px-2 py-0.5 bg-secondary-100 text-xs text-secondary-600 rounded">
                {component.status === 'planned' ? 'Planifié' : 'En cours'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Info */}
      <div className="mt-12 bg-brand-50 border border-brand-200 rounded-lg p-6">
        <h3 className="font-bold text-brand-900 mb-3 flex items-center gap-2">
          <span>📋</span>
          <span>Plan de migration</span>
        </h3>
        
        <ol className="space-y-2 text-sm text-brand-700">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Migrer Button, Dialog, Input de <code className="px-1 py-0.5 bg-brand-100 rounded">frontend/app/components/ui/</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Remplacer HEX par tokens (<code className="px-1 py-0.5 bg-brand-100 rounded">bg-primary-600</code> au lieu de <code className="px-1 py-0.5 bg-brand-100 rounded">#ff6b35</code>)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>Ajouter variants CVA (size, variant, state)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>Tests Vitest + Playwright snapshots</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">5.</span>
            <span>Documentation Storybook (optionnel)</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
