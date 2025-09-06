/**
 * 🎯 HEADER V8 MODULAIRE - Approche hybride optimale
 * 
 * UN seul Header avec variants spécialisés :
 * - HeaderV8.Basic (minimal)
 * - HeaderV8.Ecommerce (complet)
 * - HeaderV8.Admin (interface admin)
 * - HeaderV8.Custom (configurable)
 */

import { HeaderV8Enhanced } from "./HeaderV8Enhanced";

// 🏢 Header V8 Basic - Sites vitrines, landing pages
export function HeaderV8Basic(props: any) {
  return (
    <HeaderV8Enhanced
      {...props}
      variant="basic"
      features={['logo', 'navigation']}
      showTopBar={false}
      showSecondaryNav={false}
      showSearch={false}
      showCart={false}
      className="header--v8-basic"
    />
  );
}

// 🛒 Header V8 Ecommerce - E-commerce complet
export function HeaderV8Ecommerce(props: any) {
  return (
    <HeaderV8Enhanced
      {...props}
      variant="ecommerce"
      features={['logo', 'navigation', 'search', 'cart', 'user']}
      showTopBar={true}
      showSecondaryNav={true}
      showSearch={true}
      showCart={true}
      className="header--v8-ecommerce"
    />
  );
}

// ⚙️ Header V8 Admin - Interface administration
export function HeaderV8Admin(props: any) {
  return (
    <HeaderV8Enhanced
      {...props}
      variant="admin"
      features={['logo', 'navigation', 'search', 'user', 'notifications']}
      showTopBar={false}
      showSecondaryNav={true}
      showSearch={true}
      showCart={false}
      theme="admin"
      className="header--v8-admin"
    />
  );
}

// 🎨 Header V8 Custom - Configurable
export function HeaderV8Custom(props: any) {
  return (
    <HeaderV8Enhanced
      {...props}
      variant="custom"
      className="header--v8-custom"
    />
  );
}

// 🚀 Export principal - Auto-détection du variant
export function HeaderV8(props: any) {
  const { variant = 'auto', context = 'public', ...otherProps } = props;

  // Auto-détection basée sur le contexte
  if (variant === 'auto') {
    switch (context) {
      case 'admin':
        return <HeaderV8Admin {...otherProps} context={context} />;
      case 'commercial':
        return <HeaderV8Ecommerce {...otherProps} context={context} />;
      case 'public':
      default:
        return <HeaderV8Ecommerce {...otherProps} context={context} />;
    }
  }

  // Variant explicite
  switch (variant) {
    case 'basic':
      return <HeaderV8Basic {...otherProps} context={context} />;
    case 'ecommerce':
      return <HeaderV8Ecommerce {...otherProps} context={context} />;
    case 'admin':
      return <HeaderV8Admin {...otherProps} context={context} />;
    case 'custom':
      return <HeaderV8Custom {...otherProps} context={context} />;
    default:
      return <HeaderV8Enhanced {...otherProps} context={context} />;
  }
}

// 🎯 Usage examples:
/*

// Auto-détection
<HeaderV8 context="admin" />        // → HeaderV8Admin
<HeaderV8 context="public" />       // → HeaderV8Ecommerce

// Variant explicite
<HeaderV8 variant="basic" />        // → HeaderV8Basic
<HeaderV8 variant="ecommerce" />    // → HeaderV8Ecommerce
<HeaderV8 variant="admin" />        // → HeaderV8Admin

// Configuration manuelle
<HeaderV8 
  variant="custom"
  features={['logo', 'search']}
  showTopBar={false}
  theme="automotive"
/>

*/
