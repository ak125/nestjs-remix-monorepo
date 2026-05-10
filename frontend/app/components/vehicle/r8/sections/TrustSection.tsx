// 🛡️ R8 Vehicle — S_TRUST
// Trust badges: warranty, shipping, support, returns.

import { HeadphonesIcon, RotateCcw, Shield, Truck } from "lucide-react";

export function TrustSection() {
  return (
    <div className="mb-12" data-section="S_TRUST">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
          <div className="inline-flex p-3 rounded-full bg-green-100 mb-3">
            <Shield size={28} className="text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900">Garantie 1 an</h3>
          <p className="text-sm text-gray-500 mt-1">Sur toutes nos pièces</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
          <div className="inline-flex p-3 rounded-full bg-blue-100 mb-3">
            <Truck size={28} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900">Livraison 24-48h</h3>
          <p className="text-sm text-gray-500 mt-1">Expédition rapide</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
          <div className="inline-flex p-3 rounded-full bg-purple-100 mb-3">
            <HeadphonesIcon size={28} className="text-purple-600" />
          </div>
          <h3 className="font-bold text-gray-900">Conseil expert</h3>
          <p className="text-sm text-gray-500 mt-1">Service client dédié</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
          <div className="inline-flex p-3 rounded-full bg-orange-100 mb-3">
            <RotateCcw size={28} className="text-orange-600" />
          </div>
          <h3 className="font-bold text-gray-900">Retour 30 jours</h3>
          <p className="text-sm text-gray-500 mt-1">Satisfait ou remboursé</p>
        </div>
      </div>
    </div>
  );
}
