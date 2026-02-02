import { describe, expect, it } from "vitest";
import {
  formatResultForAnnounce,
  getResultFormatInstructions,
  inferResultFromFreeform,
  parseSubagentResult,
  RESULT_MARKERS,
  type SubagentResult,
} from "./subagent-result.js";

describe("parseSubagentResult", () => {
  it("returns null for empty input", () => {
    expect(parseSubagentResult("")).toBeNull();
  });

  it("returns null when no markers present", () => {
    const output = "This is just plain text with no markers.";
    expect(parseSubagentResult(output)).toBeNull();
  });

  it("returns null when only start marker present", () => {
    const output = `${RESULT_MARKERS.start}\nSome content`;
    expect(parseSubagentResult(output)).toBeNull();
  });

  it("returns null when only end marker present", () => {
    const output = `Some content\n${RESULT_MARKERS.end}`;
    expect(parseSubagentResult(output)).toBeNull();
  });

  it("returns null when end marker comes before start marker", () => {
    const output = `${RESULT_MARKERS.end}\ncontent\n${RESULT_MARKERS.start}`;
    expect(parseSubagentResult(output)).toBeNull();
  });

  it("extracts result from marked output", () => {
    const output = `Some preamble text
${RESULT_MARKERS.start}
Task completed successfully.
Here are the findings.
${RESULT_MARKERS.end}
Some trailing text`;

    const result = parseSubagentResult(output);
    expect(result).not.toBeNull();
    expect(result?.status).toBe("complete");
    expect(result?.summary).toBe("Task completed successfully.");
  });

  it("parses structured sections correctly", () => {
    const output = `${RESULT_MARKERS.start}
Analysis complete.

${RESULT_MARKERS.sectionStart("summary")}
This is the summary content.
${RESULT_MARKERS.sectionEnd("summary")}

${RESULT_MARKERS.sectionStart("findings")}
Found 3 issues in the code.
${RESULT_MARKERS.sectionEnd("findings")}
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result).not.toBeNull();
    expect(result?.sections).toBeDefined();
    expect(result?.sections?.summary).toBe("This is the summary content.");
    expect(result?.sections?.findings).toBe("Found 3 issues in the code.");
  });

  it("handles malformed section markers gracefully", () => {
    const output = `${RESULT_MARKERS.start}
Some content with incomplete markers.
<!-- SECTION:broken
Not closed properly
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result).not.toBeNull();
    expect(result?.sections).toBeUndefined();
    expect(result?.summary).toBe("Some content with incomplete markers.");
  });

  it("extracts filesModified from files_modified section", () => {
    const output = `${RESULT_MARKERS.start}
Updated configuration files.

${RESULT_MARKERS.sectionStart("files_modified")}
- src/config.ts
- src/utils.ts
- package.json
${RESULT_MARKERS.sectionEnd("files_modified")}
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result).not.toBeNull();
    expect(result?.filesModified).toContain("src/config.ts");
    expect(result?.filesModified).toContain("src/utils.ts");
    expect(result?.filesModified).toContain("package.json");
  });

  it("detects error status from content", () => {
    const output = `${RESULT_MARKERS.start}
Error: Failed to compile module.
The build process encountered an issue.
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result?.status).toBe("error");
    expect(result?.error?.message).toBe("Failed to compile module.");
  });

  it("detects timeout status from content", () => {
    const output = `${RESULT_MARKERS.start}
Operation timed out while waiting for response.
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result?.status).toBe("timeout");
  });

  it("detects partial status from content", () => {
    const output = `${RESULT_MARKERS.start}
Partial results available - incomplete data.
${RESULT_MARKERS.end}`;

    const result = parseSubagentResult(output);
    expect(result?.status).toBe("partial");
  });

  it("returns null for empty content between markers", () => {
    const output = `${RESULT_MARKERS.start}

${RESULT_MARKERS.end}`;

    expect(parseSubagentResult(output)).toBeNull();
  });
});

describe("inferResultFromFreeform", () => {
  it("returns complete status for empty input", () => {
    const result = inferResultFromFreeform("");
    expect(result.status).toBe("complete");
    expect(result.summary).toBe("Task completed (no output)");
  });

  it("returns complete status for whitespace-only input", () => {
    const result = inferResultFromFreeform("   \n\n  ");
    expect(result.status).toBe("complete");
    expect(result.summary).toBe("Task completed (no output)");
  });

  it("creates result from plain text", () => {
    const output = "Successfully processed all files.";
    const result = inferResultFromFreeform(output);

    expect(result.status).toBe("complete");
    expect(result.summary).toBe("Successfully processed all files.");
  });

  it("infers summary from first paragraph", () => {
    const output = `First paragraph is the summary.

Second paragraph contains more details about what was done.

Third paragraph with additional info.`;

    const result = inferResultFromFreeform(output);
    expect(result.summary).toBe("First paragraph is the summary.");
    expect(result.findings).toContain("Second paragraph");
    expect(result.findings).toContain("Third paragraph");
  });

  it("truncates long summaries", () => {
    const longLine = "A".repeat(300);
    const result = inferResultFromFreeform(longLine);
    expect(result.summary.length).toBeLessThanOrEqual(200);
  });

  it("detects error patterns", () => {
    const output = "Error: Connection refused\nCould not reach the server.";
    const result = inferResultFromFreeform(output);

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("Connection refused");
  });

  it("detects timeout patterns", () => {
    const output = "The operation timed out after 30 seconds.";
    const result = inferResultFromFreeform(output);

    expect(result.status).toBe("timeout");
  });

  it("detects partial completion patterns", () => {
    const output = "Partially completed - only 50% of files were processed.";
    const result = inferResultFromFreeform(output);

    expect(result.status).toBe("partial");
  });

  it("extracts file paths from text", () => {
    const output = `Modified the following files:
src/main.ts
src/utils/helper.ts
package.json`;

    const result = inferResultFromFreeform(output);
    expect(result.filesModified).toContain("src/main.ts");
    expect(result.filesModified).toContain("package.json");
  });

  it("always returns valid SubagentResult", () => {
    const inputs = ["", "   ", "simple text", "Error: something", "timed out"];

    for (const input of inputs) {
      const result = inferResultFromFreeform(input);
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.summary).toBeDefined();
    }
  });

  it("marks error as recoverable when retry mentioned", () => {
    const output = "Error: Connection failed. Please retry.";
    const result = inferResultFromFreeform(output);

    expect(result.error?.recoverable).toBe(true);
  });
});

describe("formatResultForAnnounce", () => {
  it("includes status and summary", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Task finished successfully.",
    };

    const output = formatResultForAnnounce(result);
    expect(output).toContain("[Complete]");
    expect(output).toContain("Task finished successfully.");
  });

  it("formats different statuses correctly", () => {
    const statuses: SubagentResult["status"][] = ["complete", "partial", "error", "timeout"];
    const expected = ["[Complete]", "[Partial]", "[Error]", "[Timeout]"];

    for (let i = 0; i < statuses.length; i++) {
      const result: SubagentResult = {
        status: statuses[i],
        summary: "Test",
      };
      const output = formatResultForAnnounce(result);
      expect(output).toContain(expected[i]);
    }
  });

  it("includes findings when present", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Analysis done.",
      findings: "Found 3 potential improvements in the codebase.",
    };

    const output = formatResultForAnnounce(result);
    expect(output).toContain("Found 3 potential improvements");
  });

  it("handles missing optional fields gracefully", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Minimal result.",
    };

    const output = formatResultForAnnounce(result);
    expect(output).not.toContain("Files modified");
    expect(output).not.toContain("Error:");
  });

  it("includes files modified when present", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Updated files.",
      filesModified: ["src/a.ts", "src/b.ts"],
    };

    const output = formatResultForAnnounce(result);
    expect(output).toContain("Files modified:");
    expect(output).toContain("src/a.ts");
    expect(output).toContain("src/b.ts");
  });

  it("includes error message when present", () => {
    const result: SubagentResult = {
      status: "error",
      summary: "Failed to complete.",
      error: {
        message: "Network connection lost",
        recoverable: true,
      },
    };

    const output = formatResultForAnnounce(result);
    expect(output).toContain("Error: Network connection lost");
    expect(output).toContain("(recoverable)");
  });

  it("includes important sections", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Review complete.",
      sections: {
        conclusions: "The code is well-structured.",
        recommendations: "Consider adding more tests.",
        other_section: "This should not appear prominently.",
      },
    };

    const output = formatResultForAnnounce(result);
    expect(output).toContain("### conclusions");
    expect(output).toContain("The code is well-structured.");
    expect(output).toContain("### recommendations");
    expect(output).toContain("Consider adding more tests.");
  });

  it("keeps output concise without metadata", () => {
    const result: SubagentResult = {
      status: "complete",
      summary: "Done.",
      metadata: {
        durationMs: 5000,
        tokenCount: 1500,
        sessionKey: "test-session",
      },
    };

    const output = formatResultForAnnounce(result);
    // Metadata should NOT appear in announce output
    expect(output).not.toContain("5000");
    expect(output).not.toContain("1500");
    expect(output).not.toContain("test-session");
  });
});

describe("getResultFormatInstructions", () => {
  it("includes marker syntax", () => {
    const instructions = getResultFormatInstructions();

    expect(instructions).toContain(RESULT_MARKERS.start);
    expect(instructions).toContain(RESULT_MARKERS.end);
  });

  it("lists required sections when provided", () => {
    const instructions = getResultFormatInstructions(["summary", "findings", "sources"]);

    expect(instructions).toContain("<!-- SECTION:summary -->");
    expect(instructions).toContain("<!-- /SECTION:summary -->");
    expect(instructions).toContain("<!-- SECTION:findings -->");
    expect(instructions).toContain("<!-- SECTION:sources -->");
  });

  it("provides generic instructions without required sections", () => {
    const instructions = getResultFormatInstructions();

    expect(instructions).toContain("Your summary line here");
    expect(instructions).toContain("Your detailed findings here");
  });

  it("is readable and clear", () => {
    const instructions = getResultFormatInstructions(["analysis"]);

    expect(instructions).toContain("Structured Output Format");
    expect(instructions).toContain("programmatically parsed");
    expect(instructions).toContain("```");
  });

  it("handles empty required sections array", () => {
    const instructions = getResultFormatInstructions([]);

    expect(instructions).toContain(RESULT_MARKERS.start);
    expect(instructions).toContain("Your detailed findings here");
  });
});

describe("integration: round-trip parsing", () => {
  it("creates formatted output that can be parsed back", () => {
    // Simulate subagent creating output with markers
    const subagentOutput = `${RESULT_MARKERS.start}
Research completed on API design patterns.

${RESULT_MARKERS.sectionStart("summary")}
Analyzed 5 different API design approaches.
${RESULT_MARKERS.sectionEnd("summary")}

${RESULT_MARKERS.sectionStart("findings")}
REST remains the most common pattern.
GraphQL is gaining adoption for complex queries.
${RESULT_MARKERS.sectionEnd("findings")}

${RESULT_MARKERS.sectionStart("sources")}
- https://example.com/api-guide
- Internal documentation
${RESULT_MARKERS.sectionEnd("sources")}
${RESULT_MARKERS.end}`;

    // Parse the output
    const parsed = parseSubagentResult(subagentOutput);
    expect(parsed).not.toBeNull();

    // Verify fields
    expect(parsed?.status).toBe("complete");
    expect(parsed?.summary).toBe("Research completed on API design patterns.");
    expect(parsed?.sections?.summary).toContain("Analyzed 5 different");
    expect(parsed?.sections?.findings).toContain("REST remains");
    expect(parsed?.sections?.sources).toContain("example.com");

    // Format for announce
    const announced = formatResultForAnnounce(parsed!);
    expect(announced).toContain("[Complete]");
    expect(announced).toContain("Research completed");
  });

  it("matches delegation brief sections to result sections", () => {
    // Delegation brief specifies these required sections
    const requiredSections = ["analysis", "conclusions", "recommendations"];

    // Generate instructions
    const instructions = getResultFormatInstructions(requiredSections);
    expect(instructions).toContain("SECTION:analysis");
    expect(instructions).toContain("SECTION:conclusions");
    expect(instructions).toContain("SECTION:recommendations");

    // Subagent follows instructions
    const output = `${RESULT_MARKERS.start}
Code analysis complete.

${RESULT_MARKERS.sectionStart("analysis")}
The codebase follows clean architecture.
${RESULT_MARKERS.sectionEnd("analysis")}

${RESULT_MARKERS.sectionStart("conclusions")}
Overall code quality is high.
${RESULT_MARKERS.sectionEnd("conclusions")}

${RESULT_MARKERS.sectionStart("recommendations")}
Add more integration tests.
${RESULT_MARKERS.sectionEnd("recommendations")}
${RESULT_MARKERS.end}`;

    // Parse and verify all sections are captured
    const parsed = parseSubagentResult(output);
    expect(parsed?.sections).toBeDefined();
    expect(Object.keys(parsed?.sections ?? {})).toEqual(expect.arrayContaining(requiredSections));
  });

  it("fallback inference produces usable results", () => {
    // No markers - freeform output
    const freeformOutput = `I completed the file operations.

Modified src/config.ts to add new settings.
Also updated package.json with new dependency.

All changes are backward compatible.`;

    // parseSubagentResult returns null (no markers)
    expect(parseSubagentResult(freeformOutput)).toBeNull();

    // inferResultFromFreeform handles it
    const inferred = inferResultFromFreeform(freeformOutput);
    expect(inferred.status).toBe("complete");
    expect(inferred.summary).toBe("I completed the file operations.");
    expect(inferred.findings).toContain("Modified src/config.ts");
    expect(inferred.filesModified).toContain("src/config.ts");
    expect(inferred.filesModified).toContain("package.json");

    // Can be formatted for announce
    const announced = formatResultForAnnounce(inferred);
    expect(announced).toContain("[Complete]");
    expect(announced).toContain("file operations");
  });
});

describe("RESULT_MARKERS", () => {
  it("has consistent start/end markers", () => {
    expect(RESULT_MARKERS.start).toContain("SUBAGENT_RESULT_START");
    expect(RESULT_MARKERS.end).toContain("SUBAGENT_RESULT_END");
  });

  it("section markers are functions", () => {
    expect(typeof RESULT_MARKERS.sectionStart).toBe("function");
    expect(typeof RESULT_MARKERS.sectionEnd).toBe("function");
  });

  it("section markers generate matching pairs", () => {
    const sectionName = "test_section";
    const start = RESULT_MARKERS.sectionStart(sectionName);
    const end = RESULT_MARKERS.sectionEnd(sectionName);

    expect(start).toContain(sectionName);
    expect(end).toContain(sectionName);
    expect(start).not.toBe(end);
  });
});
