# Constats déterministes du pilote de la file (ADR-128 D6), en lecture seule.
#
# Entrée : un objet
#   { issues: <gh issue list --json number,title,labels,createdAt,updatedAt,author,comments>,
#     prs:    <gh pr list --json number,title,body,author,isDraft>,
#     maintenant: "<ISO-8601 UTC>", jours_sans_mouvement: <entier>, titre_pilote: "<titre>" }
# Sortie : l'état de la file (constats + liste des issues), sans empreinte ni historique.
#
# Le marqueur « <!-- pilote-file » identifie le texte écrit par le pilote lui-même.

def est_pilote: ((.body // "") | contains("<!-- pilote-file"));
def secondes: if . == null then null else fromdateiso8601 end;
def noms_labels: [.labels[]?.name] | sort;
def depts: [noms_labels[] | select(startswith("dept:"))];
def normaliser: ascii_downcase | gsub("[^\\p{L}\\p{N}]+"; " ") | ltrimstr(" ") | rtrimstr(" ");

# Dernière activité hors pilote : si la dernière mise à jour de l'issue vient d'un commentaire
# du pilote (écart < 120 s), elle ne compte pas comme un mouvement.
def derniere_activite:
  ([.comments[]? | select(est_pilote) | .createdAt] | max) as $pil
  | ([.comments[]? | select(est_pilote | not) | .createdAt] | max) as $autre
  | if $pil != null and ((.updatedAt | secondes) - ($pil | secondes)) < 120
    then ([.createdAt, $autre] | map(select(. != null)) | max)
    else .updatedAt end;

. as $in
| ($in.maintenant | secondes) as $now
| ($in.jours_sans_mouvement * 86400) as $seuil
| [ $in.issues[]
    | select((.title == $in.titre_pilote and (.author.is_bot // false)) | not) ] as $file
| ([ $in.issues[] | select(.title == $in.titre_pilote and (.author.is_bot // false)) | .number ]
   | min) as $pilote
| {
    pilote_issue: $pilote,
    genere_a: $in.maintenant,
    jours_sans_mouvement: $in.jours_sans_mouvement,
    compteurs: { issues_ouvertes: ($file | length), prs_ouvertes: ($in.prs | length) },
    constats: {
      sans_departement: [ $file[] | select((depts | length) == 0) | .number ] | sort,
      departement_multiple: [ $file[] | select((depts | length) > 1)
                              | { issue: .number, labels: depts } ] | sort_by(.issue),
      bloquees: [ $file[] | select(noms_labels | index("statut:bloqué")) | .number ] | sort,
      sans_mouvement: [ $file[]
                        | derniere_activite as $a
                        | select($a != null and ($now - ($a | secondes)) >= $seuil)
                        | { issue: .number, derniere_activite: $a,
                            jours: ((($now - ($a | secondes)) / 86400) | floor) } ]
                      | sort_by(.issue),
      doublons_titre: [ $file[] | { n: .number, t: (.title | normaliser) } ]
                      | group_by(.t) | map(select(length > 1) | map(.n) | sort) | sort,
      prs_sans_issue: [ $in.prs[]
                        | select(((.body // "")
                                  | test("(?i)\\b(refs|closes|close|closed|fixes|fix|fixed|resolves|resolve|resolved)\\s+(#[0-9]+|https://github\\.com/[^/\\s]+/[^/\\s]+/issues/[0-9]+)")) | not)
                        | { pr: .number, auteur: (.author.login // null), brouillon: (.isDraft // false) } ]
                      | sort_by(.pr),
      mandats_expires: { couvert: false,
                         raison: "routine mandat-remise absente avant l'étape 2 d'ADR-128 (D3, D8)" }
    },
    file: [ $file[] | { number, title, labels: noms_labels } ] | sort_by(.number)
  }
