export default function activate(delg) {
  delg.ui.setStatus('Go language support is ready when gopls is installed in your Go toolchain.')
  return () => delg.ui.setStatus('')
}
