/**
 * Mandat BK — commande fournisseur PRÉPARÉE en mode essai, sous la proposition
 * fournisseur de la ligne (décision 50, `OrderLineSupplierPanel`).
 *
 * Le clic relit le portail en lecture seule, applique les 8 contrôles et trace
 * la ligne. Rien n'est envoyé au fournisseur : aucun panier, aucune commande.
 */
import { CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type StatutControle = "OK" | "BLOQUE" | "A_CONFIRMER";
type Decision =
  | "PREPAREE"
  | "BLOQUEE"
  | "CONFIRMATION_REQUISE"
  | "DEJA_PREPAREE";

interface Controle {
  id: number;
  code: string;
  statut: StatutControle;
  detail: string;
}

interface Preparee {
  traceId: string;
  le: string;
  numeroEssai: number;
  fournisseur: { splId: string; nom: string };
  refFournisseur: string;
  quantite: number;
  prixPublicHt: number | null;
  remisePct: number | null;
  remise2Pct: number | null;
  prixNetUnitHt: number | null;
  montantNetHt: number | null;
  prixAchatBaseUnitHt: number;
  disponibilite: string;
  lueA: string;
}

interface Envoi {
  flagActif: boolean;
  effectue: false;
  motif: string;
}

interface Etat {
  preparee: Preparee | null;
  derniereTentativeRefusee: {
    le: string;
    decision: Decision;
    controles: Controle[];
  } | null;
  comparaisonManuelle: {
    splIdManuel: string;
    memeFournisseur: boolean;
    prixManuelUnitHt: number | null;
    ecartUnitHt: number | null;
  } | null;
  envoi: Envoi;
}

interface Resultat {
  decision: Decision;
  controles: Controle[];
  envoi: Envoi;
}

const LIBELLES: Record<number, string> = {
  1: "Relecture live (écart ≤ 5 %)",
  2: "Jamais à perte",
  3: "Carte, commande, compatibilité",
  4: "Une seule commande",
  5: "Quantité de la ligne",
  6: "Plafond 300 € HT",
  7: "Trace sur la ligne",
  8: "Mode essai",
};

const euros = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)} € HT`;
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v} %`);

async function lireErreur(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const m = body?.message;
    if (typeof m === "string") return m;
    if (typeof m?.message === "string") return m.message;
  } catch {
    // corps non JSON
  }
  return `Erreur ${res.status}`;
}

function TableControles({ controles }: { controles: Controle[] }) {
  return (
    <table className="w-full text-xs mt-2">
      <tbody>
        {controles.map((c) => (
          <tr key={c.id} className="border-b last:border-0 align-top">
            <td className="py-1 pr-2 whitespace-nowrap">
              {c.id}. {LIBELLES[c.id] ?? c.code}
            </td>
            <td className="py-1 pr-2">
              <Badge
                variant={
                  c.statut === "OK"
                    ? "secondary"
                    : c.statut === "A_CONFIRMER"
                      ? "outline"
                      : "destructive"
                }
              >
                {c.statut === "A_CONFIRMER" ? "à confirmer" : c.statut}
              </Badge>
            </td>
            <td className="py-1 text-muted-foreground">{c.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  orderId: string;
  lineId: string;
}

export function SupplierOrderPreparationPanel({ orderId, lineId }: Props) {
  const base = `/api/admin/orders/${encodeURIComponent(orderId)}/lines/${encodeURIComponent(lineId)}`;
  const [etat, setEtat] = useState<Etat | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [compatibilite, setCompatibilite] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${base}/prepared-supplier-order`);
      if (!res.ok) {
        setErreur(await lireErreur(res));
        return;
      }
      setEtat((await res.json()) as Etat);
    } catch {
      setErreur("État de préparation indisponible");
    }
  }, [base]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const preparer = async (confirmationPlafond: boolean) => {
    if (enCours) return; // double clic : un seul appel en vol
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`${base}/prepare-supplier-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compatibiliteVerifiee: compatibilite,
          ...(confirmationPlafond ? { confirmationPlafond: true } : {}),
        }),
      });
      if (!res.ok) {
        setErreur(await lireErreur(res));
        return;
      }
      setResultat((await res.json()) as Resultat);
      await charger();
    } catch {
      setErreur("Préparation impossible");
    } finally {
      setEnCours(false);
    }
  };

  const p = etat?.preparee ?? null;
  const controles =
    resultat?.controles ?? etat?.derniereTentativeRefusee?.controles ?? null;

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="w-3.5 h-3.5" />
        Commande fournisseur — mode essai, jamais envoyée
        {etat?.envoi.flagActif && (
          <Badge variant="outline">flag actif, aucun code d'envoi</Badge>
        )}
      </div>

      {p ? (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              Préparée (essai {p.numeroEssai}/10), non envoyée
            </span>
            <span className="text-muted-foreground">
              {new Date(p.le).toLocaleString("fr-FR")}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
            <span>Fournisseur : {p.fournisseur.nom}</span>
            <span>Réf. fournisseur : {p.refFournisseur}</span>
            <span>Quantité : {p.quantite}</span>
            <span>Dispo : {p.disponibilite}</span>
            <span>Prix public : {euros(p.prixPublicHt)}</span>
            <span>
              Remise : {pct(p.remisePct)}
              {p.remise2Pct ? ` + ${pct(p.remise2Pct)}` : ""}
            </span>
            <span>Net unit. : {euros(p.prixNetUnitHt)}</span>
            <span>Total net : {euros(p.montantNetHt)}</span>
          </div>
          <div className="text-muted-foreground">
            Base : {euros(p.prixAchatBaseUnitHt)} · relu le{" "}
            {new Date(p.lueA).toLocaleString("fr-FR")}
          </div>
          {etat?.comparaisonManuelle && (
            <div className="text-muted-foreground">
              Commande manuelle : fournisseur{" "}
              {etat.comparaisonManuelle.memeFournisseur
                ? "identique"
                : `différent (spl ${etat.comparaisonManuelle.splIdManuel})`}
              , prix {euros(etat.comparaisonManuelle.prixManuelUnitHt)}, écart{" "}
              {euros(etat.comparaisonManuelle.ecartUnitHt)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs min-h-[44px]">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={compatibilite}
              onChange={(e) => setCompatibilite(e.target.checked)}
            />
            compatibilité vérifiée
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={enCours}
            onClick={() => void preparer(false)}
          >
            {enCours && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Préparer la commande fournisseur
          </Button>
          {resultat?.decision === "CONFIRMATION_REQUISE" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={enCours}
              onClick={() => void preparer(true)}
            >
              Confirmer au-delà de 300 € HT
            </Button>
          )}
        </div>
      )}

      {erreur && (
        <p className="text-xs text-red-700 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          {erreur}
        </p>
      )}
      {controles && <TableControles controles={controles} />}
    </div>
  );
}
