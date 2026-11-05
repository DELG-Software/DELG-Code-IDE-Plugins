import assert from 'node:assert/strict'
import test from 'node:test'
import { fakeIde } from './fake-ide.mjs'

test('fake IDE services enforce capability and exact contract version', async () => {
  const services = new Map()
  const provider = fakeIde({}, { manifest: { capabilities: ['plugin-services'] }, services })
  const consumer = fakeIde({}, { manifest: { capabilities: ['plugin-services'] }, services })
  const registration = await provider.delg.services.register('acme.core.echo', 1, async ({ message }, { signal }) => {
    assert.equal(signal.aborted, false)
    return { echoed: message }
  })

  assert.deepEqual(await consumer.delg.services.call('acme.core.echo', 1, { message: 'hello' }), { echoed: 'hello' })
  await assert.rejects(consumer.delg.services.call('acme.core.echo', 2, null), /requires contract version 1/)

  const untrusted = fakeIde({}, { manifest: { capabilities: [] }, services })
  await assert.rejects(untrusted.delg.services.call('acme.core.echo', 1, null), /plugin-services capability is required/)
  registration.dispose()
  await assert.rejects(consumer.delg.services.call('acme.core.echo', 1, null), /not registered/)
})
