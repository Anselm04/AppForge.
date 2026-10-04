from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "src/webhooks/stripe.ts"
text = PATH.read_text(encoding="utf-8")

FINAL_MARKERS = [
    'from "../services/appForgeStripeOwnership.js";',
    "function requireAppForgeSubscriptionOwnership(",
    '"stripe_foreign_product_event_ignored"',
    "if (!isAppForgeCreditMetadata(session.metadata)) return;",
    "if (!isAppForgeCreditMetadata(payment.metadata)) return;",
]


def replace_required(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"required Stripe hardening pattern missing: {old[:120]!r}")
    text = text.replace(old, new, 1)


# The repair workflow can run repeatedly as the PR advances. Treat a fully
# hardened webhook as success instead of trying to reapply old-source patches.
if not all(marker in text for marker in FINAL_MARKERS):
    import_anchor = 'import { resolveInvoiceCreditTier } from "../services/stripeInvoiceCredits.js";\n'
    if "appForgeStripeOwnership.js" not in text:
        replace_required(
            import_anchor,
            import_anchor
            + 'import {\n'
            + '  classifyAppForgeSubscription,\n'
            + '  isAppForgeCreditMetadata,\n'
            + '} from "../services/appForgeStripeOwnership.js";\n',
        )

    helper_anchor = '''function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}
'''
    helper_code = helper_anchor + '''
function requireAppForgeSubscriptionOwnership(
  subscription: Stripe.Subscription,
): boolean {
  const priceId = subscriptionPriceId(subscription);
  const ownership = classifyAppForgeSubscription(
    subscription.metadata,
    tierFromPriceId(priceId) !== null,
  );

  if (ownership === "foreign") {
    logger.info(
      { subscriptionId: subscription.id, priceId },
      "stripe_foreign_product_event_ignored",
    );
    return false;
  }

  if (ownership === "invalid_appforge") {
    throw new Error(
      `AppForge Stripe subscription uses an unconfigured price: ${priceId || "missing"}`,
    );
  }

  return true;
}
'''
    if "function requireAppForgeSubscriptionOwnership" not in text:
        replace_required(helper_anchor, helper_code)

    replace_required(
        '''      const subscription = await stripe.subscriptions.retrieve(snapshot.id);
      const customerId = customerIdFromSubscription(subscription);
''',
        '''      const subscription = await stripe.subscriptions.retrieve(snapshot.id);
      if (!requireAppForgeSubscriptionOwnership(subscription)) return;
      const customerId = customerIdFromSubscription(subscription);
''',
    )

    replace_required(
        '''    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFromSubscription(subscription);
''',
        '''    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (!requireAppForgeSubscriptionOwnership(subscription)) return;
      const customerId = customerIdFromSubscription(subscription);
''',
    )

    replace_required(
        '''    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveCheckoutUserId(session);
      const mode = session.mode;
''',
        '''    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const mode = session.mode;
      if (!isAppForgeCreditMetadata(session.metadata)) return;
      const userId = resolveCheckoutUserId(session);
''',
    )

    replace_required(
        '''        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        const customerId =
''',
        '''        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        if (!requireAppForgeSubscriptionOwnership(subscription)) return;
        const customerId =
''',
    )

    replace_required(
        '''    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveCheckoutUserId(session);
''',
        '''    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isAppForgeCreditMetadata(session.metadata)) return;
      const userId = resolveCheckoutUserId(session);
''',
    )

    replace_required(
        '''      const result = await reconcileCreditPurchaseRefund(
        paymentIntentId,
        event.id,
        charge.amount,
        charge.amount_refunded,
        charge.refunded,
      );
      if (result.purchaseMissing) {
        const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (
          payment.metadata.product_line === "appforge" &&
          parseCreditPack(payment.metadata.credits)
        ) {
          throw new Error(
            "Credit purchase is not yet recorded; retry refund after fulfillment",
          );
        }
      }
''',
        '''      const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!isAppForgeCreditMetadata(payment.metadata)) return;

      const result = await reconcileCreditPurchaseRefund(
        paymentIntentId,
        event.id,
        charge.amount,
        charge.amount_refunded,
        charge.refunded,
      );
      if (result.purchaseMissing && parseCreditPack(payment.metadata.credits)) {
        throw new Error(
          "Credit purchase is not yet recorded; retry refund after fulfillment",
        );
      }
''',
    )

    replace_required(
        '''          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = customerIdFromSubscription(subscription);
''',
        '''          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          if (!requireAppForgeSubscriptionOwnership(subscription)) return;
          const customerId = customerIdFromSubscription(subscription);
''',
    )

    replace_required(
        '''        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        await db
''',
        '''        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        if (!requireAppForgeSubscriptionOwnership(subscription)) return;
        await db
''',
    )

    PATH.write_text(text, encoding="utf-8")

# Existing delayed-event tests predate product-level Stripe isolation. These
# replacements are also intentionally idempotent.
test_path = ROOT / "src/__tests__/stripeDelayedEvents.test.ts"
test = test_path.read_text(encoding="utf-8")
test = test.replace(
    'metadata: { userId: "42", credits: "50" },',
    'metadata: { product_line: "appforge", userId: "42", credits: "50" },',
)
test = test.replace(
    'mocks.retrieve.mockResolvedValue({ id: "sub_current", status });',
    '''mocks.retrieve.mockResolvedValue({
        id: "sub_current",
        status,
        metadata: { product_line: "appforge", userId: "42" },
        items: { data: [{ price: { id: "price_starter" } }] },
      });''',
)
test = test.replace(
    'mocks.retrieve.mockResolvedValue({ id: "sub_current", status: "active" });',
    '''mocks.retrieve.mockResolvedValue({
      id: "sub_current",
      status: "active",
      metadata: { product_line: "appforge", userId: "42" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });''',
)
test = test.replace(
    '''      metadata: { userId: "42" },
    });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);''',
    '''      metadata: { product_line: "appforge", userId: "42" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);''',
)
test_path.write_text(test, encoding="utf-8")

# Fail closed if a partial hardening ever slips through.
text = PATH.read_text(encoding="utf-8")
missing = [marker for marker in FINAL_MARKERS if marker not in text]
if missing:
    raise SystemExit("shared Stripe hardening incomplete: " + ", ".join(missing))

print("Shared Stripe webhook ownership hardening complete")
