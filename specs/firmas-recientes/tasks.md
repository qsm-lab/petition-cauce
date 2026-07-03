# Tasks — firmas-recientes (retroactivo)

- [x] **T1** `get_recent_signatures` en `signature_service.py`: filtra `confirmed` + `publica`, orden desc, límite configurable (R1, R2, R4)
- [x] **T2** `GET /{id}/signatures/recent` endpoint público en `public_campaign.py` (R5)
- [x] **T3** `RecentSignatures.tsx`: SSR inicial + polling 30s, avatar, nombre/anónimo, provincia, tiempo relativo (R4–R7)
- [x] **T4** Fetch SSR en `page.tsx` y pase como prop `initial` a `CampaignPage` → `RecentSignatures` (R5)
- [x] **T5** Aviso "firmas anónimas aparecen como Anónimo" (R8)
