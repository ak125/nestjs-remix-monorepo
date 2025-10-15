import { X } from 'lucide-react';

interface PopupSignupProps {
  onClose: () => void;
}

export function PopupSignup({ onClose }: PopupSignupProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="h-6 w-6" />
        </button>
        <div className="text-center">
          <div className="text-6xl mb-4">🎁</div>
          <h3 className="text-3xl font-bold mb-2">Offre de Bienvenue !</h3>
          <p className="text-gray-600 mb-6">Inscrivez-vous et recevez <span className="text-orange-500 font-bold">10% de réduction</span> sur votre première commande</p>
          <form className="space-y-4">
            <input type="email" placeholder="Votre email" className="w-full px-4 py-3 border rounded-lg" required />
            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold">
              Je profite de l'offre →
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4">En vous inscrivant, vous acceptez nos conditions d'utilisation</p>
        </div>
      </div>
    </div>
  );
}
