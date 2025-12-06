"""
📏 Règles de correction SEO + Raccourcissement Meta
"""
import re
from typing import List, Dict, Tuple, Any

# ============================================
# LIMITES SEO
# ============================================

SEO_LIMITS = {
    'title': {'min': 30, 'ideal_max': 60, 'hard_max': 70},
    'descrip': {'min': 70, 'ideal_max': 155, 'hard_max': 160}
}

# ============================================
# RÈGLES DE RACCOURCISSEMENT META (priorité haute → basse)
# ============================================

# Règles pour les TITLES (> 60 chars)
SHORTEN_RULES_TITLE: List[Dict[str, Any]] = [
    # Priorité 1: Fins génériques longues (gros gain)
    {
        'pattern': re.compile(r'\s+pour assurer le bon fonctionnement du moteur\.?$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "pour assurer le bon fonctionnement du moteur"',
        'savings': 43,
        'priority': 1
    },
    {
        'pattern': re.compile(r'\s+pour le bon fonctionnement du moteur\.?$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "pour le bon fonctionnement du moteur"',
        'savings': 37,
        'priority': 1
    },
    {
        'pattern': re.compile(r'\s+pour le bon fonctionnement de votre véhicule\.?$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "pour le bon fonctionnement de votre véhicule"',
        'savings': 42,
        'priority': 1
    },
    {
        'pattern': re.compile(r'\s+pour le bon fonctionnement des équipements\.?$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "pour le bon fonctionnement des équipements"',
        'savings': 40,
        'priority': 1
    },
    
    # Priorité 2: Simplifier les fins avec "pour le bon fonctionnement de X"
    {
        'pattern': re.compile(r'\s+pour le bon fonctionnement de (la |l\'|le |les )?(\w+)\.?$', re.IGNORECASE),
        'replace': r' pour \1\2',
        'desc': '"pour le bon fonctionnement de X" → "pour X"',
        'savings': 25,
        'priority': 2
    },
    {
        'pattern': re.compile(r'\s+pour assurer (la |l\'|le |les )?(\w+) (du|de la|des) (\w+)\.?$', re.IGNORECASE),
        'replace': r' pour \1\2',
        'desc': 'Simplification "pour assurer X du Y" → "pour X"',
        'savings': 20,
        'priority': 2
    },
    
    # Priorité 3: Possessifs → articles définis
    {
        'pattern': re.compile(r'^Changer votre ', re.IGNORECASE),
        'replace': 'Changer le ',
        'desc': '"Changer votre" → "Changer le"',
        'savings': 3,
        'priority': 3
    },
    {
        'pattern': re.compile(r'^Changer vos ', re.IGNORECASE),
        'replace': 'Changer les ',
        'desc': '"Changer vos" → "Changer les"',
        'savings': 2,
        'priority': 3
    },
    {
        'pattern': re.compile(r'^Changez vos ', re.IGNORECASE),
        'replace': 'Changer les ',
        'desc': '"Changez vos" → "Changer les"',
        'savings': 3,
        'priority': 3
    },
    
    # Priorité 4: Phrases prix/promo
    {
        'pattern': re.compile(r'\s+à un prix pas cher', re.IGNORECASE),
        'replace': ' pas cher',
        'desc': '"à un prix pas cher" → "pas cher"',
        'savings': 10,
        'priority': 4
    },
    
    # Priorité 5: Conditions simplifiées
    {
        'pattern': re.compile(r"\s+s'il est (usé|grippé|cassé|défaillant|défectueux)", re.IGNORECASE),
        'replace': r' si \1',
        'desc': '"s\'il est X" → "si X"',
        'savings': 5,
        'priority': 5
    },
    {
        'pattern': re.compile(r'\s+à changer si (usé|grippé)', re.IGNORECASE),
        'replace': r' si \1',
        'desc': '"à changer si X" → "si X"',
        'savings': 9,
        'priority': 5
    },
    
    # Priorité 6: Redondances véhicule
    {
        'pattern': re.compile(r'\s+du véhicule$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "du véhicule" en fin',
        'savings': 12,
        'priority': 6
    },
    {
        'pattern': re.compile(r'\s+de votre véhicule$', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression "de votre véhicule" en fin',
        'savings': 18,
        'priority': 6
    },
    
    # Priorité 7: Simplifications mineures
    {
        'pattern': re.compile(r'pour une bonne ', re.IGNORECASE),
        'replace': 'pour la ',
        'desc': '"pour une bonne" → "pour la"',
        'savings': 5,
        'priority': 7
    },
    {
        'pattern': re.compile(r'pour un bon ', re.IGNORECASE),
        'replace': 'pour le ',
        'desc': '"pour un bon" → "pour le"',
        'savings': 4,
        'priority': 7
    },
]

# Règles pour les DESCRIPTIONS (> 155 chars)
SHORTEN_RULES_DESCRIP: List[Dict[str, Any]] = [
    # Priorité 1: Préfixes marque
    {
        'pattern': re.compile(r'^Automecanik vous conseils? de ', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression préfixe "Automecanik vous conseils de"',
        'savings': 30,
        'priority': 1
    },
    {
        'pattern': re.compile(r'^Automecanik vous conseille de ', re.IGNORECASE),
        'replace': '',
        'desc': 'Suppression préfixe "Automecanik vous conseille de"',
        'savings': 28,
        'priority': 1
    },
    
    # Priorité 2: Fins génériques
    {
        'pattern': re.compile(r'\s+pour le bon fonctionnement (des équipements|du moteur|du véhicule)\.?$', re.IGNORECASE),
        'replace': '.',
        'desc': 'Suppression fin générique "pour le bon fonctionnement de X"',
        'savings': 35,
        'priority': 2
    },
    {
        'pattern': re.compile(r'\s+pour assurer le bon fonctionnement\.?$', re.IGNORECASE),
        'replace': '.',
        'desc': 'Suppression "pour assurer le bon fonctionnement"',
        'savings': 35,
        'priority': 2
    },
    
    # Priorité 3: Redondances
    {
        'pattern': re.compile(r'\s+de votre véhicule\.?$', re.IGNORECASE),
        'replace': '.',
        'desc': 'Suppression "de votre véhicule" en fin',
        'savings': 18,
        'priority': 3
    },
    {
        'pattern': re.compile(r'\s+du véhicule\.?$', re.IGNORECASE),
        'replace': '.',
        'desc': 'Suppression "du véhicule" en fin',
        'savings': 12,
        'priority': 3
    },
    
    # Priorité 4: Simplifications
    {
        'pattern': re.compile(r'pour une bonne ', re.IGNORECASE),
        'replace': 'pour la ',
        'desc': '"pour une bonne" → "pour la"',
        'savings': 5,
        'priority': 4
    },
    {
        'pattern': re.compile(r'pour un bon ', re.IGNORECASE),
        'replace': 'pour le ',
        'desc': '"pour un bon" → "pour le"',
        'savings': 4,
        'priority': 4
    },
]

# ============================================
# RÈGLES DE CORRECTION AUTOMATIQUE
# ============================================

FIX_RULES: List[Dict[str, Any]] = [
    # GRAMMAIRE
    {
        'pattern': re.compile(r'qui\s+doit\s+être', re.IGNORECASE),
        'replace': 'qui doivent être',
        'desc': '"qui doit être" → "qui doivent être"',
        'category': 'grammaire'
    },
    {
        'pattern': re.compile(r'quoi\s+doivent', re.IGNORECASE),
        'replace': 'qui doivent',
        'desc': '"quoi doivent" → "qui doivent"',
        'category': 'grammaire'
    },
    
    # PONCTUATION
    {
        'pattern': re.compile(r',\s*\.\s*'),
        'replace': '. ',
        'desc': 'Virgule suivie de point ", ."',
        'category': 'ponctuation'
    },
    {
        'pattern': re.compile(r',\s*,'),
        'replace': ',',
        'desc': 'Double virgule ",,"',
        'category': 'ponctuation'
    },
    {
        'pattern': re.compile(r'\.\s*\.'),
        'replace': '.',
        'desc': 'Double point ".."',
        'category': 'ponctuation'
    },
    {
        'pattern': re.compile(r'(\w)\s+\.'),
        'replace': r'\1.',
        'desc': 'Espace avant point "mot ."',
        'category': 'ponctuation'
    },
    {
        'pattern': re.compile(r'\s+,'),
        'replace': ',',
        'desc': 'Espace avant virgule',
        'category': 'ponctuation'
    },
    {
        'pattern': re.compile(r'\s{2,}'),
        'replace': ' ',
        'desc': 'Espaces multiples',
        'category': 'ponctuation'
    },
    
    # HTML
    {
        'pattern': re.compile(r'<p>\s*</p>', re.IGNORECASE),
        'replace': '',
        'desc': 'Paragraphes vides <p></p>',
        'category': 'html'
    },
    {
        'pattern': re.compile(r'<strong>\s*</strong>', re.IGNORECASE),
        'replace': '',
        'desc': 'Strong vides <strong></strong>',
        'category': 'html'
    },
    {
        'pattern': re.compile(r'\s*style="[^"]*font-[^"]*"', re.IGNORECASE),
        'replace': '',
        'desc': 'Styles inline font-*',
        'category': 'html'
    },
    
    # ENTITÉS HTML
    {
        'pattern': re.compile(r'&eacute;'),
        'replace': 'é',
        'desc': '&eacute; → é',
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&egrave;'),
        'replace': 'è',
        'desc': '&egrave; → è',
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&agrave;'),
        'replace': 'à',
        'desc': '&agrave; → à',
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&ccedil;'),
        'replace': 'ç',
        'desc': '&ccedil; → ç',
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&#39;'),
        'replace': "'",
        'desc': "&#39; → '",
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&nbsp;'),
        'replace': ' ',
        'desc': '&nbsp; → espace',
        'category': 'entities'
    },
    {
        'pattern': re.compile(r'&amp;'),
        'replace': '&',
        'desc': '&amp; → &',
        'category': 'entities'
    },
]

# ============================================
# RÈGLES DE DÉTECTION (pas de correction auto)
# ============================================

DETECT_RULES: List[Dict[str, Any]] = [
    {
        'pattern': re.compile(r'#CompSwitch[^#]*#'),
        'desc': 'Marqueur CompSwitch non résolu',
        'severity': 'warning',  # Normal en template, résolu au runtime
        'category': 'markers'
    },
    {
        'pattern': re.compile(r'#LinkGammeCar_\d+#'),
        'desc': 'Marqueur LinkGammeCar non résolu',
        'severity': 'warning',
        'category': 'markers'
    },
    {
        'pattern': re.compile(r'#V[A-Za-z]+#'),
        'desc': 'Variable véhicule non résolue',
        'severity': 'warning',
        'category': 'markers'
    },
    {
        'pattern': re.compile(r'<p>[^<]{0,20}</p>'),
        'desc': 'Paragraphe très court (< 20 car)',
        'severity': 'info',
        'category': 'quality'
    },
]

# ============================================
# FONCTIONS D'APPLICATION
# ============================================

def apply_fixes(text: str) -> Tuple[str, List[str]]:
    """
    Applique toutes les règles de correction sur un texte.
    
    Returns:
        Tuple[str, List[str]]: (texte corrigé, liste des corrections appliquées)
    """
    if not text:
        return text, []
    
    result = text
    applied_fixes = []
    
    for rule in FIX_RULES:
        pattern = rule['pattern']
        replace = rule['replace']
        
        if pattern.search(result):
            new_result = pattern.sub(replace, result)
            if new_result != result:
                applied_fixes.append(rule['desc'])
                result = new_result
    
    return result, applied_fixes


def detect_issues(text: str, field_name: str = '') -> List[Dict[str, Any]]:
    """
    Détecte tous les problèmes dans un texte (corrigeables + informatifs).
    
    Returns:
        List[Dict]: Liste des problèmes détectés
    """
    if not text:
        return []
    
    issues = []
    
    # Vérifier règles corrigeables
    for rule in FIX_RULES:
        if rule['pattern'].search(text):
            issues.append({
                'desc': rule['desc'],
                'category': rule['category'],
                'severity': 'warning',
                'can_fix': True,
                'field': field_name
            })
    
    # Vérifier règles de détection seule
    for rule in DETECT_RULES:
        if rule['pattern'].search(text):
            issues.append({
                'desc': rule['desc'],
                'category': rule['category'],
                'severity': rule['severity'],
                'can_fix': False,
                'field': field_name
            })
    
    return issues


def get_stats_by_category(issues: List[Dict]) -> Dict[str, int]:
    """Compte les problèmes par catégorie"""
    stats = {}
    for issue in issues:
        cat = issue.get('category', 'autre')
        stats[cat] = stats.get(cat, 0) + 1
    return stats


# ============================================
# FONCTIONS DE RACCOURCISSEMENT META
# ============================================

def shorten_meta_title(text: str, target_max: int = 60, hard_max: int = 70) -> Tuple[str, List[str], bool]:
    """
    Raccourcit un meta title en appliquant les règles par priorité.
    S'arrête dès que la longueur est <= target_max.
    
    Args:
        text: Le title à raccourcir
        target_max: Longueur cible idéale (défaut: 60)
        hard_max: Longueur max absolue (défaut: 70)
    
    Returns:
        Tuple[str, List[str], bool]: (texte raccourci, règles appliquées, succès)
    """
    if not text:
        return text, [], True
    
    original_len = len(text)
    
    # Si déjà OK, ne rien faire
    if original_len <= target_max:
        return text, [], True
    
    result = text.strip()
    applied_rules = []
    
    # Trier les règles par priorité
    sorted_rules = sorted(SHORTEN_RULES_TITLE, key=lambda r: r['priority'])
    
    # Appliquer les règles jusqu'à atteindre target_max
    for rule in sorted_rules:
        if len(result) <= target_max:
            break
        
        pattern = rule['pattern']
        replace = rule['replace']
        
        if pattern.search(result):
            new_result = pattern.sub(replace, result)
            if new_result != result:
                applied_rules.append(f"{rule['desc']} (-{len(result) - len(new_result)} car)")
                result = new_result.strip()
    
    # Nettoyer les doubles espaces éventuels
    result = re.sub(r'\s{2,}', ' ', result).strip()
    
    # Vérifier le résultat
    final_len = len(result)
    success = final_len <= hard_max
    
    # Si encore trop long et > hard_max, tronquer intelligemment
    if not success:
        # Tronquer à la limite de mot
        truncated = result[:hard_max-3].rsplit(' ', 1)[0] + '...'
        applied_rules.append(f"Troncature à {hard_max} car (nécessite révision manuelle)")
        result = truncated
        success = False  # Marquer comme nécessitant révision
    
    return result, applied_rules, success


def shorten_meta_descrip(text: str, target_max: int = 155, hard_max: int = 160, min_len: int = 70) -> Tuple[str, List[str], bool]:
    """
    Raccourcit une meta description en appliquant les règles par priorité.
    S'arrête dès que la longueur est <= target_max.
    Ne raccourcit jamais en dessous de min_len.
    
    Args:
        text: La description à raccourcir
        target_max: Longueur cible idéale (défaut: 155)
        hard_max: Longueur max absolue (défaut: 160)
        min_len: Longueur minimum à conserver (défaut: 70)
    
    Returns:
        Tuple[str, List[str], bool]: (texte raccourci, règles appliquées, succès)
    """
    if not text:
        return text, [], True
    
    original_len = len(text)
    
    # Si déjà OK, ne rien faire
    if original_len <= target_max:
        return text, [], True
    
    result = text.strip()
    applied_rules = []
    
    # Trier les règles par priorité
    sorted_rules = sorted(SHORTEN_RULES_DESCRIP, key=lambda r: r['priority'])
    
    # Appliquer les règles jusqu'à atteindre target_max
    for rule in sorted_rules:
        if len(result) <= target_max:
            break
        
        pattern = rule['pattern']
        replace = rule['replace']
        
        if pattern.search(result):
            new_result = pattern.sub(replace, result)
            # Vérifier qu'on ne descend pas en dessous de min_len
            if new_result != result and len(new_result) >= min_len:
                applied_rules.append(f"{rule['desc']} (-{len(result) - len(new_result)} car)")
                result = new_result.strip()
    
    # Nettoyer les doubles espaces et points
    result = re.sub(r'\s{2,}', ' ', result)
    result = re.sub(r'\.{2,}', '.', result).strip()
    
    # S'assurer que ça finit par un point
    if result and not result.endswith('.') and not result.endswith('!') and not result.endswith('?'):
        result += '.'
    
    # Vérifier le résultat
    final_len = len(result)
    success = final_len <= hard_max
    
    # Si encore trop long, tronquer intelligemment
    if not success:
        truncated = result[:hard_max-3].rsplit(' ', 1)[0] + '...'
        applied_rules.append(f"Troncature à {hard_max} car (nécessite révision manuelle)")
        result = truncated
        success = False
    
    return result, applied_rules, success


def preview_shortening(text: str, field_type: str = 'title') -> Dict[str, Any]:
    """
    Prévisualise le raccourcissement sans appliquer.
    
    Args:
        text: Le texte à analyser
        field_type: 'title' ou 'descrip'
    
    Returns:
        Dict avec original, shortened, rules, lengths, success
    """
    if field_type == 'title':
        shortened, rules, success = shorten_meta_title(text)
        limits = SEO_LIMITS['title']
    else:
        shortened, rules, success = shorten_meta_descrip(text)
        limits = SEO_LIMITS['descrip']
    
    return {
        'original': text,
        'shortened': shortened,
        'rules_applied': rules,
        'original_len': len(text) if text else 0,
        'shortened_len': len(shortened) if shortened else 0,
        'chars_saved': (len(text) - len(shortened)) if text and shortened else 0,
        'success': success,
        'within_ideal': len(shortened) <= limits['ideal_max'] if shortened else True,
        'within_hard_max': len(shortened) <= limits['hard_max'] if shortened else True,
        'needs_review': not success or (shortened and len(shortened) > limits['ideal_max'])
    }
