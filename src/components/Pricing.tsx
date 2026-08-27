import type { AppForgePlan } from '../lib/billing';

type Props = { signedIn: boolean; busy?: boolean; onChoose: (plan: AppForgePlan) => void };

const tiers: { plan: AppForgePlan; name: string; price: string; credits: string; description: string }[] = [
  { plan: 'starter', name: 'Starter', price: '$49', credits: '100 compute credits / 16 builds per month', description: 'Turn ideas into structured app plans and save projects.' },
  { plan: 'builder', name: 'Builder', price: '$149', credits: '400 compute credits / 66 builds per month', description: 'For full build workflows, repositories, and deployments as they launch.' },
  { plan: 'studio', name: 'Studio', price: '$399', credits: '1,500 compute credits / unlimited builds per month', description: 'Priority builds and advanced delivery workflow for serious makers.' },
];

export function Pricing({ signedIn, busy, onChoose }: Props) {
  return (
    <section>
      <h2>Choose your AppForge plan</h2>
      <p>Starter $49, Builder $149, Studio $399 / month. Paid access begins after checkout succeeds.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
        {tiers.map((tier) => (
          <article key={tier.plan} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <h3>{tier.name}</h3>
            <p style={{ fontSize: 28, fontWeight: 800 }}>
              {tier.price}<small style={{ fontSize: 14 }}>/month</small>
            </p>
            <p><strong>{tier.credits}</strong></p>
            <p>{tier.description}</p>
            <button disabled={busy} onClick={() => onChoose(tier.plan)}>
              {signedIn ? `Choose ${tier.name}` : 'Sign in to subscribe'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
