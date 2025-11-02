import { useEffect, useRef, useState } from 'react';

export default function PaymentRedirect() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ url: string; parameters: Record<string, string> } | null>(null);

  useEffect(() => {
    console.log('🔵 Payment redirect page loaded');
    
    // Récupérer le HTML depuis sessionStorage
    const html = sessionStorage.getItem('systempay_html');
    
    if (!html) {
      console.error('❌ No HTML in sessionStorage');
      setError('Données de paiement manquantes');
      setTimeout(() => {
        window.location.href = '/checkout-payment';
      }, 2000);
      return;
    }
    
    console.log('✅ Got HTML from sessionStorage, length:', html.length);
    
    // Nettoyer le sessionStorage
    sessionStorage.removeItem('systempay_html');
    
    // Parser le HTML pour extraire l'URL et les paramètres
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const form = doc.querySelector('form');
    
    if (!form) {
      console.error('❌ No form in HTML');
      setError('Formulaire de paiement invalide');
      return;
    }
    
    const url = form.action;
    const inputs = form.querySelectorAll('input[type="hidden"]');
    const parameters: Record<string, string> = {};
    
    inputs.forEach((input) => {
      const name = input.getAttribute('name');
      const value = input.getAttribute('value');
      if (name && value) {
        parameters[name] = value;
      }
    });
    
    console.log('✅ Extracted form data:');
    console.log('  URL:', url);
    console.log('  Parameters:', Object.keys(parameters).length, 'fields');
    
    setFormData({ url, parameters });
  }, []);

  useEffect(() => {
    if (formData && formRef.current) {
      console.log('🚀 Form ready, details:');
      console.log('  - Action:', formRef.current.action);
      console.log('  - Method:', formRef.current.method);
      console.log('  - Inputs:', formRef.current.querySelectorAll('input').length);
      console.log('  - Form in DOM:', document.contains(formRef.current));
      
      console.log('🚀 Auto-submitting form in 1 second...');
      const timer = setTimeout(() => {
        console.log('🚀 Submitting form NOW');
        console.log('  - formRef.current:', formRef.current);
        
        if (formRef.current) {
          try {
            console.log('  - Calling submit()...');
            formRef.current.submit();
            console.log('  ✅ submit() called');
          } catch (err) {
            console.error('  ❌ submit() error:', err);
            alert('Erreur: ' + err);
          }
        } else {
          console.error('  ❌ formRef.current is null');
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      console.log('⚠️ Form not ready:', { formData: !!formData, formRef: !!formRef.current });
    }
  }, [formData]);

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#dc2626' }}>Erreur</h1>
          <p>{error}</p>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Redirection en cours...</p>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Chargement...</h1>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '5px solid #e5e7eb', 
            borderTop: '5px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Redirection vers le paiement sécurisé...</h1>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #e5e7eb', 
          borderTop: '5px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>
          Vous allez être redirigé vers SystemPay...
        </p>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
          Si la redirection ne fonctionne pas, cliquez sur le bouton ci-dessous
        </p>
      </div>

      {/* Formulaire caché qui se soumet automatiquement */}
      <form 
        ref={formRef}
        method="POST" 
        action={formData.url}
        style={{ display: 'none' }}
      >
        {Object.entries(formData.parameters).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button type="submit">Continuer vers SystemPay</button>
      </form>

      {/* Bouton de secours visible après 3 secondes */}
      <button
        onClick={() => formRef.current?.submit()}
        style={{
          marginTop: '24px',
          padding: '12px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        Cliquer ici si la redirection ne fonctionne pas
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
