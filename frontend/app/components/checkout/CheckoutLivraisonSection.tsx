import { Link } from "@remix-run/react";
import { useState } from "react";

import {
  validateShippingAddress,
  type CheckoutFieldErrors,
} from "~/schemas/checkout.schemas";

export interface ShippingAddress {
  civility: string;
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  zipCode: string;
  city: string;
  country: string;
}

interface Props {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  userProfile: {
    firstName: string;
    lastName: string;
    address: string;
    zipCode: string;
    city: string;
    country: string;
    phone: string;
  } | null;
  shippingAddress: ShippingAddress;
  onShippingAddressChange: (addr: ShippingAddress) => void;
  guestEmail: string;
  onGuestEmailChange: (email: string) => void;
  onValidated: () => void;
  fieldErrors?: Partial<Record<string, string[]>>;
}

export function CheckoutLivraisonSection({
  user,
  userProfile,
  shippingAddress,
  onShippingAddressChange,
  guestEmail,
  onGuestEmailChange,
  onValidated,
  fieldErrors,
}: Props) {
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const hasCompleteAddress = !!(
    userProfile &&
    userProfile.firstName?.trim() &&
    userProfile.lastName?.trim() &&
    userProfile.address?.trim() &&
    userProfile.zipCode?.trim() &&
    userProfile.city?.trim() &&
    userProfile.country?.trim()
  );
  const [isEditingAddress, setIsEditingAddress] = useState(!hasCompleteAddress);

  const handleEmailCheck = async () => {
    if (!guestEmail || !guestEmail.includes("@")) return;
    setIsCheckingEmail(true);
    try {
      const res = await fetch("/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail }),
      });
      const data = await res.json();
      setEmailExists(data.exists);
      setEmailChecked(true);
    } catch {
      setEmailChecked(true);
      setEmailExists(false);
    }
    setIsCheckingEmail(false);
  };

  const handleInlineLogin = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail, password: loginPassword }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ success: true }));
        if (data.success !== false) {
          window.location.href = "/checkout";
        } else {
          setLoginError(data.error || "Email ou mot de passe incorrect");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(
          data.message || data.error || "Email ou mot de passe incorrect",
        );
      }
    } catch {
      setLoginError("Erreur de connexion. Veuillez réessayer.");
    }
  };

  const showAddressForm = user || (emailChecked && !emailExists);

  const [localErrors, setLocalErrors] = useState<CheckoutFieldErrors | null>(
    null,
  );

  // Wrap parent onChange to clear local errors on edit
  const handleFieldChange = (updated: ShippingAddress) => {
    if (localErrors) setLocalErrors(null);
    onShippingAddressChange(updated);
  };

  const isAddressValid =
    shippingAddress.firstName.trim() &&
    shippingAddress.lastName.trim() &&
    shippingAddress.address.trim() &&
    shippingAddress.zipCode.trim() &&
    shippingAddress.city.trim();

  const handleContinue = () => {
    const errors = validateShippingAddress({
      ...shippingAddress,
      phone: shippingAddress.phone || "",
    });
    if (errors) {
      setLocalErrors(errors);
      // Scroll to first error field
      const firstField = [
        "firstName",
        "lastName",
        "address",
        "zipCode",
        "city",
        "phone",
      ].find((f) => errors[f as keyof CheckoutFieldErrors]);
      if (firstField) {
        setTimeout(() => {
          const el = document.querySelector(`[name="${firstField}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLInputElement)?.focus();
        }, 100);
      }
      return;
    }
    setLocalErrors(null);
    onValidated();
  };

  // Merge: parent fieldErrors (from server) + localErrors (from client)
  const mergedErrors = localErrors ?? fieldErrors ?? undefined;

  return (
    <div className="space-y-6 pt-2">
      {/* Utilisateur connecte */}
      {user && (
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-900">
                Connecte en tant que{" "}
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
              </p>
              <p className="text-xs text-emerald-700">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Email guest */}
      {!user && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="guestEmail"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Adresse email *
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                id="guestEmail"
                name="guestEmail"
                required
                value={guestEmail}
                onChange={(e) => {
                  onGuestEmailChange(e.target.value);
                  if (emailChecked) {
                    setEmailChecked(false);
                    setEmailExists(false);
                    setLoginError("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !emailChecked) {
                    e.preventDefault();
                    handleEmailCheck();
                  }
                }}
                autoComplete="email"
                className={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.guestEmail ? "border-red-400" : "border-slate-300"}`}
                placeholder="votre.email@exemple.com"
              />
              {mergedErrors?.guestEmail && (
                <p className="text-xs text-red-600 mt-1">
                  {mergedErrors.guestEmail[0]}
                </p>
              )}
              {!emailChecked && (
                <button
                  type="button"
                  onClick={handleEmailCheck}
                  disabled={isCheckingEmail || !guestEmail.includes("@")}
                  className="px-6 py-3 bg-cta text-white rounded-xl font-medium hover:bg-cta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isCheckingEmail ? "..." : "Continuer"}
                </button>
              )}
            </div>
          </div>

          {/* Email existe → login inline */}
          {emailChecked && emailExists && (
            <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
              <h3 className="font-semibold text-orange-900 mb-1">
                Un compte existe avec cet email
              </h3>
              <p className="text-sm text-orange-700 mb-4">
                Connectez-vous pour passer commande directement.
              </p>
              <div className="space-y-3">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleInlineLogin();
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Mot de passe"
                />
                {loginError && (
                  <p className="text-sm text-red-600">{loginError}</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleInlineLogin}
                    className="px-6 py-3 bg-cta text-white rounded-xl font-medium hover:bg-cta-hover transition-colors"
                  >
                    Se connecter
                  </button>
                  <Link
                    to={`/login?redirectTo=/checkout&email=${encodeURIComponent(guestEmail)}`}
                    className="text-sm text-orange-700 hover:underline"
                  >
                    Mot de passe oublie ?
                  </Link>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmailChecked(false);
                  setEmailExists(false);
                  onGuestEmailChange("");
                }}
                className="mt-3 text-sm text-slate-500 hover:underline"
              >
                Utiliser un autre email
              </button>
            </div>
          )}

          {/* Email nouveau → confirme */}
          {emailChecked && !emailExists && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-sm font-medium text-emerald-900">
                  {guestEmail}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmailChecked(false);
                    onGuestEmailChange("");
                  }}
                  className="ml-auto text-sm text-emerald-700 hover:underline"
                >
                  Modifier
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulaire adresse */}
      {showAddressForm && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center justify-between">
            Adresse de livraison
            {user && hasCompleteAddress && !isEditingAddress && (
              <button
                type="button"
                onClick={() => setIsEditingAddress(true)}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Modifier
              </button>
            )}
          </h3>

          {/* Mode recap */}
          {user && hasCompleteAddress && !isEditingAddress ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="font-medium text-slate-900">
                {shippingAddress.firstName} {shippingAddress.lastName}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {shippingAddress.address}
              </p>
              <p className="text-sm text-slate-600">
                {shippingAddress.zipCode} {shippingAddress.city},{" "}
                {shippingAddress.country}
              </p>
              {shippingAddress.phone && (
                <p className="text-sm text-slate-500 mt-1">
                  Tel: {shippingAddress.phone}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Prenom *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    autoComplete="given-name"
                    value={shippingAddress.firstName}
                    onChange={(e) =>
                      handleFieldChange({
                        ...shippingAddress,
                        firstName: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.firstName ? "border-red-400" : "border-slate-300"}`}
                    placeholder="Prenom"
                  />
                  {mergedErrors?.firstName && (
                    <p className="text-xs text-red-600 mt-1">
                      {mergedErrors.firstName[0]}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Nom *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    autoComplete="family-name"
                    value={shippingAddress.lastName}
                    onChange={(e) =>
                      handleFieldChange({
                        ...shippingAddress,
                        lastName: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.lastName ? "border-red-400" : "border-slate-300"}`}
                    placeholder="Nom"
                  />
                  {mergedErrors?.lastName && (
                    <p className="text-xs text-red-600 mt-1">
                      {mergedErrors.lastName[0]}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Adresse *
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  autoComplete="street-address"
                  value={shippingAddress.address}
                  onChange={(e) =>
                    handleFieldChange({
                      ...shippingAddress,
                      address: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.address ? "border-red-400" : "border-slate-300"}`}
                  placeholder="Numero et nom de rue"
                />
                {mergedErrors?.address && (
                  <p className="text-xs text-red-600 mt-1">
                    {mergedErrors.address[0]}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Telephone{" "}
                  <span className="text-slate-400 font-normal">
                    (optionnel)
                  </span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  value={shippingAddress.phone}
                  onChange={(e) =>
                    handleFieldChange({
                      ...shippingAddress,
                      phone: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.phone ? "border-red-400" : "border-slate-300"}`}
                  placeholder="06 12 34 56 78"
                  maxLength={14}
                />
                {mergedErrors?.phone ? (
                  <p className="text-xs text-red-600 mt-1">
                    {mergedErrors.phone[0]}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Pour le transporteur en cas de besoin
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="zipCode"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Code postal *
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    required
                    autoComplete="postal-code"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    value={shippingAddress.zipCode}
                    onChange={(e) =>
                      handleFieldChange({
                        ...shippingAddress,
                        zipCode: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.zipCode ? "border-red-400" : "border-slate-300"}`}
                    placeholder="75000"
                  />
                  {mergedErrors?.zipCode && (
                    <p className="text-xs text-red-600 mt-1">
                      {mergedErrors.zipCode[0]}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Ville *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    required
                    autoComplete="address-level2"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      handleFieldChange({
                        ...shippingAddress,
                        city: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${mergedErrors?.city ? "border-red-400" : "border-slate-300"}`}
                    placeholder="Ville"
                  />
                  {mergedErrors?.city && (
                    <p className="text-xs text-red-600 mt-1">
                      {mergedErrors.city[0]}
                    </p>
                  )}
                </div>
              </div>
              {user && hasCompleteAddress && isEditingAddress && (
                <button
                  type="button"
                  onClick={() => {
                    onShippingAddressChange({
                      civility: "M.",
                      firstName:
                        userProfile?.firstName || user?.firstName || "",
                      lastName: userProfile?.lastName || user?.lastName || "",
                      address: userProfile?.address || "",
                      phone: userProfile?.phone || "",
                      zipCode: userProfile?.zipCode || "",
                      city: userProfile?.city || "",
                      country: userProfile?.country || "France",
                    });
                    setIsEditingAddress(false);
                  }}
                  className="text-sm text-slate-500 hover:underline"
                >
                  Annuler et utiliser l&apos;adresse enregistree
                </button>
              )}
            </div>
          )}

          {/* Bouton continuer vers paiement */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!isAddressValid}
            className="w-full py-3 bg-cta hover:bg-cta-hover text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Continuer vers le paiement</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
