# Programmes jq du tri des constats (codex-tri.sh), inclus par « jq -L <dossier> 'include "tri"; …' ».
# Le script seul écrit les fichiers : ces filtres valident la réponse du modèle et en tirent les
# trois sorties. Apostrophes typographiques voulues dans les textes français.

def rang: {"critical":0,"high":1,"medium":2,"low":3,"info":4}[.] // 9;
def grav: type == "string" and IN("critical","high","medium","low","info");
def texte: type == "string";
def texte_ou_null: . == null or type == "string";
def deux: tostring | if length < 2 then "0" + . else . end;

# Groupes et constats déjà triés d'un fichier constats-tries.json (format du mandat FB) : ref = étiquette/brouillon
# (ou étiquette/groupe s'il n'y a pas de brouillon).
def anterieurs($etiquette):
  [.[] | select(.groupe != null)
   | {ref: "\($etiquette)/\(.brouillon // .groupe)", groupe, cause, issue: .issue_ou_pr_existante}]
  | unique_by(.ref);

# Entrée : la sortie JSON de claude -p. Vrai si la sortie structurée suit le schéma, couvre exactement les
# constats de l'entrée et ne cite que des numéros et des refs fournis par l'entrée.
def valide($e):
  ($e.constats | map(.id)) as $ids
  | ([$e.issues_ouvertes[].number] + [$e.prs_ouvertes[].number]) as $nums
  | [$e.tris_anterieurs[].ref] as $refs
  | .structured_output as $s
  | if ($s | type) != "object" or ($s.constats | type) != "array" or ($s.groupes | type) != "array"
       or ($s.notes | type) != "string" or ($s | keys) != ["constats","groupes","notes"] then false
    else
      [$s.groupes[] | .groupe] as $g
      | ([$s.constats[] | .id] | sort) == ($ids | sort)
        and ($g | length) == ($g | unique | length)
        and all($s.constats[];
              type == "object"
              and keys == ["cause","correctif_propose","groupe","id","methode","non_tranchable_besoin","preuve","raison_gravite","risque_si_rien","severity_revue","verdict"]
              and (.verdict | IN("confirmé","faux","déjà corrigé","non tranchable"))
              and (.severity_revue | grav)
              and all(.raison_gravite, .preuve, .methode, .cause, .correctif_propose, .risque_si_rien; texte)
              and (.non_tranchable_besoin | texte_ou_null)
              and (.groupe | type == "string") and (.groupe | IN($g[])))
        and all($s.groupes[];
              type == "object"
              and keys == ["constat","correctif","couverture_note","couverture_numero","couverture_tri","dept_preuve","dept_propose","gravite","groupe","risque","securite","titre"]
              and (.groupe | type == "string") and (.groupe | test("^[a-z0-9][a-z0-9-]*$"))
              and (.gravite | grav) and (.securite | type == "boolean")
              and all(.titre, .couverture_note, .constat, .correctif, .risque; texte)
              and (.dept_preuve | texte_ou_null)
              and (.dept_propose == null or ((.dept_propose | type == "string") and (.dept_propose | test("^dept:[0-9]{2}-[a-z0-9-]+$"))))
              and (.couverture_numero == null or ((.couverture_numero | type == "number") and (.couverture_numero | IN($nums[]))))
              and (.couverture_tri == null or ((.couverture_tri | type == "string") and (.couverture_tri | IN($refs[]))))
              and (.groupe as $x | any($s.constats[]; .groupe == $x)))
    end;

# Groupes qui reçoivent un brouillon : au moins un constat confirmé, aucune couverture. Retour :
# {groupe: "B01"} pour les groupes publics, {groupe: "S01"} pour les groupes de sécurité.
def plan($s):
  [$s.groupes[] | . as $g
   | select(any($s.constats[]; .groupe == $g.groupe and .verdict == "confirmé"))
   | select(.couverture_numero == null and .couverture_tri == null)]
  | sort_by((.gravite | rang), .groupe)
  | ((map(select(.securite | not)) | to_entries | map({key: .value.groupe, value: ("B" + ((.key + 1) | deux))}))
     + (map(select(.securite)) | to_entries | map({key: .value.groupe, value: ("S" + ((.key + 1) | deux))})))
  | from_entries;

# constats-tries.json, au format du mandat FB.
def assemble($e; $s; $p; $statut):
  ($s.groupes | map({key: .groupe, value: .}) | from_entries) as $G
  | ($e.constats | map({key: .id, value: .}) | from_entries) as $I
  | $s.constats
  | map(. as $m | $I[$m.id] as $c | $G[$m.groupe] as $g | {
      id: $m.id, jour: $c.jour, pr: $c.pr, objet: $c.objet, index: $c.index, title: $c.title,
      category: $c.category, fichier: $c.fichier, ligne: $c.ligne, base_codex: $c.base_codex,
      severity_origine: $c.severity, severity_revue: $m.severity_revue, raison_gravite: $m.raison_gravite,
      verdict: $m.verdict, preuve: $m.preuve, methode: $m.methode, statut_preuve: $statut,
      groupe: $m.groupe, cause: $m.cause, securite: $g.securite,
      brouillon: (if $m.verdict != "confirmé" or $p[$m.groupe] == null then null
                  elif $g.securite then "sécurité — hors GitHub public" else $p[$m.groupe] end),
      issue_ou_pr_existante: (if $g.couverture_numero != null then "#\($g.couverture_numero)"
                              else $g.couverture_tri end),
      couverture_note: $g.couverture_note, dept_propose: $g.dept_propose, dept_preuve: $g.dept_preuve,
      dept_statut: (if $g.dept_propose != null then "proposé seulement" else null end),
      non_tranchable_besoin: $m.non_tranchable_besoin, correctif_propose: $m.correctif_propose,
      risque_si_rien: $m.risque_si_rien})
  | sort_by(.jour, (.pr // 0), .objet, .index);

# Brouillons publics (groupes B..), un objet {ref, groupe, texte} chacun, au format du mandat FB.
def brouillons($e; $s; $p):
  ($e.constats | map({key: .id, value: .}) | from_entries) as $I
  | [$s.groupes[] | select(($p[.groupe] // "") | startswith("B"))]
  | sort_by($p[.groupe])
  | map(. as $g
      | [$s.constats[] | select(.groupe == $g.groupe and .verdict == "confirmé")] as $ms
      | ($ms | map($I[.id])) as $cs
      | {ref: $p[$g.groupe], groupe: $g.groupe, texte: ([
          "## \($p[$g.groupe]) — \($g.titre)", "",
          "- **Label proposé** : \(if $g.dept_propose != null then "`\($g.dept_propose)`" else "à attribuer" end) · **gravité revue** : \($g.gravite) · **groupe** : `\($g.groupe)`",
          "- **Constats Codex** : \($ms | map("\(.id) (confirmé, \($I[.id].severity)→\(.severity_revue))") | join(", "))",
          "- **PR d’origine** : \([$cs[] | .pr | select(. != null) | "#\(.)"] | unique | join(", ") | if . == "" then "aucune (audit de lot)" else . + " (fusionnées)" end)",
          "- **Fichiers** : \([$cs[] | .fichier] | unique | map("`\(.)`") | join(", "))",
          "", "**Constat.** \($g.constat)", "", "**Preuve (origin/main).**"]
          + ($ms | map("- \(.id) : \(.preuve)"))
          + ["", "**Correctif proposé.** \($g.correctif)", "", "**Risque si rien n’est fait.** \($g.risque)", "", "---", ""]
          | join("\n"))});
