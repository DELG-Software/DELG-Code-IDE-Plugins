export default function activate(delg) {
  delg.ui.setStatus('Vue / TypeScript language support is ready. The server starts when a project file is opened.')
  return () => delg.ui.setStatus('')
}
