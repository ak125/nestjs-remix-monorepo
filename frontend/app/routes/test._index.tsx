import { Link } from "@remix-run/react";

export default function TestIndex() {
  const tests = [
    {
      title: "⏳ Skeleton Components",
      description: "6 variantes de loading skeletons avec animations fluides (1.5s ease-in-out)",
      href: "/test/skeletons",
      features: [
        "ProductCard, CartItem, SearchResults",
        "Page, Card, Basic skeletons",
        "Auto-reload demo (toggle 3s)",
        "Mixed layout (sidebar + main)"
      ],
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "⚡ Optimistic UI",
      description: "Micro-interactions & feedback instantané avec revert automatique",
      href: "/test/optimistic-ui",
      features: [
        "AddToCart avec flying animation (600ms)",
        "Badge bounce (compteur panier)",
        "Toast notifications (4 types)",
        "Timing standards (100/150/200/250ms)"
      ],
      color: "bg-green-600 hover:bg-green-700"
    },
    {
      title: "🛒 Cart Drawer Features",
      description: "Seuil franco, ETA livraison, upsell recommendations",
      href: "/test/cart-drawer",
      features: [
        "Seuil franco 150€ avec progress bar",
        "ETA dynamique (2-3j ou 3-5j)",
        "Upsell si < 5 items",
        "Visual stats dashboard"
      ],
      color: "bg-purple-600 hover:bg-purple-700"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-t-4 border-blue-600">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🧪 Test Suite - Motion & Feedback
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Composants de test pour valider les micro-interactions, skeletons et optimistic UI
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              React 18/19
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              Remix 2.x
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Tailwind CSS
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              CSS Animations
            </span>
          </div>
        </div>

        {/* Test Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {tests.map((test) => (
            <Link
              key={test.href}
              to={test.href}
              className="group bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300 hover:-translate-y-1"
            >
              <div className={`${test.color} text-white p-6 transition-colors`}>
                <h2 className="text-2xl font-bold mb-2">{test.title}</h2>
                <p className="text-white/90 text-sm">{test.description}</p>
              </div>
              
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                  Features
                </h3>
                <ul className="space-y-2">
                  {test.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6">
                <div className="flex items-center text-blue-600 font-semibold group-hover:text-blue-700">
                  <span>Tester maintenant</span>
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Documentation Links */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📚 Documentation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/OPTIMISTIC-UI-DOCUMENTATION.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                📖
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Optimistic UI Docs</h3>
                <p className="text-sm text-gray-600">Guide complet (800 lignes)</p>
              </div>
            </a>

            <a
              href="/SKELETON-TEST-GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">
                📋
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Skeleton Test Guide</h3>
                <p className="text-sm text-gray-600">Checklist de test (200 lignes)</p>
              </div>
            </a>

            <a
              href="/MOTION-FEEDBACK-FINAL-REPORT.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">
                📊
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Final Report</h3>
                <p className="text-sm text-gray-600">Rapport complet (600 lignes)</p>
              </div>
            </a>

            <a
              href="/ECOMMERCE-FEATURES.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center font-bold">
                🛒
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">E-commerce Features</h3>
                <p className="text-sm text-gray-600">CartDrawer, Filters, Presets</p>
              </div>
            </a>
          </div>
        </div>

        {/* Timing Standards */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            ⏱️ Timing Standards
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">100ms</div>
              <div className="text-sm text-gray-600">Instant</div>
              <div className="text-xs text-gray-500 mt-1">Hover feedback</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">150ms</div>
              <div className="text-sm text-gray-600">Fast</div>
              <div className="text-xs text-gray-500 mt-1">Press, micro</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">200ms</div>
              <div className="text-sm text-gray-600">Normal</div>
              <div className="text-xs text-gray-500 mt-1">Enter/exit</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-1">250ms</div>
              <div className="text-sm text-gray-600">Slow</div>
              <div className="text-xs text-gray-500 mt-1">Complex</div>
            </div>
          </div>
        </div>

        {/* Accessibility */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            ♿ Accessibilité (WCAG AA)
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-yellow-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>prefers-reduced-motion</strong>: Animations désactivées si préférence</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Contraste</strong>: Minimum 4.5:1 (WCAG AA)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Focus visible</strong>: Ring bleu 2px sur tous éléments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Keyboard nav</strong>: Tab/Enter/Escape fonctionnels</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Motion & Feedback v1.0.0 - Généré le 25 octobre 2025</p>
          <p className="mt-1">
            React 18/19 • Remix 2.x • Tailwind CSS • CSS Animations
          </p>
        </div>

      </div>
    </div>
  );
}
