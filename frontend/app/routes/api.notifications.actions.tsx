/**
 * 🔔 API NOTIFICATIONS ACTIONS - Endpoint pour les actions sur notifications
 */

import { type ActionFunctionArgs, data } from "react-router";
import { logger } from "~/utils/logger";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  const idsString = formData.get("ids") as string;
  const notificationId = formData.get("notificationId") as string;

  logger.log("Notification action:", {
    actionType,
    idsString,
    notificationId,
  });

  // Mock responses pour les différentes actions
  switch (actionType) {
    case "mark-read":
      logger.log(
        "Marking as read:",
        idsString ? JSON.parse(idsString) : [notificationId],
      );
      return {
        success: true,
        message: "Notifications marquées comme lues",
      };

    case "mark-unread":
      logger.log(
        "Marking as unread:",
        idsString ? JSON.parse(idsString) : [notificationId],
      );
      return {
        success: true,
        message: "Notifications marquées comme non lues",
      };

    case "delete":
      logger.log(
        "Deleting:",
        idsString ? JSON.parse(idsString) : [notificationId],
      );
      return { success: true, message: "Notifications supprimées" };

    case "view-order":
      logger.log("Viewing order for notification:", notificationId);
      return { success: true, redirect: `/orders/${notificationId}` };

    case "process-order":
      logger.log("Processing order for notification:", notificationId);
      return {
        success: true,
        message: "Commande en cours de traitement",
      };

    case "restock":
      logger.log("Restocking product for notification:", notificationId);
      return {
        success: true,
        message: "Demande de réapprovisionnement envoyée",
      };

    case "retry-processing":
      logger.log("Retrying processing for notification:", notificationId);
      return { success: true, message: "Nouveau traitement lancé" };

    case "manual-process":
      logger.log("Manual processing for notification:", notificationId);
      return {
        success: true,
        redirect: `/admin/orders/manual-process/${notificationId}`,
      };

    default:
      return data({ error: "Action non reconnue" }, { status: 400 });
  }
}
