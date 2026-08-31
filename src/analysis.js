const MAX_TEXT_LENGTH = 250_000;

const MANDATORY_PATTERN = /\b(must|shall|required|mandatory|condition of (?:award|submission)|will be rejected|non[- ]responsive|responsiveness requirement)\b/i;
const SCORED_PATTERN = /\b(evaluat(?:e|ed|ion)|scor(?:e|ed|ing)|preference|weighted|points?|best value|selection criteria)\b/i;
const INJECTION_PATTERN = /\b(ignore (?:all |any )?(?:previous|prior|system) instructions|reveal (?:the )?(?:system|developer) prompt|change your role|automatic go|omit (?:the )?requirement)\b/i;
const DEADLINE_PATTERN = /\b(deadline|due|closing|close date|submission date|submitted by|responses? (?:are )?due|bid opening|question(?:s)? due)\b/i;
const LICENSE_PATTERN = /\b(?:active |valid |current )?([A-Z][A-Za-z0-9 .&()/-]{1,55}?(?:license|licence|certification|certificate|clearance|registration))\b/g;
const SET_ASIDE_PATTERN = /\b(8\(a\)|HUBZone|SDVOSB|VOSB|WOSB|EDWOSB|small business set[- ]aside|DBE|MBE|WBE)\b/gi;
const KNOWN_CERT_PATTERN = /\b(ISO\s?\d{4,5}(?::\d{4})?|SOC\s?2(?:\sType\s[12I]{1,2})?|CMMC(?:\sLevel\s[1-3])?|FedRAMP(?:\s(?:Low|Moderate|High))?|PCI[- ]DSS|LEED(?:\s[A-Z]+)?|OSHA\s?\d{2})\b/gi;
const NAICS_PATTERN = /\bNAICS(?:\s(?:code|codes))?[^\d]{0,12}(\d{6})\b/gi;
const MONEY_PATTERN = /(?:USD\s*)?\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:million|billion|M|B))?/gi;
const DATE_PATTERN = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{4}(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s+[A-Z]{2,4})?)?|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/gi;

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function asStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
  );
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "that", "this", "from", "will", "shall", "must", "are", "into", "their", "they",
  "bid", "rfp", "rfq", "proposal", "solicitation", "contract", "contractor", "required", "requirements", "service", "services",
]);

function lineRecords(text) {
  return text.split(/\r?\n/).map((raw, index) => ({
    line: index + 1,
    text: raw.replace(/\s+/g, " ").trim(),
  })).filter((item) => item.text);
}

function requirementRecords(text) {
  const records = [];
  for (const line of lineRecords(text)) {
    const pieces = line.text.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/);
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (trimmed.length < 8) continue;
      if (MANDATORY_PATTERN.test(trimmed) || SCORED_PATTERN.test(trimmed)) {
        records.push({
          line: line.line,
          text: trimmed.slice(0, 1_200),
          type: MANDATORY_PATTERN.test(trimmed) ? "mandatory" : "scored",
          citation: `user-supplied text, line ${line.line}`,
        });
      }
    }
  }
  return records.slice(0, 500);
}

function findAll(pattern, text) {
  pattern.lastIndex = 0;
  const output = [];
  for (const match of text.matchAll(pattern)) output.push(match[1] || match[0]);
  return uniq(output.map((item) => item.trim()));
}

function parseDate(raw) {
  const cleaned = raw
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b(a|p)\.m\./gi, "$1m")
    .replace(/\bat\s+/i, "")
    .trim();
  const timestamp = Date.parse(cleaned);
  if (Number.isFinite(timestamp)) return new Date(timestamp);
  const dateOnly = cleaned.match(/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*|\s+)\d{4}|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i)?.[0];
  if (!dateOnly) return null;
  const fallback = Date.parse(dateOnly);
  return Number.isFinite(fallback) ? new Date(fallback) : null;
}

function dateFindings(records, asOf) {
  const findings = [];
  for (const record of records) {
    DATE_PATTERN.lastIndex = 0;
    for (const match of record.text.matchAll(DATE_PATTERN)) {
      const parsed = parseDate(match[0]);
      const isDeadline = DEADLINE_PATTERN.test(record.text);
      const daysRemaining = parsed ? Math.ceil((parsed.getTime() - asOf.getTime()) / 86_400_000) : null;
      findings.push({
        raw: match[0],
        parsed_utc: parsed ? parsed.toISOString() : null,
        context: record.text.slice(0, 500),
        kind: isDeadline ? "deadline" : "date",
        days_remaining: daysRemaining,
        citation: `user-supplied text, line ${record.line}`,
      });
    }
  }
  return findings.slice(0, 100);
}

function evidenceInventory(profile) {
  const groups = [
    ...asStrings(profile.services),
    ...asStrings(profile.keywords),
    ...asStrings(profile.licenses),
    ...asStrings(profile.certifications),
    ...asStrings(profile.clearances),
    ...asStrings(profile.registrations),
    ...asStrings(profile.set_asides),
    ...asStrings(profile.states),
    ...asStrings(profile.evidence_notes),
  ];
  return normalize(groups.join(" | "));
}

function completeFields(profile) {
  return new Set(asStrings(profile.complete_fields).map(normalize));
}

function categoryForRequirement(text) {
  if (/\b(deadline|due|closing|close date|submission date|submitted by)\b/i.test(text)) return "deadline";
  if (/\b(license|licence)\b/i.test(text)) return "licenses";
  if (/\b(certification|certificate|cmmc|iso\s?\d|soc\s?2|fedramp|pci|leed|osha)\b/i.test(text)) return "certifications";
  if (/\b(clearance|classified|secret|top secret)\b/i.test(text)) return "clearances";
  if (SET_ASIDE_PATTERN.test(text)) return "set_asides";
  if (/\b(bond|bonding)\b/i.test(text)) return "bonding";
  if (/\b(insurance|liability|workers.? compensation)\b/i.test(text)) return "insurance";
  if (/\b(site visit|pre[- ]bid|mandatory meeting|conference)\b/i.test(text)) return "attendance";
  if (/\b(experience|past performance|similar projects?|references?)\b/i.test(text)) return "past_performance";
  if (/\b(page limit|font|file format|portal|signature|signed|submission method)\b/i.test(text)) return "submission";
  if (/\b(state|county|city|geograph|located|location|onsite|on-site)\b/i.test(text)) return "geography";
  return "other";
}

function requirementStatus(requirement, profile, inventory, asOf) {
  const category = categoryForRequirement(requirement.text);
  const knownAbsences = normalize(asStrings(profile.known_absences).join(" | "));
  const categoryComplete = completeFields(profile).has(normalize(category));
  const requirementTerms = words(requirement.text);
  const evidenceTerms = words(inventory);
  const overlap = [...requirementTerms].filter((term) => evidenceTerms.has(term));

  if (category === "deadline") {
    DATE_PATTERN.lastIndex = 0;
    const dateText = requirement.text.match(DATE_PATTERN)?.[0];
    const parsed = dateText ? parseDate(dateText) : null;
    if (parsed && parsed.getTime() < asOf.getTime()) {
      return { status: "FAIL", category, evidence: "Submission deadline appears to have passed.", noncurable: true };
    }
    if (parsed) return { status: "PASS", category, evidence: `${Math.ceil((parsed.getTime() - asOf.getTime()) / 86_400_000)} day(s) remain; verify time zone and amendments.`, noncurable: false };
  }

  const distinctive = [...requirementTerms].filter((term) => term.length >= 5);
  const absenceHit = distinctive.some((term) => knownAbsences.includes(term));
  if (absenceHit) {
    return { status: "FAIL", category, evidence: "Company profile explicitly identifies this item as absent.", noncurable: /at submission|no substitutions?|teaming (?:is )?prohibited/i.test(requirement.text) };
  }

  if (overlap.length >= Math.min(2, Math.max(1, distinctive.length))) {
    return { status: "PASS", category, evidence: `Profile evidence overlaps: ${overlap.slice(0, 5).join(", ")}. Verify the underlying document.`, noncurable: false };
  }

  if (categoryComplete && ["licenses", "certifications", "clearances", "set_asides", "states"].includes(category)) {
    return { status: "FAIL", category, evidence: `Profile marks ${category} as complete and contains no matching evidence.`, noncurable: /at submission|teaming (?:is )?prohibited|no substitutions?/i.test(requirement.text) };
  }

  return { status: "UNKNOWN", category, evidence: `Provide documentary evidence for ${category.replaceAll("_", " ")}.`, noncurable: false };
}

function buildCompliance(requirements, profile, inventory, asOf) {
  return requirements.map((requirement, index) => {
    const result = requirement.type === "mandatory"
      ? requirementStatus(requirement, profile, inventory, asOf)
      : { status: "UNASSESSED", category: "evaluation", evidence: "Map a factual response and supporting evidence to this scored criterion.", noncurable: false };
    return {
      id: `R${String(index + 1).padStart(3, "0")}`,
      requirement: requirement.text,
      requirement_type: requirement.type,
      category: result.category,
      source: requirement.citation,
      status: result.status,
      evidence_needed: result.evidence,
      owner: "[ASSIGN]",
      due_date: "[VERIFY]",
      response_location: "[MAP TO RESPONSE]",
      noncurable: result.noncurable,
    };
  });
}

function overlapScore(text, profile) {
  const profileTerms = words([...asStrings(profile.services), ...asStrings(profile.keywords)].join(" "));
  if (!profileTerms.size) return { range: [0, 20], confidence: "low", rationale: "No services or capability keywords were supplied." };
  const textTerms = words(text);
  const matched = [...profileTerms].filter((term) => textTerms.has(term));
  const ratio = matched.length / profileTerms.size;
  const score = Math.max(2, Math.min(20, Math.round(4 + ratio * 16)));
  return { range: [Math.max(0, score - 3), Math.min(20, score + 2)], confidence: matched.length >= 3 ? "medium" : "low", rationale: `${matched.length} of ${profileTerms.size} supplied capability terms appear in the solicitation.`, matched };
}

function factorScores(text, profile, compliance, dates, amounts) {
  const strategic = overlapScore(text, profile);
  const mandatory = compliance.filter((item) => item.requirement_type === "mandatory");
  const pass = mandatory.filter((item) => item.status === "PASS").length;
  const fail = mandatory.filter((item) => item.status === "FAIL").length;
  const unknown = mandatory.filter((item) => item.status === "UNKNOWN").length;
  const capabilityRange = fail
    ? [0, Math.max(2, 10 - fail * 3)]
    : mandatory.length
      ? [Math.round((pass / mandatory.length) * 15), Math.min(20, Math.round(((pass + unknown) / mandatory.length) * 20))]
      : [8, 20];

  const winSignals = asStrings(profile.win_signals).length;
  const competitiveRisks = asStrings(profile.competitive_risks).length;
  const competitive = winSignals || competitiveRisks
    ? [Math.max(0, Math.min(15, 5 + winSignals * 3 - competitiveRisks * 2)), Math.max(0, Math.min(15, 8 + winSignals * 3 - competitiveRisks))]
    : [0, 15];

  const economicsKnown = amounts.length > 0 && (profile.minimum_margin_percent != null || profile.minimum_contract_value != null);
  const economics = economicsKnown ? [8, 14] : [0, 15];

  const capacity = profile.delivery_capacity;
  const delivery = capacity === true ? [8, 10] : capacity === false ? [0, 2] : [0, 10];

  const deadlineDates = dates.filter((item) => item.kind === "deadline" && item.days_remaining != null);
  const nearestDeadline = deadlineDates.sort((a, b) => a.days_remaining - b.days_remaining)[0];
  const minDays = Number.isFinite(Number(profile.minimum_days_to_bid)) ? Number(profile.minimum_days_to_bid) : 7;
  let timeline = [0, 10];
  let timelineRationale = "No machine-readable submission deadline was found.";
  if (nearestDeadline) {
    if (nearestDeadline.days_remaining < 0) {
      timeline = [0, 0];
      timelineRationale = "The nearest identified deadline has passed.";
    } else if (nearestDeadline.days_remaining < minDays) {
      timeline = [1, 5];
      timelineRationale = `${nearestDeadline.days_remaining} day(s) remain, below the supplied ${minDays}-day planning floor.`;
    } else {
      timeline = [7, 10];
      timelineRationale = `${nearestDeadline.days_remaining} day(s) remain before the nearest identified deadline.`;
    }
  }

  const riskEvidence = asStrings(profile.commercial_risks).length + asStrings(profile.legal_risks).length;
  const risk = riskEvidence ? [Math.max(0, 8 - riskEvidence * 2), Math.max(2, 10 - riskEvidence)] : [0, 10];

  return [
    { factor: "Strategic fit", weight: 20, score_range: strategic.range, confidence: strategic.confidence, rationale: strategic.rationale, matched_terms: strategic.matched || [] },
    { factor: "Capability and evidence fit", weight: 20, score_range: capabilityRange, confidence: mandatory.length ? "medium" : "low", rationale: `${pass} mandatory PASS, ${fail} FAIL, and ${unknown} UNKNOWN.` },
    { factor: "Win probability and competitive position", weight: 15, score_range: competitive, confidence: winSignals || competitiveRisks ? "medium" : "low", rationale: winSignals || competitiveRisks ? `${winSignals} supplied win signal(s) and ${competitiveRisks} competitive risk(s).` : "No buyer relationship, incumbent, differentiation, or price-position evidence was supplied." },
    { factor: "Revenue, margin, and payment attractiveness", weight: 15, score_range: economics, confidence: economicsKnown ? "medium" : "low", rationale: economicsKnown ? "A stated value and at least one company economic threshold are available for review." : "Contract value, margin floor, payment terms, or proposal cost is incomplete." },
    { factor: "Delivery capacity", weight: 10, score_range: delivery, confidence: capacity == null ? "low" : "medium", rationale: capacity === true ? "The profile affirms delivery capacity; staffing and schedule still require evidence." : capacity === false ? "The profile states delivery capacity is unavailable." : "Delivery capacity was not supplied." },
    { factor: "Timeline feasibility", weight: 10, score_range: timeline, confidence: nearestDeadline ? "medium" : "low", rationale: timelineRationale },
    { factor: "Legal, compliance, and commercial risk", weight: 10, score_range: risk, confidence: riskEvidence ? "medium" : "low", rationale: riskEvidence ? `${riskEvidence} supplied risk item(s) reduce the range.` : "Contract terms, insurance, bonding, exceptions, and legal risks require review." },
  ];
}

function decide(factors, compliance) {
  const low = factors.reduce((sum, item) => sum + item.score_range[0], 0);
  const high = factors.reduce((sum, item) => sum + item.score_range[1], 0);
  const midpoint = Math.round((low + high) / 2);
  const failed = compliance.filter((item) => item.status === "FAIL");
  const noncurable = failed.filter((item) => item.noncurable);
  const unknown = compliance.filter((item) => item.requirement_type === "mandatory" && item.status === "UNKNOWN");
  let recommendation;
  if (noncurable.length || failed.some((item) => item.category === "deadline")) recommendation = "NO-GO";
  else if (failed.length) recommendation = "NO-GO";
  else if (low >= 70 && unknown.length === 0) recommendation = "GO";
  else if (low >= 55) recommendation = "CONDITIONAL GO";
  else if (high < 55) recommendation = unknown.length ? "HOLD" : "NO-GO";
  else if (unknown.length || high - low > 20) recommendation = "HOLD";
  else recommendation = midpoint >= 55 ? "CONDITIONAL GO" : "HOLD";

  const reasons = [];
  if (failed.length) reasons.push(`${failed.length} mandatory requirement(s) are classified FAIL.`);
  if (unknown.length) reasons.push(`${unknown.length} mandatory requirement(s) remain UNKNOWN.`);
  const strategic = factors.find((item) => item.factor === "Strategic fit");
  reasons.push(strategic.rationale);
  const timeline = factors.find((item) => item.factor === "Timeline feasibility");
  reasons.push(timeline.rationale);

  return {
    recommendation,
    confidence: high - low <= 15 && unknown.length === 0 ? "medium" : "low",
    score_range: { low, high, midpoint },
    top_reasons: uniq(reasons).slice(0, 3),
    mandatory_failures: failed.length,
    mandatory_unknowns: unknown.length,
    caveat: "Decision support only. Verify the official solicitation, amendments, visually embedded content, and final submission with a qualified human reviewer.",
  };
}

function snapshot(text, dates) {
  return {
    naics_codes: findAll(NAICS_PATTERN, text),
    set_asides: findAll(SET_ASIDE_PATTERN, text),
    certifications: findAll(KNOWN_CERT_PATTERN, text),
    licenses_and_clearances: findAll(LICENSE_PATTERN, text).slice(0, 50),
    stated_amounts: findAll(MONEY_PATTERN, text).slice(0, 50),
    dates,
  };
}

function securityFlags(records) {
  return records.filter((record) => INJECTION_PATTERN.test(record.text)).map((record) => ({
    kind: "document_prompt_injection",
    source: `user-supplied text, line ${record.line}`,
    excerpt: record.text.slice(0, 300),
    action: "Ignored as untrusted solicitation content; it did not change the analysis rules.",
  }));
}

function nextActions(compliance, dates, profile) {
  const unknown = compliance.filter((item) => item.status === "UNKNOWN");
  const failed = compliance.filter((item) => item.status === "FAIL");
  const deadline = dates.filter((item) => item.kind === "deadline").sort((a, b) => (a.days_remaining ?? 99_999) - (b.days_remaining ?? 99_999))[0];
  const actions = [];
  if (failed.length) actions.push(`Confirm whether ${failed[0].id} can be cured, waived, or satisfied through an expressly permitted partner; otherwise stop bid spend.`);
  for (const item of unknown.slice(0, 3)) actions.push(`Resolve ${item.id}: ${item.evidence_needed}`);
  if (deadline) actions.push(`Human-verify the ${deadline.raw} deadline, time zone, submission portal, and every later amendment.`);
  if (!asStrings(profile.past_performance).length) actions.push("Add only documented, relevant past-performance evidence; do not invent project claims.");
  actions.push("Assign an owner and response location to every mandatory compliance-matrix row.");
  return uniq(actions).slice(0, 5);
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Input must be a JSON object.");
  const text = String(input.solicitation_text ?? "").trim();
  if (!text) throw new TypeError("solicitation_text is required.");
  if (text.length > MAX_TEXT_LENGTH) throw new RangeError(`solicitation_text exceeds ${MAX_TEXT_LENGTH} characters.`);
  const profile = input.company_profile && typeof input.company_profile === "object" && !Array.isArray(input.company_profile)
    ? input.company_profile
    : {};
  const rawDate = input.as_of_date ? new Date(`${input.as_of_date}T00:00:00Z`) : new Date();
  if (!Number.isFinite(rawDate.getTime())) throw new TypeError("as_of_date must be an ISO date such as 2026-08-30.");
  return { text, profile, asOf: rawDate };
}

export function analyzeRfp(input) {
  const { text, profile, asOf } = validateInput(input);
  const records = lineRecords(text);
  const requirements = requirementRecords(text);
  const dates = dateFindings(records, asOf);
  const inventory = evidenceInventory(profile);
  const compliance = buildCompliance(requirements, profile, inventory, asOf);
  const opportunity = snapshot(text, dates);
  const factors = factorScores(text, profile, compliance, dates, opportunity.stated_amounts);
  const decision = decide(factors, compliance);
  const gaps = compliance.filter((item) => item.status === "UNKNOWN").map((item) => ({
    requirement_id: item.id,
    category: item.category,
    needed: item.evidence_needed,
    source: item.source,
  }));

  return {
    decision,
    knockouts: compliance.filter((item) => item.requirement_type === "mandatory"),
    weighted_score: factors,
    opportunity_snapshot: opportunity,
    compliance_matrix: compliance,
    evidence_gaps: gaps,
    next_actions: nextActions(compliance, dates, profile),
    security_flags: securityFlags(records),
    meta: {
      engine: "BidLens Core deterministic v1.0.0",
      as_of_date_utc: asOf.toISOString(),
      source_type: "user-supplied text",
      source_lines: records.length,
      requirements_found: requirements.length,
      external_ai_calls: 0,
      retention: "This service is stateless and does not intentionally persist input text.",
    },
  };
}

export function extractComplianceMatrix(input) {
  const result = analyzeRfp(input);
  return {
    compliance_matrix: result.compliance_matrix,
    evidence_gaps: result.evidence_gaps,
    security_flags: result.security_flags,
    meta: result.meta,
  };
}

export { MAX_TEXT_LENGTH };
