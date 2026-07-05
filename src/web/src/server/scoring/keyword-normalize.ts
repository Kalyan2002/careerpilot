/**
 * Shared keyword-normalization primitives for the tech-stack matching paths
 * (`scoring/fit.ts` and `resume/tailor.ts`). NOT for title/company duplicate
 * detection — that lives in `scoring/applied-duplicates.ts` and strips
 * seniority/company suffixes for Jaro-Winkler comparison.
 */

const SYNONYMS: Record<string, string[]> = {
  js: ["javascript"],
  ts: ["typescript"],
  nextjs: ["next.js", "next"],
  nodejs: ["node", "node.js"],
  postgres: ["postgresql"],
  k8s: ["kubernetes"],
  dotnet: [".net", "aspnet"],
  golang: ["go"],
  azuredevops: ["azure devops", "azure devops pipelines", "azuredevopspipelines", "ado"],
  azuredevopspipelines: ["azure devops", "azure devops pipelines", "azuredevops", "ado", "cicd", "ci/cd", "ci cd"],
  terraform: ["tf", "hashicorp terraform", "infrastructure as code", "iac"],
  powershell: ["ps1", "pwsh", "powershell scripting"],
  azuremonitor: ["azure monitor", "log analytics", "azure log analytics"],
  githubactions: ["github actions", "gh actions"],

  // CI/CD variations
  cicd: ["ci/cd", "ci cd", "continuous integration", "continuous deployment", "continuous delivery", "cd", "azure devops pipelines", "azure devops", "github actions", "jenkins", "ci cd pipeline"],
  jenkins: ["ci/cd", "cicd", "ci cd"],

  // Cloud security & networking
  cloudsecurity: ["cloud security", "azure security best practices", "azure security", "security best practices"],
  networksecurity: ["network security", "nsg", "nsgs", "firewall"],
  networking: ["azure networking", "network infrastructure", "cloud networking", "vnets", "vnet"],

  // DevOps
  devops: ["dev ops", "azure devops", "azure devops pipelines", "azuredevops"],

  // Cloud infrastructure
  cloudinfrastructure: ["cloud infrastructure", "cloud infra", "cloud platform", "cloud platforms", "cloud computing"],
  cloudoperations: ["cloud operations", "cloud ops", "cloudops"],

  // Automation
  automation: ["azure automation", "automation tools", "cloud automation"],

  // Linux
  linux: ["linux administration", "linux admin"],

  // Azure services
  azure: ["microsoft azure", "azure cloud", "ms azure"],
  microsoftazure: ["azure", "azure cloud", "ms azure"],
  azurenetworking: ["azure networking", "networking", "vnets", "network infrastructure"],
  loadbalancer: ["load balancer", "load balancers", "azure load balancer"],
  storageaccounts: ["storage accounts", "azure storage", "blob storage"],

  // ARM / IaC
  armtemplates: ["arm templates", "arm", "azure resource manager"],

  // Containers & orchestration
  docker: ["containers", "container", "containerization"],
  kubernetes: ["k8s", "container orchestration"],

  // Scripting
  bash: ["bash scripting", "shell scripting", "shell"],
  python: ["python scripting", "python3"],

  // Monitoring & observability
  prometheus: ["monitoring"],
  solarwinds: ["monitoring"],

  // Version control
  git: ["github", "gitlab", "version control"],

  // Windows & identity
  windowsserver: ["windows server", "windows"],
  activedirectory: ["active directory", "ad", "identity management", "iam"],

  // Misc
  restapis: ["rest apis", "rest api", "web services", "api development"],
  fastapi: ["fast api"],
  troubleshooting: ["system troubleshooting", "root cause analysis", "rca"],
  configurationmanagement: ["configuration management", "config management", "terraform", "arm templates", "azure automation"],
  softwaredevelopment: ["software development", "software engineering"],
  agile: ["agile methodology", "scrum"],
};

/** Lowercase + strip all non-alphanumerics (no spaces). Use for tight equality
 *  comparison of single tech tokens — e.g. "Next.js" → "nextjs". */
export function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Lowercase + collapse non-alphanumerics to single spaces. Use as the haystack
 *  for substring search inside bullet/sentence text — preserves word boundaries
 *  so "React.js applications" → "react js applications" matches a "react js"
 *  variant without collapsing into a single run. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const expandCache = new Map<string, string[]>();

/** Every recognised spelling of a term, returned in both compact and spaced
 *  forms so callers can substring-search either flavour. Returns deduped
 *  non-empty strings; idempotent for already-canonical inputs.
 *
 *  Memoized: tech terms repeat heavily inside `matchesAny` / `bulletScore`
 *  loops across many bullets and skill items per request. */
export function expandSynonyms(term: string): string[] {
  const cached = expandCache.get(term);
  if (cached) {
    return cached;
  }

  const variants = new Set<string>();
  const compact = normalizeKeyword(term);
  const spaced = normalizePhrase(term);
  if (compact) variants.add(compact);
  if (spaced) variants.add(spaced);

  for (const [canon, alts] of Object.entries(SYNONYMS)) {
    const altsCompact = alts.map(normalizeKeyword);
    if (compact === canon || altsCompact.includes(compact)) {
      variants.add(canon);
      for (const alt of alts) {
        const c = normalizeKeyword(alt);
        const s = normalizePhrase(alt);
        if (c) variants.add(c);
        if (s) variants.add(s);
      }
    }
  }

  const result = [...variants];
  expandCache.set(term, result);
  return result;
}
