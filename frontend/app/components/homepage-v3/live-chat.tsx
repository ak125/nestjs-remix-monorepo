import { MessageCircle, X, Send } from 'lucide-react';
import { useState } from 'react';

export function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl z-50 transition transform hover:scale-110"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        <span className="absolute top-0 right-0 h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
      </button>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="bg-indigo-600 text-white p-4">
            <h3 className="font-bold">Chat en direct</h3>
            <p className="text-sm opacity-90">Nous sommes là pour vous aider !</p>
          </div>
          <div className="h-96 p-4 overflow-y-auto bg-gray-50">
            <div className="bg-white p-3 rounded-lg shadow mb-2">
              <p className="text-sm">Bonjour ! Comment puis-je vous aider ?</p>
            </div>
          </div>
          <div className="p-4 border-t flex space-x-2">
            <input type="text" placeholder="Votre message..." className="flex-1 px-4 py-2 border rounded-full" />
            <button className="bg-indigo-600 text-white p-2 rounded-full">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
