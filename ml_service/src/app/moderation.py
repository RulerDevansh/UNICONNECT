from typing import Dict

BANNED_KEYWORDS = {
    'weapon': 0.9,
    'fake id': 0.95,
    'essay mill': 0.85,
    'drug': 0.8,
    'ketamine': 0.92,
    'counterfeit': 0.88,
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
