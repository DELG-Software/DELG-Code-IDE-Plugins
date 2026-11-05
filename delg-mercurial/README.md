# DELG Mercurial

This first-party plugin activates for repositories containing `.hg/requires`
and adds read-only Mercurial working-copy changes to the
Source Control view. It groups modified, added, removed, and untracked files.
Select a path or use its **Open** action to navigate to that file in the
editor. Use the provider refresh button to run `hg status -0` again.

## Requirements

Install Mercurial and make sure `hg` is available on PATH. The IDE starts it
as a managed task in the active workspace. The first status refresh may ask
you to allow managed tasks for the plugin. The plugin only runs `hg status -0`.

If Mercurial is missing, the permission is denied, or the command fails, the
provider shows the reason and remains available so you can retry after fixing
the environment.

The plugin requires an IDE build that implements `delg.sourceControl.createProvider`
and the native `hg` managed-task kind. It also provides the `plugin-services`
capability for integrations that need a compact status summary.

## Plugin service

The namespaced service `delg.mercurial.changes` uses contract version `1`.
Consumers must declare `delg.mercurial` in `dependencies` or
`optionalDependencies` and use `delg.services.call('delg.mercurial.changes', 1,
{})`. The response is `{ contract, version, counts }`, where `counts` has
`modified`, `added`, `removed`, `untracked`, and `total` integer fields. It
contains no file paths and reflects the latest groups published by this plugin.
