export interface CheckResult {
  group: string;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Small assertion harness: collects every check instead of stopping at the
 * first failure, so one run reports the whole contract surface.
 */
export class Checker {
  readonly results: CheckResult[] = [];
  private group = "general";

  section(group: string): void {
    this.group = group;
    console.log(`\n[${group}]`);
  }

  pass(label: string, detail = ""): void {
    this.results.push({ group: this.group, label, ok: true, detail });
    console.log(`  PASS ${label}${detail ? `: ${detail}` : ""}`);
  }

  fail(label: string, detail = ""): void {
    this.results.push({ group: this.group, label, ok: false, detail });
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }

  check(label: string, ok: boolean, detail = ""): boolean {
    if (ok) this.pass(label, detail);
    else this.fail(label, detail);
    return ok;
  }

  equal(
    label: string,
    actual: bigint | number | string | boolean | null | undefined,
    expected: bigint | number | string | boolean | null | undefined,
  ): boolean {
    const ok = String(actual) === String(expected);
    return this.check(
      label,
      ok,
      ok ? String(actual) : `expected ${String(expected)}, got ${String(actual)}`,
    );
  }

  async expectRevert(
    label: string,
    action: () => Promise<unknown>,
    expectedError?: string,
  ): Promise<boolean> {
    try {
      await action();
      this.fail(label, "transaction/read succeeded but should have reverted");
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const matched = !expectedError || message.includes(expectedError);
      return this.check(
        label,
        matched,
        matched
          ? `reverted${expectedError ? ` with ${expectedError}` : ""}`
          : `expected ${expectedError}; got ${message.split("\n")[0]}`,
      );
    }
  }

  get failures(): number {
    return this.results.filter((result) => !result.ok).length;
  }

  summary(): string {
    const passed = this.results.length - this.failures;
    return `${passed}/${this.results.length} checks passed`;
  }
}
