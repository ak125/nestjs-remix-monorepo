/**
 * 🛒 CART ICON - Version de diagnostic simple
 */

import { Link } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";

interface CartIconDebugProps {
  className?: string;
}

export function CartIconDebug({ className = "" }: CartIconDebugProps) {
  const [itemCount, setItemCount] = useState(0);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    console.log("🛒 CartIconDebug - Composant monté");
    setStatus("mounted");
    
    // Test simple de l'API
    fetch("/api/cart")
      .then(response => {
        console.log("🛒 CartIconDebug - Réponse API:", response.status);
        return response.json();
      })
      .then(data => {
        console.log("🛒 CartIconDebug - Données:", data);
        setItemCount(data.items ? data.items.length : 0);
        setStatus("loaded");
      })
      .catch(error => {
        console.error("🛒 CartIconDebug - Erreur:", error);
        setStatus("error");
      });
  }, []);

  return (
    <div className={`relative ${className}`}>
      <Link 
        to="/test-cart" 
        className="hover:text-blue-600 transition-colors relative flex items-center"
        aria-label="Panier"
      >
        <ShoppingCart size={20} />
        <span className="ml-1 text-sm bg-red-500 text-white px-2 py-1 rounded">
          {itemCount} ({status})
        </span>
      </Link>
    </div>
  );
}