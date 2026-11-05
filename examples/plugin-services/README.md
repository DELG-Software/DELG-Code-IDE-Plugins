# Plugin service fixtures

`mercurial-consumer` depends on the first-party `delg.mercurial` plugin and calls its `delg.mercurial.changes` version 1 service. The response includes counts only, with no resource paths. The integration test activates both plugins against the same service registry and runs Mercurial against a temporary repository.
