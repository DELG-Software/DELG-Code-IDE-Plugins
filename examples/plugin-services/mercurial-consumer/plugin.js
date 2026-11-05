export default async function activate(delg) {
  return delg.services.call('delg.mercurial.changes', 1, {})
}
