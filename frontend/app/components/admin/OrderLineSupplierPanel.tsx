/**
 * Décision 50 — fournisseur et prix d'achat sur la ligne de commande.
 *
 * Affiche la proposition calculée par le backend (pièce vendable au meilleur
 * prix d'achat, jamais à perte), la confirme en un geste, ou marque la ligne en
 * rupture. La suite d'une rupture (équivalent, supplément, annulation, mail
 * client) suit le skill `order-rupture-equivalence` : rien n'est envoyé ici.
 */
import { AlertTriangle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type MotifEcart =
  | "PRIX_ACHAT_ABSENT"
  | "FOURNISSEUR_INCONNU"
  | "VENTE_A_PERTE_TARIF"
  | "VENTE_A_PERTE_LIGNE"
  | "TVA_INCONNUE";

type Proposition =
  | {
      statut: "PROPOSE";
      splId: string;
      nomFournisseur: string;
      libelleFournisseur: string;
      prixAchatUnitHt: number;
      quantite: number;
      prixAchatHt: number;
      offresVendables: number;
      offresEcartees: {
        libelleFournisseur: string | null;
        motif: MotifEcart;
      }[];
    }
  | { statut: "RUPTURE"; offresVendables: 0; procedure: string }
  | {
      statut: "A_COMPLETER";
      offresVendables: number;
      offresEcartees: {
        libelleFournisseur: string | null;
        motif: MotifEcart;
      }[];
      motifLigne?: "QUANTITE_ILLISIBLE";
    };

interface PropositionLigne {
  statutLigne: string | null;
  fournisseurConfirme: {
    splId: string;
    nom: string | null;
    prixAchatUnitHt: string | null;
    prixAchatHt: string | null;
  } | null;
  proposition: Proposition;
}

const MOTIFS: Record<MotifEcart, string> = {
  PRIX_ACHAT_ABSENT: "prix d'achat absent",
  FOURNISSEUR_INCONNU: "fournisseur absent de l'annuaire",
  VENTE_A_PERTE_TARIF: "vente à perte au tarif",
  VENTE_A_PERTE_LIGNE: "vente à perte au prix payé",
  TVA_INCONNUE: "TVA inconnue",
};

const SKILL_RUPTURE = ".claude/skills/order-rupture-equivalence/SKILL.md";

const euros = (v: number | string | null) =>
  v == null || v === "" ? "—" : `${Number(v).toFixed(2)} € HT`;

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

interface Props {
  orderId: string;
  lineId: string;
  label: string;
}

export function OrderLineSupplierPanel({ orderId, lineId, label }: Props) {
  const base = `/api/admin/orders/${encodeURIComponent(orderId)}/lines/${encodeURIComponent(lineId)}`;
  const [data, setData] = useState<PropositionLigne | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmerRupture, setConfirmerRupture] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const res = await fetch(`${base}/supplier-proposal`);
      if (!res.ok) {
        setErreur(await lireErreur(res));
        return;
      }
      setData((await res.json()) as PropositionLigne);
    } catch {
      setErreur("Proposition indisponible");
    }
  }, [base]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = async (chemin: string, corps: unknown) => {
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`${base}/${chemin}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!res.ok) setErreur(await lireErreur(res));
    } catch {
      setErreur("Action impossible");
    } finally {
      setEnCours(false);
      setConfirmerRupture(false);
      await charger();
    }
  };

  const p = data?.proposition;
  return (
    <div className="rounded-md border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Truck className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        {data?.statutLigne === "4" && (
          <Badge variant="destructive">Rupture marquée</Badge>
        )}
      </div>

      {!data && !erreur && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Calcul de la proposition…
        </p>
      )}

      {data?.fournisseurConfirme && (
        <p className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          Fournisseur confirmé :{" "}
          {data.fournisseurConfirme.nom ??
            data.fournisseurConfirme.splId} —{" "}
          {euros(data.fournisseurConfirme.prixAchatUnitHt)} l'unité,{" "}
          {euros(data.fournisseurConfirme.prixAchatHt)} au total
        </p>
      )}

      {p?.statut === "PROPOSE" && !data?.fournisseurConfirme && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Proposé : <strong>{p.nomFournisseur}</strong> —{" "}
            {euros(p.prixAchatUnitHt)} × {p.quantite} = {euros(p.prixAchatHt)}
            {p.offresVendables > 1 &&
              ` (meilleur de ${p.offresVendables} offres)`}
          </span>
          <Button
            size="sm"
            disabled={enCours}
            onClick={() =>
              envoyer("confirm-supplier", {
                splId: p.splId,
                prixAchatUnitHt: p.prixAchatUnitHt,
              })
            }
          >
            Confirmer ce fournisseur
          </Button>
        </div>
      )}

      {p?.statut === "RUPTURE" && (
        <p className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4" />
          Aucune offre vendable pour cette pièce.
        </p>
      )}

      {p?.statut === "A_COMPLETER" && (
        <div className="text-amber-700">
          <p className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Proposition impossible à compléter
            {p.motifLigne === "QUANTITE_ILLISIBLE" &&
              " : quantité de la ligne illisible"}
          </p>
          {p.offresEcartees.length > 0 && (
            <ul className="list-disc ml-6">
              {p.offresEcartees.map((o, i) => (
                <li key={i}>
                  {o.libelleFournisseur ?? "fournisseur non renseigné"} :{" "}
                  {MOTIFS[o.motif]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {p?.statut === "PROPOSE" &&
        p.offresEcartees.length > 0 &&
        !data?.fournisseurConfirme && (
          <p className="text-muted-foreground">
            Offres écartées :{" "}
            {p.offresEcartees
              .map((o) => `${o.libelleFournisseur ?? "?"} (${MOTIFS[o.motif]})`)
              .join(", ")}
          </p>
        )}

      {data && data.statutLigne !== "4" && (
        <div className="flex flex-wrap items-center gap-2">
          {confirmerRupture ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={enCours}
                onClick={() => envoyer("mark-rupture", {})}
              >
                Confirmer la rupture
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmerRupture(false)}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={enCours}
              onClick={() => setConfirmerRupture(true)}
            >
              Marquer en rupture
            </Button>
          )}
        </div>
      )}

      {(p?.statut === "RUPTURE" || data?.statutLigne === "4") && (
        <p className="text-muted-foreground">
          Suite de la rupture (équivalent, supplément, annulation, mail client)
          : skill <code>order-rupture-equivalence</code> ({SKILL_RUPTURE}).
          Aucun mail ni annulation n'est déclenché par ce panneau.
        </p>
      )}

      {erreur && <p className="text-red-700">{erreur}</p>}
    </div>
  );
}
