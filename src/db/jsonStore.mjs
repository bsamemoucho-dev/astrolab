import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function createEmptyState() {
  return {
    users: [],
    sessions: [],
    persons: [],
    birthData: [],
    dataPoints: [],
    dataSources: [],
    relationships: [],
    analyses: [],
    analysisVersions: [],
    methodResults: [],
    transversalFindings: [],
    calculationRuns: [],
    calculationArtifacts: [],
    reports: [],
    deliverables: [],
    deliverableVersions: [],
    orders: [],
    creditLedger: [],
    auditLogs: [],
    methods: [
      {
        id: "western-natal",
        tradition: "western_astrology",
        school: "hellenistic",
        name: "Western Natal V1 development calculator",
        status: "laboratory",
        productionEligible: false,
        documentationStatus: "partial_documentation_no_rule_version",
        version: "0.1.0-draft",
        sources: [
          "docs/methods/western-natal.md",
          "docs/corpora/hellenistic/claims/valens.md",
          "docs/corpora/hellenistic/claims/dorotheus.md",
          "docs/corpora/hellenistic/claims/ptolemy.md"
        ],
        notes: "Deterministic development calculation for tropical zodiac and Whole Sign houses. No interpretive RuleVersion is active."
      },
      {
        id: "western.placeholder",
        tradition: "western_astrology",
        school: null,
        name: "Western astrology module placeholder",
        status: "not_implemented",
        productionEligible: false,
        documentationStatus: "documentation_insufficient",
        version: "0.0.0",
        sources: [],
        notes: "Interface placeholder only. No methodological rule is implemented."
      },
      {
        id: "jyotisha.placeholder",
        tradition: "jyotisha",
        school: null,
        name: "Jyotisha module placeholder",
        status: "not_implemented",
        productionEligible: false,
        documentationStatus: "documentation_insufficient",
        version: "0.0.0",
        sources: [],
        notes: "Interface placeholder only. No methodological rule is implemented."
      }
    ],
    outbox: []
  };
}

export class JsonStore {
  constructor(filePath, initialState = createEmptyState()) {
    this.filePath = filePath;
    this.initialState = initialState;
    this.state = structuredClone(initialState);
    this.loaded = false;
  }

  async load() {
    if (this.loaded) {
      return this.state;
    }

    if (!this.filePath) {
      this.loaded = true;
      return this.state;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = {
        ...createEmptyState(),
        ...JSON.parse(raw)
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.save();
    }

    this.loaded = true;
    return this.state;
  }

  async save() {
    if (!this.filePath) {
      return;
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }

  async transact(mutator) {
    await this.load();
    const before = structuredClone(this.state);
    try {
      const result = await mutator(this.state);
      await this.save();
      return result;
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  id(prefix) {
    return `${prefix}_${randomUUID()}`;
  }
}
