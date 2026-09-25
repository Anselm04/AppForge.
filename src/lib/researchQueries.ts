import type { ProductContract } from "./productContract.js";
import {
  DEPLOYMENT_TARGET_DOCS,
  PRODUCT_TYPE_QUESTIONS,
  STACK_RESEARCH_TARGETS,
  integrationTarget,
  monetizationDocsForProduct,
  securityDocForProduct,
} from "./researchTargets.js";

export function buildContractResearchQueries(input: {
  contract: ProductContract;
  year?: number;
  redesignBrief?: string;
}): string[] {
  const year = input.year ?? new Date().getUTCFullYear();
  const { contract } = input;
  const stack = contract.selectedTechnologyStack;
  const product = contract.productType.replace(/_/g, " ");
  const stackTarget = STACK_RESEARCH_TARGETS[stack];
  const framework = stackTarget?.framework ?? stack;
  const queries = [
    `${framework} official documentation latest stable version supported runtime ${year}`,
    `${framework} official deployment production guide platform limitations ${year}`,
    `${framework} GitHub production implementation example current ${year}`,
    `${framework} licensing license requirements dependencies ${year}`,
    `${framework} security advisories OWASP NVD known vulnerabilities ${year}`,
    `${product} production architecture patterns ${framework} ${year}`,
  ];

  for (const doc of stackTarget?.docs ?? []) {
    queries.push(`${doc.label} ${framework} current ${year}`);
  }
  for (const item of PRODUCT_TYPE_QUESTIONS[contract.productType] ?? []) {
    queries.push(`${item.query} ${year}`);
  }
  for (const integration of contract.integrations) {
    const target = integrationTarget(integration);
    const name = target?.name ?? integration;
    queries.push(
      `${name} official API documentation ${framework} current version authentication webhooks rate limits ${year}`,
      `${name} official security webhook signature retry idempotency limitations ${year}`,
    );
    for (const doc of target?.docs ?? []) {
      queries.push(`${doc.label} ${name} current ${year}`);
    }
  }
  for (const requirement of contract.deploymentRequirements) {
    queries.push(`${framework} official deployment ${requirement} ${year}`);
  }
  for (const docs of Object.values(DEPLOYMENT_TARGET_DOCS)) {
    for (const doc of docs) {
      queries.push(`${doc.label} platform limits deployment ${year}`);
    }
  }
  for (const requirement of contract.monetizationRequirements) {
    queries.push(`official monetization billing ${requirement} ${framework} ${year}`);
  }
  for (const doc of monetizationDocsForProduct(contract.productType)) {
    queries.push(`${doc.label} monetization ${year}`);
  }
  for (const requirement of contract.securityRequirements) {
    queries.push(`OWASP official security ${requirement} ${framework} ${year}`);
  }
  queries.push(`${securityDocForProduct(contract.productType).label} ${framework} ${year}`);
  for (const requirement of contract.researchRequirements) {
    queries.push(`${requirement} ${year}`);
  }
  if (input.redesignBrief) {
    const failure = input.redesignBrief.replace(/\s+/g, " ").trim().slice(0, 260);
    queries.push(
      `${framework} official docs solve production failure ${failure} ${year}`,
      `${framework} GitHub issue production workaround ${failure} ${year}`,
    );
  }
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()))];
}
