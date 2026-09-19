# Verification Procedure for Coding Agents

Use this procedure before declaring a software change complete. The goal is to establish the requested behavior with reproducible evidence, not merely to obtain a green test run.

## 1. Turn the request into observable claims

Read the change request and relevant project instructions. Write down the smallest set of externally observable behaviors that must be true. Separate required behavior from explicitly out-of-scope behavior. Do not substitute the existing tests for the request; tests are evidence, not the specification.

For each required behavior, identify at least one direct observation that would prove or disprove it: a focused test, a small invocation, a CLI command, an HTTP request, or another deterministic probe.

## 2. Inspect implementation and tests for coverage gaps

Locate the changed implementation and the tests that appear to cover it. Map each required behavior to the code path and to the assertion that is supposed to verify it.

Treat these as warning signs:

- a requirement has no assertion;
- the test input cannot distinguish correct from partially correct behavior;
- mocks bypass the changed logic;
- assertions check only that execution completed rather than what it returned;
- a failing fixture encodes behavior that conflicts with the written request.

Do not call any warning sign a defect until direct evidence establishes one.

## 3. Run the existing targeted checks

Run the narrowest relevant test command first and preserve the exact command and result. If it fails, determine whether the failure proves a product defect, an environment problem, or an invalid/stale fixture. A red test is not automatically an implementation defect, and a green test is not proof that all requested behavior exists.

Broader tests should follow only when they are useful for regression confidence.

## 4. Probe every material requirement directly

Exercise inputs that make each requested behavior observable, especially requirements the current tests do not isolate. Compare actual output with the written request.

Prefer tiny probes that are easy to reproduce. If a direct probe contradicts a green test suite, report the missing behavior and explain why the current tests failed to detect it.

If a test contradicts the request while the implementation matches the request, identify the fixture as stale rather than changing correct product behavior to satisfy it.

## 5. Try to falsify the conclusion once

Before declaring success or failure, make one focused attempt to disprove the leading conclusion. For a suspected defect, test a nearby case or inspect the relevant branch. For an apparently correct change, exercise the edge most likely to reveal that the requested behavior is absent.

Stop when the acceptance criteria are established. Do not invent unrelated findings merely because more code can be inspected.

## 6. Report evidence and limits

A completion report should state:

- the requested behaviors checked;
- exact commands or probes and material results;
- confirmed implementation defects, if any;
- invalid/stale tests or environmental blockers, if any;
- what was not verified and why.

Use calibrated language: “verified” only when behavior was directly established; “not established” when evidence is incomplete.

## Public-example demonstration

### email-normalizer

Request: trim surrounding whitespace and lowercase the full address.

Run:

```bash
cd public-examples/email-normalizer
python3 -m unittest -v
python3 - <<'PY'
from email_normalizer import normalize_email
print(normalize_email(" Alice@Example.COM "))
PY
```

The existing test passes, but the direct behavior probe prints `Alice@Example.COM` instead of the required `alice@example.com`. The implementation only calls `.strip()`. This is a real missing-behavior defect, and the green test does not exercise the lowercase requirement.

### retry-budget

Request: make up to `max_attempts` calls, including the final allowed attempt, and return the first truthy result.

Run:

```bash
cd public-examples/retry-budget
python3 -m unittest -v
```

The final-attempt success test passes. The other test fails because it expects only two calls when `max_attempts=3`. The implementation uses `range(max_attempts)`, therefore makes three permitted calls and matches the request. The implementation is clean for the stated behavior; the failing fixture is stale.

## Change from the baseline

The baseline already says to inspect implementation/tests, exercise behavior, distinguish product failures from invalid fixtures, and report evidence. This procedure makes those instructions operational by requiring a requirement-to-assertion map, a direct probe for every material requirement, and one falsification attempt before conclusion. Those steps specifically reduce false confidence from green but incomplete tests and false defect reports from stale fixtures.

## Limitations

The extra probes can be unnecessary for mechanical changes whose behavior is already exhaustively and directly asserted. Large integration systems may require unavailable services, credentials, hardware, or long-running suites; in those cases report the verification boundary instead of simulating certainty. This procedure also does not replace project-specific security, performance, release, or approval checks.

I have the rights to submit this work and permit the requester to use and adapt it internally.
