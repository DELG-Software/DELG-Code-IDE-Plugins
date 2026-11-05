# DELG Test Runner

Discover individual Vitest, pytest and Go tests, run selected cases, and inspect
each result, duration and failure output in the IDE's Testing panel.

## Requirements

- An IDE engine build that includes the `testing-controller` API. The feature
  is unreleased, so an IDE version number of 0.39.0 by itself does not guarantee
  that this API is present. Older builds show setup guidance and leave the
  plugin inactive.
- The matching engine build must expose the `testing` controller API and
  `managed-tasks` capability, including the native `node` task kind for Vitest.
- Each project needs its corresponding tool in the managed task environment:
  Node and project-local Vitest 3/4, Go, or Python with pytest importable.
  Generic npm script targets also require npm.
  Multi-select requires the updated Testing panel; compatible older panels
  can still run one case or all cases.

## Discovery and execution

- `package.json` with a non-empty `scripts.test` entry becomes an `npm test`
  target. Nested packages use `npm --prefix <folder> test`.
- Each `go.mod` becomes a `go test ./...` target. Nested modules use `go -C
  <folder> test ./...` and need Go 1.20 or newer.
- Each directory with `pytest.ini` or `pyproject.toml` becomes a `pytest`
  target. When both markers exist in one directory, the runner creates one
  target and points to `pytest.ini`.
- Discovery skips generated and dependency folders such as `node_modules`,
  `.git`, `vendor`, and virtual environments, and is bounded by depth and
  directory count.
- Initial activation lists project targets without starting test tools.
  Use **Test Runner: Refresh Tests** to collect individual cases.
- Vitest uses JSON collection and results with escaped full-name selectors;
  pytest uses a built-in reporting hook for node IDs, parameter cases, source
  lines and setup/call/teardown outcomes. Go lists top-level tests/examples and
  reads JSON outcomes; dynamic subtests run with their parent.
- Use **Run** beside a case, check several and choose **Run selected**, or
  choose **Run all**. Cases execute sequentially in separate processes.
  Each reports its own result, duration and failure output. Click its label
  to reveal its source and **Show output** to inspect the full captured log.
- Unsupported npm scripts or failed collection keep a project-level target
  with an explanation in output. Missing reports never imply a case passed.
  Nested pytest/Vitest collections deduplicate cases, preferring the closest
  project configuration. Duplicate full Vitest names within one file fall back
  to a project target; static skipped tests omitted by Vitest list are absent.
- **Test Runner: Cancel Test Run** stops an active discovery task or test run.
  Discovery cancellation preserves the prior list; run cancellation skips
  queued cases. The panel's **Cancel** button stops active test runs.
- Each collection task has a two-minute timeout. Discovery publishes at most
  10,000 targets and retains the engine's argument/output limits; exceptionally
  long selectors can exceed the managed task argument limit and report errors.

Managed tasks run from the open workspace root with the IDE's task limits and
minimal environment. The plugin does not install test tools or change project
files. Vitest runs its installed CLI directly through Node, without a command
shell, package downloads or installation. Hoisted parent node_modules are
supported. Discovery loads test
modules and project configuration through the framework's collection command.

## Development

Run `npm test` for the unit suite. `npm run test:integration` exercises real Go,
pytest and Vitest samples, including failures, skips, parameter IDs, literal
name filters and controller dispatch. Set `DELG_TEST_PYTHON` to a Python
executable with pytest, and `DELG_TEST_VITEST_MODULES` to a node_modules directory
containing Vitest. The default Vitest lookup uses the sibling IDE checkout;
missing optional tools skip their integration cases.

`npm run build` validates the manifest and
entry point after running the suite; it does not create a plugin archive.
Before publishing, update `source.commit` to the exact commit containing this
plugin. Publishing also requires the testing-controller engine build and normal
publisher signing/certification.
