/**
 * Feature flags
 *
 * Primary source: VITE_PAYMENT_GATEWAY_ENABLED build-time env var.
 * This is the fast, synchronous check used everywhere in the UI.
 *
 * The backend also guards its own checkout endpoints with
 * PAYMENT_GATEWAY_SUPPORTIVE=true — if that's false, calls will return 503
 * even if the frontend flag is true.
 */

/** True when VITE_PAYMENT_GATEWAY_ENABLED=true in the build environment */
export const isPaymentGatewayEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENT_GATEWAY_ENABLED === 'true';
