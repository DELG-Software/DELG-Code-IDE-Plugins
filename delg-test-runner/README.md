# DELG Test Runner

DELG Test Runner finds project-level test targets and runs them through the
IDE's managed-task service. It contributes aggregate results to the testing
panel; it does not discover or report individual test cases.

## Requirements

- An IDE engine build that includes the `testing-controller` API. The feature
  is unreleased, so an IDE version number of 0.39.0 by itself does not guarantee
  that this API is present. Older builds show setup guidance and leave the
  plugin inactive.
- The matching engine build must expose the `testing` controller API and
  `managed-tasks` capability.
- Each project needs its corresponding test tool available in the managed task
  environment: npm for package scripts, Go for `go.mod` projects, and pytest
  for `pytest.ini` or `pyproject.toml` projects.

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
- The Test Runner panel's Run and Run All requests execute targets
  sequentially. Output streams to the panel;
  each project reports one aggregate pass, failure, cancellation, or error.
- Use **Test Runner: Refresh Projects** after adding or removing a test project.
  **Test Runner: Cancel Test Run** stops the current managed task and skips the
  remaining targets in that run.

Managed tasks run from the open workspace root with the IDE's task limits and
minimal environment. The plugin does not install test tools or change project
files.

## Development

Run `npm test` for the unit suite. `npm run build` validates the manifest and
entry point after running the suite; it does not create a plugin archive.
Before publishing, update `source.commit` to the exact commit containing this
plugin. Publishing also requires the testing-controller engine build and normal
publisher signing/certification.
