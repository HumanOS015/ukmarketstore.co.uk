// UKMarketstore Coming Soon mode.
// While true, every listing detail page shows "GET NOTIFIED" instead of "Buy Now"
// and no checkout/payment/escrow path is reachable. Flip this to false at public
// launch to restore the normal Buy Now / payment flow. Collected subscriber
// records remain in the database regardless of this flag.
export const COMING_SOON_ENABLED = true;