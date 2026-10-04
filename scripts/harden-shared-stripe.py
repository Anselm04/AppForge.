from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "src/webhooks/stripe.ts"
text = PATH.read_text(encoding="utf-8")


def replace_required(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"required Stripe hardening pattern missing: {old[:120]!r}")
    text = text.replace(old, new, 1)


# Import the pure ownership classifier used to distinguish AppForge events from
# events belonging to other products in the same Stripe account.
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

# Subscription lifecycle events are accepted only when ownership resolves to AppForge.
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

# AppForge checkout sessions always carry product_line=appforge. Filter before
# resolving user IDs so malformed metadata from another product cannot affect this endpoint.
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

# A shared account can emit refunds for other products. Resolve the PaymentIntent
# first and return before touching AppForge credit reconciliation unless it is ours.
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

# Paid and failed subscription invoices must belong to AppForge before any local
# subscription/credit state is read or written.
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
print("Shared Stripe webhook ownership hardening complete")
