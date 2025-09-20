/**
 * 🔔 API NOTIFICATIONS COUNT - Endpoint pour compter les notifications non lues
 */

import { json } from "@remix-run/node";

export async function loader() {
  // Mock: retourner un nombre de notifications non lues
  const unreadCount = Math.floor(Math.random() * 5) + 1; // Entre 1 et 5
  
  return json({ unreadCount });
}
