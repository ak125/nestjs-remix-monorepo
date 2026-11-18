/**
 * Mandat CL — équivalents classés d'une ligne en rupture (statut 4).
 *
 * Chaque équivalent porte sa preuve (référence croisée en base, type véhicule
 * de la ligne, critères principaux à la tolérance affichée), son achat
 * (fournisseur, prix, date du tarif), la marge si le prix payé est conservé et
 * l'éventuel supplément. Un clic retient l'équivalent : la ligne garde le prix
 * payé et enregistre fournisseur et prix d'achat ; la pièce retenue est tracée.
 * Aucun mail n'est envoyé : le texte est préparé, à relire et copier.
 */
import { CheckCircle2, ClipboardCopy, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type Verdict = "IDENTIQUE" | "PROCHE" | "DIFFERENT";

interface CritereCompare {
  criId: string;
  libelle: string | null;
  unite: string | null;
  commandee: string[];
  equivalent: string[];
  verdict: Verdict;
  bloquant: boolean;
  ecartMm: number | null;
}

interface Equivalent {
  pieceId: number;
  marque: string | null;
  ref: string;
  statut: "RETENABLE" | "SUPPLEMENT_REQUIS";
  preuve: {
    reference: {
      oemCommunes: string[];
      citeeParCommandee: boolean;
      citeCommandee: boolean;
    };
    typeVehicule: number;
    criteres: {
      compares: CritereCompare[];
      nonCompares: { criId: string; libelle: string | null }[];
      ecartTotalMm: number;
      aVerifier: number;
    };
  };
  achat: {
    splId: string;
    fournisseur: string;
    prixAchatUnitHt: number;
    prixAchatHt: number;
    quantite: number;
    origine: { type: "TARIF"; dateTarif: string | null };
  };
  margeAuPrixPaye: { unitHt: number; totalHt: number; taux: number } | null;
  supplementTtc: number;
  texteMail: { objet: string; corps: string };
}

interface Retenu {
  pieceId: number;
  marque: string | null;
  ref: string;
  fournisseur: string;
  prixAchatUnitHt: number;
  le: string;
}

interface Vue {
  statutLigne: string | null;
  commandee: { marque: string | null; ref: string | null };
  toleranceMm: number;
  sansRecherche: "LIGNE_NON_RUPTURE" | "TYPE_VEHICULE_INCONNU" | null;
  resultat: {
    equivalents: Equivalent[];
    tronques: number;
    ecartes: Record<string, number>;
  } | null;
  fournisseurPose: boolean;
  retenu: Retenu | null;
}

const ECARTS: Record<string, string> = {
  GAMME_DIFFERENTE: "autre gamme",
  NON_AFFICHEE: "non affichée",
  TYPE_VEHICULE_NON_COUVERT: "véhicule non couvert",
  CRITERES_DIFFERENTS: "critères différents",
  CRITERES_NON_COMPARABLES: "critères non comparables",
  INDISPONIBLE: "aucune offre",
  CONSIGNE: "consigne",
  OFFRE_INCOMPLETE: "offre incomplète ou à perte",
};

const ht = (v: number) => `${v.toFixed(2)} € HT`;

const dateCourte = (iso: string | null) => {
  if (!iso) return "date inconnue";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "date inconnue"
    : d.toLocaleDateString("fr-FR");
};

const valeurs = (v: string[], unite: string | null) =>
  `${v.join(" / ")}${unite ? ` ${unite}` : ""}`;

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

function Preuve({ e, toleranceMm }: { e: Equivalent; toleranceMm: number }) {
  const r = e.preuve.reference;
  const sens = [
    r.citeeParCommandee && "citée par la pièce commandée",
    r.citeCommandee && "cite la pièce commandée",
  ].filter(Boolean);
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        Référence croisée :{" "}
        {r.oemCommunes.length > 0 &&
          `OE communes ${r.oemCommunes.slice(0, 6).join(", ")}${r.oemCommunes.length > 6 ? "…" : ""}`}
        {r.oemCommunes.length > 0 && sens.length > 0 && " ; "}
        {sens.join(", ")}. Type véhicule {e.preuve.typeVehicule} couvert.
      </p>
      <ul className="ml-4 list-disc">
        {e.preuve.criteres.compares.map((c) => (
          <li
            key={c.criId}
            className={c.verdict === "DIFFERENT" ? "text-amber-700" : ""}
          >
            {c.libelle ?? `critère ${c.criId}`} :{" "}
            {valeurs(c.equivalent, c.unite)}
            {c.verdict !== "IDENTIQUE" &&
              ` (commandée : ${valeurs(c.commandee, c.unite)})`}
            {c.verdict === "PROCHE" &&
              c.ecartMm != null &&
              ` — écart ${c.ecartMm} mm ≤ ${toleranceMm} mm`}
            {!c.bloquant && " — informatif"}
          </li>
        ))}
      </ul>
      {e.preuve.criteres.aVerifier > 0 && (
        <p className="text-amber-700">
          {e.preuve.criteres.aVerifier} critère(s) informatif(s) différent(s) à
          vérifier.
        </p>
      )}
    </div>
  );
}

function TexteMail({ texte }: { texte: { objet: string; corps: string } }) {
  const [copie, setCopie] = useState(false);
  const tout = `Objet : ${texte.objet}\n\n${texte.corps}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">Texte du mail à relire et copier</span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(tout);
              setCopie(true);
            } catch {
              setCopie(false);
            }
          }}
        >
          <ClipboardCopy className="mr-1 h-4 w-4" />
          {copie ? "Copié" : "Copier"}
        </Button>
      </div>
      <textarea
        readOnly
        aria-label="Texte du mail client"
        className="h-64 w-full rounded border p-2 font-mono text-xs"
        value={tout}
      />
      <p className="text-xs text-muted-foreground">
        Aucun mail n'est envoyé par ce panneau.
      </p>
    </div>
  );
}

export function RuptureEquivalentsPanel({ base }: { base: string }) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<number | null>(null);
  const [texteRetenu, setTexteRetenu] = useState<
    Equivalent["texteMail"] | null
  >(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${base}/rupture-equivalents`);
      if (!res.ok) {
        setErreur(await lireErreur(res));
        return;
      }
      setVue((await res.json()) as Vue);
    } catch {
      setErreur("Équivalents indisponibles");
    }
  }, [base]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const retenir = async (e: Equivalent) => {
    setEnCours(e.pieceId);
    setErreur(null);
    try {
      const res = await fetch(`${base}/retain-equivalent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId: e.pieceId,
          splId: e.achat.splId,
          prixAchatUnitHt: e.achat.prixAchatUnitHt,
        }),
      });
      if (res.ok) setTexteRetenu(e.texteMail);
      else setErreur(await lireErreur(res));
    } catch {
      setErreur("Action impossible");
    } finally {
      setEnCours(null);
      await charger();
    }
  };

  if (!vue && !erreur) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Recherche des équivalents…
      </p>
    );
  }

  const r = vue?.resultat;
  const retenu = vue?.retenu;
  const texte =
    texteRetenu ??
    (retenu &&
      r?.equivalents.find((e) => e.pieceId === retenu.pieceId)?.texteMail) ??
    null;
  const ecartes = Object.entries(r?.ecartes ?? {});

  return (
    <div className="space-y-2 border-t pt-2">
      <p className="flex items-center gap-2 font-medium">
        <Search className="h-4 w-4 text-muted-foreground" />
        Équivalents (même véhicule, mêmes critères à {vue?.toleranceMm ??
          "—"}{" "}
        mm, référence croisée)
      </p>

      {vue?.sansRecherche === "TYPE_VEHICULE_INCONNU" && (
        <p className="text-amber-700">
          Véhicule de la ligne inconnu (page d'origine sans type) : aucun
          équivalent proposé sans lui.
        </p>
      )}

      {retenu && (
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Équivalent retenu : {retenu.marque} {retenu.ref} chez{" "}
          {retenu.fournisseur} à {ht(retenu.prixAchatUnitHt)} (le{" "}
          {dateCourte(retenu.le)}). Prix payé conservé ; accord du client à
          obtenir.
        </p>
      )}
      {retenu && texte && <TexteMail texte={texte} />}
      {retenu && !texte && (
        <p className="text-amber-700">
          L'équivalent retenu n'est plus proposé : texte du mail à rédiger.
        </p>
      )}

      {!retenu && vue?.fournisseurPose && (
        <p className="text-muted-foreground">
          Fournisseur déjà posé sur la ligne : aucun équivalent à retenir.
        </p>
      )}

      {r && r.equivalents.length === 0 && (
        <p className="text-muted-foreground">Aucun équivalent prouvé.</p>
      )}

      {!retenu &&
        r?.equivalents.map((e) => (
          <div key={e.pieceId} className="space-y-1 rounded border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>
                {e.marque ?? "marque inconnue"} {e.ref}
              </strong>
              {e.statut === "RETENABLE" ? (
                <Badge variant="secondary">Au prix payé</Badge>
              ) : (
                <Badge variant="destructive">
                  Supplément {e.supplementTtc.toFixed(2)} € TTC
                </Badge>
              )}
              <span>
                Achat : {e.achat.fournisseur} — {ht(e.achat.prixAchatUnitHt)} ×{" "}
                {e.achat.quantite} (tarif du{" "}
                {dateCourte(e.achat.origine.dateTarif)})
              </span>
              {e.margeAuPrixPaye && (
                <span
                  className={
                    e.margeAuPrixPaye.unitHt < 0 ? "text-red-700" : undefined
                  }
                >
                  Marge au prix payé : {ht(e.margeAuPrixPaye.totalHt)} (
                  {Math.round(e.margeAuPrixPaye.taux * 100)} %)
                </span>
              )}
              {e.statut === "RETENABLE" && !vue?.fournisseurPose && (
                <Button
                  size="sm"
                  disabled={enCours != null}
                  onClick={() => retenir(e)}
                >
                  {enCours === e.pieceId ? "…" : "Retenir cet équivalent"}
                </Button>
              )}
            </div>
            <Preuve e={e} toleranceMm={vue?.toleranceMm ?? 0} />
          </div>
        ))}

      {r && r.tronques > 0 && (
        <p className="text-xs text-muted-foreground">
          {r.tronques} autre(s) équivalent(s) non affiché(s).
        </p>
      )}
      {ecartes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Écartés :{" "}
          {ecartes.map(([m, n]) => `${ECARTS[m] ?? m} ×${n}`).join(", ")}
        </p>
      )}
      {erreur && <p className="text-red-700">{erreur}</p>}
    </div>
  );
}
