from typing import Dict

BANNED_KEYWORDS = {
    'weapon': 0.9,
    'fake id': 0.95,
    'essay mill': 0.85,
    'drug': 0.8,
    'ketamine': 0.92,
    'counterfeit': 0.88,
    'wine': 0.82,
    'Wine': 0.82,
    'WINE': 0.82,
    'Beer': 0.82,
    'BEER': 0.82,
    'beer': 0.82,
    'rum': 0.82,
    'vodka': 0.82,
    'whiskey': 0.82,
    'tequila': 0.82,
    'alcohol': 0.82,
    'cigarette': 0.83,
    'cigarettes': 0.83,
    'cigar': 0.83,
    'cannabis': 0.9,
    'marijuana': 0.9,
    'hash': 0.88,
    'mdma': 0.93,
    'lsd': 0.93,
    'dildo': 0.9,
    'sex toy': 0.9,
    'sextoy': 0.9,
    'porn': 0.9,
    'escort': 0.9,
    'steroid': 0.85,
    'steroids': 0.85,
    'meth': 0.94,
    'methamphetamine': 0.95,
    'cocaine': 0.95,
    'heroin': 0.95,
    'fentanyl': 0.96,
    'opioid': 0.9,
    'opium': 0.9,
    'shrooms': 0.9,
    'mushrooms': 0.9,
    'hookah': 0.83,
    'nicotine': 0.83,
    'vape': 0.83,
    'xanax': 0.94,
    'adderall': 0.9,
    'escort service': 0.92,
    'prostitution': 0.94,
    'brothel': 0.9,
    'sex work': 0.9,
    'skimmer': 0.9,
    'grenade': 0.95,
    'explosive': 0.95,
    'detonator': 0.95,
}


def score_listing(title: str, description: str) -> Dict[str, str]:
    text = f"{title} {description}".lower()
    max_score = 0
    reason = 'clean'
    for keyword, score in BANNED_KEYWORDS.items():
        if keyword in text:
            if score > max_score:
                max_score = score
                reason = f'keyword:{keyword}'
    flagged = max_score >= 0.8
    return {
        'flagged': flagged,
        'score': round(max_score, 4),
        'reason': reason,
    }
