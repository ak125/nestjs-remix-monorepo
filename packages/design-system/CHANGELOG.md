# @monorepo/design-system

## Changelog

### [1.0.0] - 2025-10-22

#### ✨ Initial Release

- **Design Tokens** : 140+ tokens (colors, spacing, typography, shadows, etc.)
- **Theme System** : Multi-brand (vitrine/admin) × Multi-mode (light/dark)
- **Build System** : tsup avec CJS + ESM + TypeScript definitions
- **Tree-shaking** : Exports modulaires optimisés
- **Type Safety** : TypeScript strict + auto-generated types
- **Quality** : ESLint anti-HEX, Vitest tests
- **Documentation** : README, CONTRIBUTING, QUICKSTART

#### 🎨 Tokens

- Colors : primary, secondary, accent, semantic, neutral
- Spacing : Scale 0-32 (4px base)
- Typography : fontFamily, fontSize, lineHeight, fontWeight
- Shadows : 7 levels (sm → 2xl + inner)
- Border Radius : 8 values (sm → full)
- Transitions : 4 speeds
- Z-index : 7 layers

#### 🎭 Themes

- **Vitrine** : Public website theme
  - Light mode
  - Dark mode
- **Admin** : Backoffice theme
  - Light mode
  - Dark mode

#### 🧩 Components

- Ready for migration (structure in place)
- CVA variants system
- Radix UI primitives

#### 📦 Exports

- `@monorepo/design-system` - Barrel export
- `@monorepo/design-system/tokens` - Design tokens
- `@monorepo/design-system/themes` - Theme system
- `@monorepo/design-system/components` - UI components (coming)
- `@monorepo/design-system/patterns` - Compositional patterns (coming)
- `@monorepo/design-system/styles` - Global styles

#### 🧪 Testing

- 8/8 sanity tests passing
- Vitest configured
- Coverage setup

#### 📚 Documentation

- README.md - Complete documentation
- CONTRIBUTING.md - Contribution guide
- QUICKSTART.md - Quick start guide
- API documentation via TypeScript types
