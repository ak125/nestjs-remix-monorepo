import { Phone, Mail, MapPin, Send } from 'lucide-react';

export function Contact() {
  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Contactez-Nous</h2>
        <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <div>
            <form className="space-y-4">
              <input type="text" placeholder="Nom" className="w-full px-4 py-3 rounded-lg border" required />
              <input type="email" placeholder="Email" className="w-full px-4 py-3 rounded-lg border" required />
              <input type="text" placeholder="Sujet" className="w-full px-4 py-3 rounded-lg border" required />
              <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 rounded-lg border" required></textarea>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2">
                <Send className="h-5 w-5" />
                <span>Envoyer</span>
              </button>
            </form>
          </div>
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <Phone className="h-6 w-6 text-indigo-600 mt-1" />
              <div>
                <h3 className="font-bold mb-1">Téléphone</h3>
                <p className="text-gray-600">01 48 49 78 69</p>
                <p className="text-sm text-gray-500">Lun-Ven : 9h-18h</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Mail className="h-6 w-6 text-indigo-600 mt-1" />
              <div>
                <h3 className="font-bold mb-1">Email</h3>
                <p className="text-gray-600">contact@automecanik.com</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <MapPin className="h-6 w-6 text-indigo-600 mt-1" />
              <div>
                <h3 className="font-bold mb-1">Adresse</h3>
                <p className="text-gray-600">Paris, France</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
