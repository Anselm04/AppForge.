import type { AppForgePlan } from '../lib/billing';

type Props = { signedIn: boolean; busy?: boolean; onChoose: (plan: AppForgePlan) => void };
const tiers: { plan: AppForgePlan; name: string; price: string; credits: string; description: string }[] = [
  { plan: 'starter', name: 'Starter', price: '$49', credits: '2 build credits/month', description: 'Turn ideas into structured app plans and save projects.' },
  { plan: 'builder', name: 'Builder', price: '$149', credits: '8 build credits/month', description: 'For full build workflows, repositories, and deployments as they launch.' },
  { plan: 'studio', name: 'Studio', price: '$399', credits: '30 build credits/month', description: 'Priority builds and advanced delivery workflow for serious makers.' },
];
export function Pricing({ signedIn, busy, onChoose }: Props) {
  return <section><h2>Choose your AppForge plan</h2><p>Build credits are used for complete AI-assisted build attempts.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>{tiers.map(t => <article key={t.plan} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}><h3>{t.name}</h3><p style={{ fontSize: 28, fontWeight: 800 }}>{t.price}<small style={{ fontSize: 14 }}>/month</small></p><p><strong>{t.credits}</strong></p><p>{t.description}</p><button disabled={busy} onClick={() => onChoose(t.plan)}>{signedIn ? `Choose ${t.name}` : 'Sign in to choose'}</button></article>)}</div></section>;
}
