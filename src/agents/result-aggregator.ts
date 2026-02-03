/**
 * Result Aggregator
 *
 * Parses and aggregates results from sub-agent sessions.
 * Provides structured extraction of findings, recommendations, and status.
 */

/**
 * Parsed result from a sub-agent execution
 */
export interface SubagentResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Task completion status */
  status: "complete" | "partial" | "failed" | "timeout";
  /** Main findings or output */
  findings: string[];
  /** Actionable recommendations */
  recommendations: string[];
  /** Any errors or issues encountered */
  errors: string[];
  /** Raw response text */
  rawResponse: string;
  /** Extracted data (key-value pairs) */
  extractedData: Record<string, unknown>;
  /** Confidence level (0-1) if determinable */
  confidence?: number;
}

/**
 * Patterns for extracting structured information from responses
 */
const EXTRACTION_PATTERNS = {
  findings: [
    /(?:findings?|results?|discovered?|found):\s*(.+?)(?=\n\n|\n(?:recommendations?|errors?|$))/gis,
    /^[-•*]\s*(.+)$/gm,
  ],
  recommendations: [
    /(?:recommendations?|suggestions?|next\s*steps?|action\s*items?):\s*(.+?)(?=\n\n|\n(?:findings?|errors?|$))/gis,
    /(?:should|recommend|suggest|consider)\s+(.+?)(?:\.|$)/gi,
  ],
  errors: [
    /(?:errors?|issues?|problems?|failed):\s*(.+?)(?=\n\n|$)/gis,
    /(?:error|failed|couldn't|unable to)\s*:?\s*(.+?)(?:\.|$)/gi,
  ],
  keyValue: [/(\w+(?:\s+\w+)?)\s*:\s*([^\n]+)/g],
};

/**
 * Parse a sub-agent's response into structured result
 */
export function parseSubagentResult(response: string): SubagentResult {
  const result: SubagentResult = {
    success: true,
    status: "complete",
    findings: [],
    recommendations: [],
    errors: [],
    rawResponse: response,
    extractedData: {},
  };

  // Check for failure indicators
  const failureIndicators = [
    /failed/i,
    /error occurred/i,
    /couldn't complete/i,
    /unable to/i,
    /timed out/i,
  ];

  for (const indicator of failureIndicators) {
    if (indicator.test(response)) {
      result.success = false;
      if (/timed? out/i.test(response)) {
        result.status = "timeout";
      } else {
        result.status = "failed";
      }
      break;
    }
  }

  // Check for partial completion
  if (/partial|incomplete|some results/i.test(response)) {
    result.status = "partial";
  }

  // Extract findings
  result.findings = extractSection(response, EXTRACTION_PATTERNS.findings);

  // Extract recommendations
  result.recommendations = extractSection(response, EXTRACTION_PATTERNS.recommendations);

  // Extract errors
  result.errors = extractSection(response, EXTRACTION_PATTERNS.errors);

  // Extract key-value data
  result.extractedData = extractKeyValuePairs(response);

  // If no findings extracted but response exists, use first paragraph
  if (result.findings.length === 0 && response.trim().length > 0) {
    const firstParagraph = response.split(/\n\n/)[0]?.trim();
    if (firstParagraph && firstParagraph.length > 20) {
      result.findings.push(firstParagraph);
    }
  }

  return result;
}

/**
 * Extract sections matching patterns
 */
function extractSection(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 5 && !results.includes(extracted)) {
        results.push(extracted);
      }
    }
  }

  return results;
}

/**
 * Extract key-value pairs from response
 */
function extractKeyValuePairs(text: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const pattern = /(\w+(?:\s+\w+)?)\s*:\s*([^\n]+)/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1]?.trim().toLowerCase().replace(/\s+/g, "_");
    const value = match[2]?.trim();

    if (key && value) {
      // Try to parse as number or boolean
      if (/^\d+$/.test(value)) {
        data[key] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        data[key] = parseFloat(value);
      } else if (/^(true|false)$/i.test(value)) {
        data[key] = value.toLowerCase() === "true";
      } else {
        data[key] = value;
      }
    }
  }

  return data;
}

/**
 * Aggregate multiple sub-agent results into a summary
 */
export interface AggregatedResults {
  /** Total number of results */
  total: number;
  /** Number of successful results */
  successful: number;
  /** Number of failed results */
  failed: number;
  /** All findings combined */
  allFindings: string[];
  /** All recommendations combined */
  allRecommendations: string[];
  /** All errors combined */
  allErrors: string[];
  /** Combined extracted data */
  combinedData: Record<string, unknown>;
  /** Overall success rate */
  successRate: number;
}

/**
 * Aggregate multiple sub-agent results
 */
export function aggregateResults(results: SubagentResult[]): AggregatedResults {
  const successful = results.filter((r) => r.success).length;

  return {
    total: results.length,
    successful,
    failed: results.length - successful,
    allFindings: results.flatMap((r) => r.findings),
    allRecommendations: results.flatMap((r) => r.recommendations),
    allErrors: results.flatMap((r) => r.errors),
    combinedData: results.reduce((acc, r) => ({ ...acc, ...r.extractedData }), {}),
    successRate: results.length > 0 ? successful / results.length : 0,
  };
}

/**
 * Format aggregated results for display
 */
export function formatAggregatedResults(results: AggregatedResults): string {
  const lines: string[] = [];

  lines.push(`## Sub-Agent Results Summary`);
  lines.push(`- Total: ${results.total}`);
  lines.push(`- Successful: ${results.successful}`);
  lines.push(`- Failed: ${results.failed}`);
  lines.push(`- Success Rate: ${Math.round(results.successRate * 100)}%`);

  if (results.allFindings.length > 0) {
    lines.push(`\n### Findings`);
    results.allFindings.forEach((f) => lines.push(`- ${f}`));
  }

  if (results.allRecommendations.length > 0) {
    lines.push(`\n### Recommendations`);
    results.allRecommendations.forEach((r) => lines.push(`- ${r}`));
  }

  if (results.allErrors.length > 0) {
    lines.push(`\n### Errors`);
    results.allErrors.forEach((e) => lines.push(`- ${e}`));
  }

  return lines.join("\n");
}
