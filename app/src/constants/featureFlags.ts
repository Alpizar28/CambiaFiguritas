/**
 * Feature flags globales para activar/desactivar superficies de UI.
 *
 * Estas constantes son evaluadas en build time. Cambiar el valor requiere
 * rebuild + redeploy.
 *
 * Para flags dinámicos (por usuario o A/B), usar Firebase Remote Config.
 */

/**
 * Si es `false`:
 * - Oculta PremiumCard del perfil.
 * - Oculta pill "Premium activo" en ProfileScreen.
 * - Oculta estrella ⭐ premium en MatchCard / MatchRow / MatchHistoryScreen.
 * - Oculta botón "Hacete Premium" en MatchLockCard cuando se llega al cap.
 * - Oculta el indicador "· premium" en banner de Matches.
 * - Hace que MatchHistoryScreen use retención fija (no diferencia premium).
 *
 * El flag NO toca:
 * - El campo `users/{uid}.premium` en Firestore (sigue siendo escrito por
 *   webhooks Tilopay/Play Billing si entran). El backend de matchSlots sigue
 *   reconociendo `premium=true` y dando uso ilimitado, pero el UI ya no lo
 *   promociona ni muestra como diferencia visible.
 * - Las funciones `purchasePremium()` ni los webhooks. Simplemente no hay
 *   forma de invocar la compra desde la UI.
 *
 * Cuando Premium vuelva a estar listo, set `true` y rebuildear. Toda la
 * lógica de checkout, billing y entitlements sigue intacta debajo.
 *
 * @see docs/PREMIUM-DISABLED.md para contexto histórico.
 */
export const ENABLE_PREMIUM_UI = true;

/**
 * Cap diario de búsquedas de matches para usuarios sin premium.
 * Mantener sincronizado con `functions/src/matchSlots.ts#FREE_CAP`.
 *
 * Solo se usa en mensajes UI ("Te quedan X de Y búsquedas hoy"). El cap real
 * lo aplica el backend en `consumeMatchSlot` para evitar bypass cliente.
 */
export const FREE_MATCH_CAP_DISPLAY = 1;
