export default function activate(delg) {
  delg.ui.setStatus('Python language support is ready. The interpreter follows the configured path or the project virtual environment.')
  return () => delg.ui.setStatus('')
}
