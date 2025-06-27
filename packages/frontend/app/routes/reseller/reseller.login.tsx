/**
 * MCP GENERATED ROUTE - RESELLER AUTH
 * Généré automatiquement par MCP Context-7
 * Module: reseller-auth
 * Sécurité: Authentification revendeurs massdoc
 * Source: massdoc/get.access.php
 */
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, useActionData, useNavigation } from '@remix-run/react';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier si déjà connecté
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  
  // Si déjà authentifié, rediriger vers dashboard
  const existingSession = request.headers.get('cookie')?.includes('reseller-session');
  if (existingSession) {
    return redirect('/reseller/dashboard');
  }

  return json({
    error: error || null,
    timestamp: new Date().toISOString()
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const resellerCode = formData.get('resellerCode') as string;
  const password = formData.get('password') as string;
  const rememberMe = formData.get('rememberMe') === 'on';

  try {
    // Authentification revendeur
    const response = await fetch('/api/reseller/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resellerCode,
        password,
        rememberMe
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return json({ 
        error: result.message || 'Erreur d\'authentification',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Création de la session revendeur
    const sessionCookie = `reseller-session=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${rememberMe ? '604800' : '28800'}`;

    return redirect('/reseller/dashboard', {
      headers: {
        'Set-Cookie': sessionCookie
      }
    });

  } catch (error) {
    return json({ 
      error: 'Erreur de connexion au serveur',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export default function ResellerLogin() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);

  const isSubmitting = navigation.state === 'submitting';
  const error = actionData?.error || loaderData?.error;

  return (
    <div className="mcp-reseller-auth-container">
      <div className="reseller-login-card">
        <div className="reseller-header">
          <h1 className="mcp-title">🔒 Accès Revendeurs</h1>
          <div className="security-notice">
            <span>SECTION MASSDOC - REVENDEURS UNIQUEMENT</span>
          </div>
        </div>

        {error && (
          <div className="mcp-error-auth">
            <strong>❌ Erreur d'accès</strong>
            <p>{error}</p>
            <small>Vérifiez vos identifiants revendeur</small>
          </div>
        )}

        <Form method="post" className="mcp-reseller-form">
          <div className="form-group">
            <label htmlFor="resellerCode" className="form-label">
              Code Revendeur *
            </label>
            <input
              type="text"
              id="resellerCode"
              name="resellerCode"
              required
              disabled={isSubmitting}
              placeholder="Votre code revendeur"
              className="form-input reseller-input"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mot de passe *
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                required
                disabled={isSubmitting}
                placeholder="Votre mot de passe"
                className="form-input reseller-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                disabled={isSubmitting}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="rememberMe"
                disabled={isSubmitting}
                className="checkbox-input"
              />
              <span className="checkbox-text">
                Se souvenir de moi (7 jours)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mcp-button-reseller submit-button"
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Connexion en cours...
              </>
            ) : (
              'Accéder au massdoc'
            )}
          </button>
        </Form>

        <div className="reseller-login-footer">
          <div className="security-info">
            <h3>🛡️ Sécurité Renforcée</h3>
            <ul>
              <li>✅ Authentification revendeur unique</li>
              <li>✅ Accès aux tarifs préférentiels</li>
              <li>✅ Gestion de stock dédiée</li>
              <li>✅ Historique des commandes</li>
              <li>✅ Support technique prioritaire</li>
            </ul>
          </div>

          <div className="help-links">
            <a href="/reseller/forgot-password" className="help-link">
              Mot de passe oublié ?
            </a>
            <a href="/contact-reseller-support" className="help-link">
              Support revendeurs
            </a>
            <a href="/reseller/signup" className="help-link">
              Devenir revendeur
            </a>
          </div>

          <div className="version-info">
            <small>
              MCP Context-7 | Massdoc Secure Access
              <br />
              Version: 2.0 | Dernière mise à jour: {new Date().toLocaleDateString()}
            </small>
          </div>
        </div>
      </div>

      <style jsx>{`
        .mcp-reseller-auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          padding: 20px;
        }

        .reseller-login-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          padding: 40px;
          max-width: 480px;
          width: 100%;
        }

        .reseller-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .mcp-title {
          color: #1e3c72;
          margin-bottom: 10px;
          font-size: 28px;
          font-weight: bold;
        }

        .security-notice {
          background: #f8f9fa;
          border: 2px solid #1e3c72;
          border-radius: 8px;
          padding: 12px;
          color: #1e3c72;
          font-weight: bold;
          font-size: 14px;
        }

        .mcp-error-auth {
          background: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          color: #c53030;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3748;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #1e3c72;
          box-shadow: 0 0 0 3px rgba(30, 60, 114, 0.1);
        }

        .reseller-input {
          background: #f7fafc;
        }

        .password-input-container {
          position: relative;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
        }

        .checkbox-group {
          display: flex;
          align-items: center;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .checkbox-input {
          margin-right: 8px;
        }

        .mcp-button-reseller {
          width: 100%;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 16px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .mcp-button-reseller:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(30, 60, 114, 0.3);
        }

        .mcp-button-reseller:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .reseller-login-footer {
          margin-top: 30px;
          text-align: center;
        }

        .security-info {
          background: #f0f7ff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .security-info h3 {
          margin-bottom: 12px;
          color: #1e3c72;
        }

        .security-info ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .security-info li {
          margin-bottom: 6px;
          font-size: 14px;
          color: #4a5568;
        }

        .help-links {
          margin-bottom: 20px;
        }

        .help-link {
          display: inline-block;
          margin: 0 12px;
          color: #1e3c72;
          text-decoration: none;
          font-size: 14px;
        }

        .help-link:hover {
          text-decoration: underline;
        }

        .version-info {
          color: #718096;
          font-size: 12px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
