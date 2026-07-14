# DELG Web Forge

A practical web-development toolkit for DELG Code IDE. Type `!` in HTML for an automatic document suggestion, or type any named shortcut below and press `Ctrl+Space`.

Open the **Web Forge** sidebar for an in-IDE snippet guide, or run **Web Forge: Show Snippet Guide** from the command palette. The guide command is also available from the editor context menu and with `Ctrl+Alt+W` (`Cmd+Alt+W` on macOS).

Set `delg.web-forge.completions.enabled` in plugin settings to enable or disable all Web Forge completion suggestions. The default is enabled.

## HTML and Vue templates

- `!`, `html:5`, `link:css`, `script:src`, `meta:vp`
- `div.card`, `main#app`, `.container`
- `ul>li*3`, `header+main+footer`
- `picture`, `details`, `form:get`, `form:post`

## CSS, SCSS, and Less

- Layout: `df`, `dg`, `center`, `gridauto`
- Positioning: `posa`, `posr`, `posf`
- Sizing and spacing: `m`, `mx`, `p`, `w100`, `h100`, `minfull`
- Styling: `c`, `bgc`, `fz`, `fw`, `br`, `shadow`, `transition`, `truncate`
- Structures: `media`, `keyframes`, `vars`

## JavaScript and TypeScript

- Logging/imports: `clg`, `cle`, `imp`, `imd`, `exp`
- Functions/control flow: `fn`, `afn`, `trycatch`, `forof`
- Data/network: `fetch`, `map`, `filter`, `reduce`, `promise`, `debounce`
- TypeScript: `interface`, `type`, `enum`, `guard`, `generic`

## React (`.jsx` and `.tsx`)

- Components: `rfc`, `rafc`
- Hooks: `usestate`, `useeffect`, `usememo`, `usecallback`

## Vue (`.vue`)

- Component: `vbase`
- Composition API: `vref`, `vcomputed`, `vwatch`, `vonmounted`
- Component contracts: `vdefineprops`, `vdefineemits`

## Local development

1. Build and run the IDE.
2. Open **Developer Plugins: Manage Local Plugins** from the command palette.
3. Enable Developer Mode.
4. Link the `delg-web-forge` folder from this repository.

## Build

Run `node delg-web-forge/build.mjs` from the repository root to create the
versioned `.delg-plugin` package.

The completion-provider API requires Full Host certification for signed marketplace releases. This package uses the official DELG publisher profile and declares its Full Host requirement in `manifest.json`.
