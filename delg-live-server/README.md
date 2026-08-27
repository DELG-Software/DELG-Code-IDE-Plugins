# DELG Live Server

DELG Live Server serves the current workspace through an IDE-managed loopback
server and refreshes the system browser after HTML, CSS, JavaScript, or asset
files change. It runs entirely through the sandboxed schema-v2 plugin API: it
does not spawn a process, open a shell, or read files directly.

Use **Live Server: Open in Browser** from an HTML editor or the command palette.
The port is selected automatically and the server is stopped when the plugin,
workspace, or IDE closes.
