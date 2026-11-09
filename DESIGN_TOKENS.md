# Design Tokens (frozen — frontend must implement exactly)

Brand: Primary Blue `#6FA8FF`, Primary Purple `#8F7CFF`. Gradient `linear-gradient(135deg, #6FA8FF, #8F7CFF)` used on primary buttons, active nav, header accents, card highlights, overlay headers.

## CSS variables (define in :root and [data-theme="dark"])
Light theme (NOT pure white):
- `--bg`: gradient `linear-gradient(160deg, #EEF3FF 0%, #F3EEFF 55%, #EDEBFF 100%)` on body; surfaces `rgba(255,255,255,0.72)` with backdrop-blur.
- `--surface`: `#FFFFFFB8`; `--surface-2`: `#F1EEFF`; `--border`: `#C9C4F0`; `--text`: `#1E1B3A`; `--text-muted`: `#5B5780`; `--accent-blue`: `#6FA8FF`; `--accent-purple`: `#8F7CFF`; `--code-bg`: `#1E1B3A` (code blocks dark for contrast).

Dark theme (NOT pure black):
- `--bg`: `linear-gradient(160deg, #171838 0%, #1F1A3D 55%, #241B45 100%)`; surfaces `rgba(30,28,60,0.72)`; `--surface-2`: `#2A2550`; `--border`: `#3B3570`; `--text`: `#ECEAFF`; `--text-muted`: `#A7A2D0`; `--code-bg`: `#0F0E24`.

## Layout breakpoints
- Desktop ≥1024px: multi-pane (sidebar nav + content; IDE: explorer left, editor center, output/preview right/bottom).
- Tablet 640–1023px: collapsible drawer nav; IDE: 2 panes with toggle.
- Mobile <640px: bottom tab bar switching between Explorer / Editor / Terminal / Output / Preview in IDE; top nav hamburger. Never just shrink desktop.

## Floating Overlay contract (frontend internal)
- Component `DocOverlay`: draggable by header, resizable (corner handle), pin to any of 4 edges (within 24px → snap; collapsed shows 8px peek strip + expand on hover/click). Multiple overlays supported (z-index stack, click to focus). Full doc content rendered inside (scrollable), not an excerpt. Opening an overlay never unmounts the IDE (store overlays in global app state).

## Application-doc table scroll-lock
- Table wrapper: on pointerdown record start x/y; on first pointermove beyond 6px decide axis (|dx|>|dy| → horizontal else vertical); set `touch-action: none` + lock that axis via `overflow-x/overflow-y` toggling until pointerup. Horizontal scroll never conflicts with overlay drag (overlay drag only starts from overlay header element).

## Lua Graphics Studio contract (frontend internal)
- Scene objects: `{id, type:'rect'|'circle'|'line'|'text', x, y, w, h, color, rotation?, text?}`.
- Generated Lua uses marker block: `-- hydyar:scene:begin` … `-- hydyar:scene:end` containing `hydyar.rect(...)` calls bound to Canvas 2D via Fengari. Visual edits regenerate only the marker block. Manual code outside marker block is preserved. If parse fails → toast "Phần code thủ công không thể đồng bộ tự động" and do NOT overwrite.
- Fengari bindings: hydyar.rect(x,y,w,h,color), hydyar.circle(x,y,r,color), hydyar.line(x1,y1,x2,y2,color), hydyar.text(x,y,str,color), hydyar.loop(fn) for animation (requestAnimationFrame-driven).

## Language
All UI copy in Vietnamese. Code comments may be English.
