/**
 * Interface React pour l'authentification utilisateur
 * Basée sur l'analyse legacy de myspace.connect.php et myspace.subscribe.php
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword } from '../utils/validation';
import { toast } from 'react-toastify';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  newsletter: boolean;
  acceptTerms: boolean;
}

export const AuthenticationPage: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });
  const [registerData, setRegisterData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    tel: '',
    address: '',
    city: '',
    zipCode: '',
    country: 'FR',
    newsletter: false,
    acceptTerms: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Récupération de l'URL de redirection (legacy myspace.connect.php)
  const redirectUrl = (location.state as any)?.from?.pathname || '/myspace/account';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl]);

  // Validation côté client (reproduction du comportement legacy)
  const validateLoginForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!loginData.email.trim()) {
      newErrors.email = 'L\'adresse email est requise';
    } else if (!validateEmail(loginData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    if (!loginData.password.trim()) {
      newErrors.password = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email
    if (!registerData.email.trim()) {
      newErrors.email = 'L\'adresse email est requise';
    } else if (!validateEmail(registerData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    // Mot de passe
    if (!registerData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (!validatePassword(registerData.password)) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères avec majuscules, minuscules et chiffres';
    }

    // Confirmation mot de passe
    if (registerData.password !== registerData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    // Prénom et nom
    if (!registerData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }
    if (!registerData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }

    // Téléphone (format français)
    if (!registerData.tel.trim()) {
      newErrors.tel = 'Le numéro de téléphone est requis';
    } else if (!/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/.test(registerData.tel)) {
      newErrors.tel = 'Format de téléphone invalide';
    }

    // Adresse
    if (!registerData.address.trim()) {
      newErrors.address = 'L\'adresse est requise';
    }
    if (!registerData.city.trim()) {
      newErrors.city = 'La ville est requise';
    }

    // Code postal français
    if (!registerData.zipCode.trim()) {
      newErrors.zipCode = 'Le code postal est requis';
    } else if (!/^\d{5}$/.test(registerData.zipCode)) {
      newErrors.zipCode = 'Le code postal doit contenir 5 chiffres';
    }

    // Conditions générales
    if (!registerData.acceptTerms) {
      newErrors.acceptTerms = 'Vous devez accepter les conditions générales';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked) {
      toast.error('Trop de tentatives de connexion. Veuillez attendre avant de réessayer.');
      return;
    }

    if (!validateLoginForm()) return;

    setIsLoading(true);
    try {
      await login(loginData.email, loginData.password, loginData.rememberMe);
      toast.success('Connexion réussie !');
      setLoginAttempts(0);
    } catch (error: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      // Blocage après 5 tentatives (sécurité legacy)
      if (newAttempts >= 5) {
        setIsBlocked(true);
        setTimeout(() => {
          setIsBlocked(false);
          setLoginAttempts(0);
        }, 15 * 60 * 1000); // 15 minutes
        toast.error('Compte temporairement bloqué après 5 tentatives échouées');
      } else {
        toast.error(error.message || 'Identifiants incorrects');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegisterForm()) return;

    setIsLoading(true);
    try {
      await register({
        email: registerData.email,
        password: registerData.password,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        tel: registerData.tel,
        address: registerData.address,
        city: registerData.city,
        zipCode: registerData.zipCode,
        country: registerData.country,
        newsletter: registerData.newsletter
      });
      
      toast.success('Compte créé avec succès ! Un email de confirmation vous a été envoyé.');
      setIsLoginMode(true);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img
            className="h-12 w-auto"
            src="/logo.png"
            alt="Logo"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isLoginMode ? 'Connexion à votre compte' : 'Créer un compte'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isLoginMode ? (
            <>
              Pas encore de compte ?{' '}
              <button
                onClick={() => setIsLoginMode(false)}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Créez-en un gratuitement
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{' '}
              <button
                onClick={() => setIsLoginMode(true)}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Connectez-vous
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {isLoginMode ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Adresse email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="votre.email@exemple.com"
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={loginData.rememberMe}
                    onChange={(e) => setLoginData({...loginData, rememberMe: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Se souvenir de moi
                  </label>
                </div>

                <div className="text-sm">
                  <a
                    href="/auth/forgot-password"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || isBlocked}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </button>
              </div>

              {loginAttempts > 0 && !isBlocked && (
                <div className="rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Attention
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          {loginAttempts}/5 tentatives échouées. 
                          Votre compte sera temporairement bloqué après 5 échecs.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleRegister}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={registerData.firstName}
                    onChange={(e) => setRegisterData({...registerData, firstName: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.firstName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Nom *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData({...registerData, lastName: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.lastName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Adresse email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="votre.email@exemple.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="tel" className="block text-sm font-medium text-gray-700">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  id="tel"
                  value={registerData.tel}
                  onChange={(e) => setRegisterData({...registerData, tel: e.target.value})}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    errors.tel ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="01 23 45 67 89"
                />
                {errors.tel && (
                  <p className="mt-1 text-sm text-red-600">{errors.tel}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirmer le mot de passe *
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Adresse *
                </label>
                <input
                  type="text"
                  id="address"
                  value={registerData.address}
                  onChange={(e) => setRegisterData({...registerData, address: e.target.value})}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    errors.address ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="123 Rue de la Paix"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                    Code postal *
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    value={registerData.zipCode}
                    onChange={(e) => setRegisterData({...registerData, zipCode: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.zipCode ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="75001"
                  />
                  {errors.zipCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.zipCode}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    Ville *
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={registerData.city}
                    onChange={(e) => setRegisterData({...registerData, city: e.target.value})}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.city ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Paris"
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Pays
                </label>
                <select
                  id="country"
                  value={registerData.country}
                  onChange={(e) => setRegisterData({...registerData, country: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                  <option value="CH">Suisse</option>
                  <option value="CA">Canada</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    id="newsletter"
                    type="checkbox"
                    checked={registerData.newsletter}
                    onChange={(e) => setRegisterData({...registerData, newsletter: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="newsletter" className="ml-2 block text-sm text-gray-900">
                    Je souhaite recevoir la newsletter et les offres promotionnelles
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={registerData.acceptTerms}
                    onChange={(e) => setRegisterData({...registerData, acceptTerms: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                    J'accepte les{' '}
                    <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
                      conditions générales
                    </a>{' '}
                    et la{' '}
                    <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">
                      politique de confidentialité
                    </a>
                    *
                  </label>
                </div>
                {errors.acceptTerms && (
                  <p className="text-sm text-red-600">{errors.acceptTerms}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Création du compte...' : 'Créer mon compte'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
