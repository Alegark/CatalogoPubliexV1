export type CommerceEvent = {
  eventType: 'add_to_cart' | 'whatsapp_checkout';
  productId?: number;
  source?: 'catalog' | 'product_detail';
  sizeName?: string;
  quantity?: number;
  itemCount?: number;
  amountUsd?: number;
};

export async function trackCommerceEvent(event: CommerceEvent): Promise<boolean> {
  const body = JSON.stringify(event);

  const sendBeaconFallback = (): boolean => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        return navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }));
      }
    } catch {
      // Analytics must never interrupt the customer's shopping flow.
    }
    return false;
  };

  try {
    // Use fetch first so callers can wait until PostgreSQL has accepted the
    // event before refreshing the admin dashboard. Beacon is only a fallback
    // for browsers that cannot complete a regular request.
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
    return response.ok;
  } catch {
    return sendBeaconFallback();
  }
}
