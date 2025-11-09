/**
 * Hook pour gérer l'état de la newsletter
 * Gère la soumission et les états de succès/erreur
 */

import { useState } from 'react';

export function useNewsletterState() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Newsletter subscription:", email);
    setIsSubmitting(false);
    setSuccess(true);
    setEmail("");
    
    // Reset success message after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  };

  return {
    email,
    isSubmitting,
    success,
    setEmail,
    handleSubmit
  };
}
