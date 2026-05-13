"""
sd_notify natif sans dépendance python-systemd.

Implémente le protocole systemd NOTIFY_SOCKET (sd_notify(3)) en pur Python.
Si NOTIFY_SOCKET n'est pas défini (exécution hors systemd), les appels
retournent silencieusement False — pas d'erreur runtime.

Référence : https://www.freedesktop.org/software/systemd/man/sd_notify.html
"""
from __future__ import annotations

import os
import socket


def sd_notify(message: str) -> bool:
    """
    Envoie un message au socket NOTIFY_SOCKET (UNIX datagram).

    Retourne True si envoyé, False si NOTIFY_SOCKET absent (mode dev/test).
    """
    sock_path = os.environ.get("NOTIFY_SOCKET")
    if not sock_path:
        return False
    # Abstract socket : préfixe '@' → '\0'
    if sock_path[0] == "@":
        sock_path = "\0" + sock_path[1:]
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sock:
            sock.connect(sock_path)
            sock.sendall(message.encode("utf-8"))
        return True
    except OSError:
        return False


def notify_ready() -> bool:
    """Indique au superviseur que le service est prêt (Type=notify)."""
    return sd_notify("READY=1")


def notify_status(text: str) -> bool:
    """Met à jour le statut visible via `systemctl status`."""
    return sd_notify(f"STATUS={text}")


def notify_watchdog() -> bool:
    """Tick de keepalive pour WatchdogSec= dans .service."""
    return sd_notify("WATCHDOG=1")


def notify_stopping() -> bool:
    """Indique au superviseur que le service est en train de s'arrêter."""
    return sd_notify("STOPPING=1")
