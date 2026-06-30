RETENTION_CAMPANA_CORTA = 180
RETENTION_CAMPANA_ESTANDAR = 365
RETENTION_CAMPANA_LARGA = 730


def retention_label(days: int) -> str:
    if days <= 90:
        return f"{days} días (aproximadamente {days // 30} meses)"
    if days <= 180:
        return f"{days} días (aproximadamente 6 meses)"
    if days <= 365:
        return f"{days} días (aproximadamente 1 año)"
    if days <= 730:
        return f"{days} días (aproximadamente {days // 365} años)"
    return f"{days} días"
