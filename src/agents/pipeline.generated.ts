export type TechStack = string;
export interface PlanTask {
  id: string;
  module: string;
  description: string;
}
export interface PipelineOptions {
  locale?: string;
  buildCapabilities?: string[];
}
export function isValidTechStack(stack: string): stack is TechStack {
  return !!stack;
}
export function getTechStackDescription(stack: TechStack): string {
  return stack;
}
export function shouldContinueNeverGiveUp(): boolean {
  return false;
}
export async function runAgentPipeline(): Promise<void> {
  throw new Error("assemble pipeline first");
}
