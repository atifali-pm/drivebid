PRICING = {
    "base_fare": 100,
    "per_km": 35,
    "per_minute": 5,
    "min_fare": 150,
    "platform_commission_pct": 12,
    "currency": "Rs",
}


def format_money(amount: float) -> str:
    return f"{PRICING['currency']} {round(amount):,}"
