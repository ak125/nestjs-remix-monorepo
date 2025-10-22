#!/bin/bash
# 🚀 Script de migration des composants UI vers le Design System
# Usage: ./migrate-component.sh button

set -e

COMPONENT_NAME=$1
FRONTEND_PATH="../../frontend/app/components/ui"
DS_PATH="../design-system/src/components"

if [ -z "$COMPONENT_NAME" ]; then
  echo "❌ Usage: ./migrate-component.sh <component-name>"
  echo "Exemple: ./migrate-component.sh button"
  exit 1
fi

SOURCE_FILE="$FRONTEND_PATH/${COMPONENT_NAME}.tsx"
DEST_FILE="$DS_PATH/${COMPONENT_NAME}.tsx"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ Composant non trouvé: $SOURCE_FILE"
  exit 1
fi

echo "📦 Migration de $COMPONENT_NAME..."
echo ""

# Copie du composant
cp "$SOURCE_FILE" "$DEST_FILE"
echo "✅ Copié vers: $DEST_FILE"

# Création du story Storybook
STORY_FILE="$DS_PATH/${COMPONENT_NAME}.stories.tsx"
cat > "$STORY_FILE" << EOF
import type { Meta, StoryObj } from '@storybook/react';
import { ${COMPONENT_NAME^} } from './${COMPONENT_NAME}';

const meta = {
  title: 'Components/${COMPONENT_NAME^}',
  component: ${COMPONENT_NAME^},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ${COMPONENT_NAME^}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // À compléter
  },
};
EOF

echo "✅ Story créé: $STORY_FILE"

# Création du test
TEST_FILE="$DS_PATH/${COMPONENT_NAME}.test.tsx"
cat > "$TEST_FILE" << EOF
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ${COMPONENT_NAME^} } from './${COMPONENT_NAME}';

describe('${COMPONENT_NAME^}', () => {
  it('should render', () => {
    render(<${COMPONENT_NAME^}>Test</${COMPONENT_NAME^}>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
EOF

echo "✅ Test créé: $TEST_FILE"

echo ""
echo "🎉 Migration terminée !"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Vérifier les imports dans $DEST_FILE"
echo "2. Remplacer les imports locaux par @monorepo/design-system"
echo "3. Compléter le story dans $STORY_FILE"
echo "4. Ajouter des tests dans $TEST_FILE"
echo "5. Exporter depuis src/components/index.ts"
echo ""
echo "Pour tester:"
echo "  cd packages/design-system"
echo "  npm run build"
echo "  npm run test"
