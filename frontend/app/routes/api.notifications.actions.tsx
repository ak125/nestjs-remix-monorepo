/**
 * 🔔 API NOTIFICATIONS ACTIONS - Endpoint pour les actions sur notifications
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  const idsString = formData.get("ids") as string;
  const notificationId = formData.get("notificationId") as string;

  console.log("Notification action:", {
    actionType,
    idsString,
    notificationId
  });

  // Mock responses pour les différentes actions
  switch (actionType) {
    case "mark-read":
      console.log("Marking as read:", idsString ? JSON.parse(idsString) : [notificationId]);
      return json({ success: true, message: "Notifications marquées comme lues" });

    case "mark-unread":
      console.log("Marking as unread:", idsString ? JSON.parse(idsString) : [notificationId]);
      return json({ success: true, message: "Notifications marquées comme non lues" });

    case "delete":
      console.log("Deleting:", idsString ? JSON.parse(idsString) : [notificationId]);
      return json({ success: true, message: "Notifications supprimées" });

    case "view-order":
      console.log("Viewing order for notification:", notificationId);
      return json({ success: true, redirect: `/admin/orders/${notificationId}` });

    case "process-order":
      console.log("Processing order for notification:", notificationId);
      return json({ success: true, message: "Commande en cours de traitement" });

    case "restock":
      console.log("Restocking product for notification:", notificationId);
      return json({ success: true, message: "Demande de réapprovisionnement envoyée" });

    case "retry-processing":
      console.log("Retrying processing for notification:", notificationId);
      return json({ success: true, message: "Nouveau traitement lancé" });

    case "manual-process":
      console.log("Manual processing for notification:", notificationId);
      return json({ success: true, redirect: `/admin/orders/manual-process/${notificationId}` });

    default:
      return json({ error: "Action non reconnue" }, { status: 400 });
  }
}
