You are a senior product designer and front-end engineer. Design a multi-screen dashboard (web app) and deliver it as ONE self-contained HTML file that follows the "Flow2Repo Dashboard Spec" below exactly. The file will be converted automatically into a React project, so the structure rules matter as much as the visual design.

## Flow2Repo Dashboard Spec

### File
1. Output a single complete HTML document (`<!DOCTYPE html>` … `</html>`) in one code block. No explanations before or after it.
2. No JavaScript at all: no `<script>` tags and no inline event attributes such as `onclick`. Interactions are declared with attributes (rule 26).
3. Put all CSS in `<style>` tags inside `<head>`. You may load Google Fonts with `<link>` tags. No CSS or JS frameworks (no Tailwind, no Bootstrap).

### Canvas (presentation only)
4. The body contains exactly one canvas: `<div data-f2r="canvas">`. It lays out all screens side by side in a grid so the whole flow can be reviewed at once.
5. All canvas-only CSS (board background, grid, gaps, the fixed frame size of each screen, frame shadows) goes in ONE separate block: `<style data-f2r="preview">`. Flow2Repo deletes this block, so nothing the real app needs may live there.
6. Nothing visible may be placed on the canvas outside the screens (no captions, labels or arrows). Use `data-title` for screen names.

### Screens
7. Every screen is a direct child of the canvas: `<section data-screen="orders" data-title="Orders"> … </section>`.
   - `data-screen`: unique id in kebab-case (lowercase letters, numbers, hyphens). It becomes the route `/orders`.
   - `data-title`: human-readable name of the screen.
   - Add `data-home` to the one screen that is the start page (route `/`), usually the main dashboard.
8. Each screen is a complete, real page: it repeats the full layout (sidebar, top bar…) the user sees on that page. Never rely on another screen's markup. Screens outside the app shell (login, sign-up, onboarding) have no sidebar.
9. In the shared app styles a screen root must not have a fixed width or height. Use `min-height: 100vh` and fluid layouts (flex, grid, max-width, %). Fixed frame sizes belong only in the preview block.
10. Make every screen responsive with media queries in the shared styles: on small screens the sidebar collapses behind a menu button (rule 26).

### Shared components
11. Mark every part that repeats across screens (sidebar, top bar, page footer…) with `data-component="Sidebar"` (a PascalCase name) on its root element.
12. A component's markup must be IDENTICAL in every screen where it appears: same elements, classes, texts and order. Only these differences are allowed:
    - the navigation item of the current page gets the extra class `is-active`;
    - ids inside the component may start with the screen id to stay unique in the file (`id="orders-search"` with `<label for="orders-search">`);
    - a few texts may differ, such as the page title in a top bar.
13. A detail screen highlights its parent section in the sidebar: on "Order details", the "Orders" item has `is-active`.

### Navigation
14. Every link or button that opens another screen gets `data-goto="<target screen id>"`.
    - Links: `<a href="#orders" data-goto="orders">Orders</a>`
    - Buttons: `<button type="button" data-goto="order-details">View order</button>`
15. Only point to screens that exist in the file. Links to the outside world use a normal `href` without `data-goto`.

### Styles
16. Shared app styles go in a plain `<style>` block: design tokens as CSS custom properties on `:root`, base/reset rules, typography, shared components, utilities.
17. Styles that belong to one screen only go in `<style data-f2r-screen="orders">`, and every selector inside it starts with `[data-screen="orders"]`.
18. Use meaningful class names (BEM-like: `card`, `card__title`, `btn btn--primary`). No inline `style` attributes except for truly data-driven values (the width of a progress bar, the height of a chart bar).
19. Motion is CSS only: transitions on `:hover`, `:focus-visible`, `.is-open` and `.is-active`, and `@keyframes` for small entrances. Wrap animations in `@media (prefers-reduced-motion: no-preference)`.

### Content and assets
20. Use realistic content (names, numbers, dates, prices, statuses). Never lorem ipsum.
21. Icons: inline SVG only, no icon fonts. Images and avatars: `https://` URLs (for example `https://i.pravatar.cc/80?img=12`) or relative paths like `assets/logo.svg` when I provide the files.
22. Charts are drawn with HTML/CSS bars or inline SVG, with data-driven sizes as inline styles.
23. Use semantic HTML: `header`, `nav`, `aside`, `main`, `button`, `form`, `label`, `table` with `thead` and `tbody`.
24. Draw empty, error and success states that replace a whole page as their own screens (`data-screen="orders-empty"`). Modals, drawers and dropdowns stay inside their screen (rule 26).

### Lists, forms and interactions
25. Repeated items (stat cards, table rows, list items, nav links, notifications) use IDENTICAL markup and classes for every item, with different content. Give tables a header row (`<thead>`) with a clear label for every column. Lists inside items (tags in a card) may have a different number of entries per item.
26. Interactions are declared with attributes, never with JavaScript:
    - Menu, dropdown, modal, drawer or accordion: `data-toggle="id"` on the button that opens it, `data-toggle-target="id"` on the panel, and `data-close="id"` on any button inside that closes it. The panel is hidden by default in CSS and shown by the class `is-open` (`.modal.is-open { display: flex }`). Draw it closed.
    - Tabs and segmented filters: `data-tab-group="name"` and `data-tab="key"` on each tab button (the selected one also has `is-active`), and `data-tab-group="name"` with `data-tab-panel="key"` on each panel (hide the inactive panels with `hidden`).
    - Ids used by `data-toggle` and `data-tab-group` are kebab-case. The button and its panel must be in the same screen or in the same `data-component`.
27. Every `<form>` has an `id`, and every field has a `name` (the field's key in the form's data), a `<label>`, and a realistic default `value`. Use `required`, `type="email"`, `minlength`… where they apply. Use `type="submit"` on the submit button. Do not write a form `action`.

### Skeleton to follow

The skeleton shows two screens. Its links to `settings` and `order-details` stand for screens your full file contains.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Dashboard</title>
  <style>
    :root { --color-bg: #f7f8fa; --color-primary: #4f46e5; }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--color-bg); }
    [data-screen] { min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .user-menu__panel { display: none; }
    .user-menu__panel.is-open { display: block; }
    /* shared app styles… */
  </style>
  <style data-f2r-screen="orders">
    [data-screen="orders"] .orders-table { width: 100%; }
  </style>
  <style data-f2r="preview">
    body { background: #d9dce3; padding: 48px; }
    [data-f2r="canvas"] { display: grid; grid-template-columns: repeat(2, 1440px); gap: 48px; align-items: start; }
    [data-screen] { width: 1440px; min-height: 900px; overflow: hidden; border-radius: 12px; }
  </style>
</head>
<body>
  <div data-f2r="canvas">
    <section data-screen="dashboard" data-title="Dashboard" data-home>
      <div class="layout">
        <aside class="sidebar" data-component="Sidebar">
          <nav>
            <a class="nav-item is-active" href="#dashboard" data-goto="dashboard">Dashboard</a>
            <a class="nav-item" href="#orders" data-goto="orders">Orders</a>
          </nav>
        </aside>
        <main class="content">
          <header class="topbar" data-component="Topbar">
            <h1 class="topbar__title">Dashboard</h1>
            <div class="user-menu">
              <button type="button" class="user-menu__button" data-toggle="user-menu">Sara Haddad</button>
              <div class="user-menu__panel" data-toggle-target="user-menu">
                <a href="#settings" data-goto="settings">Settings</a>
              </div>
            </div>
          </header>
          <div class="stats">
            <div class="stat"><span class="stat__label">Revenue</span><strong class="stat__value">$48,290</strong></div>
            <div class="stat"><span class="stat__label">Orders</span><strong class="stat__value">1,284</strong></div>
            <div class="stat"><span class="stat__label">Customers</span><strong class="stat__value">312</strong></div>
          </div>
        </main>
      </div>
    </section>
    <section data-screen="orders" data-title="Orders">
      <div class="layout">
        <aside class="sidebar" data-component="Sidebar">
          <nav>
            <a class="nav-item" href="#dashboard" data-goto="dashboard">Dashboard</a>
            <a class="nav-item is-active" href="#orders" data-goto="orders">Orders</a>
          </nav>
        </aside>
        <main class="content">
          <header class="topbar" data-component="Topbar">
            <h1 class="topbar__title">Orders</h1>
            <div class="user-menu">
              <button type="button" class="user-menu__button" data-toggle="user-menu">Sara Haddad</button>
              <div class="user-menu__panel" data-toggle-target="user-menu">
                <a href="#settings" data-goto="settings">Settings</a>
              </div>
            </div>
          </header>
          <table class="orders-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th></th></tr></thead>
            <tbody>
              <tr><td>#10482</td><td>Omar Khalil</td><td>$248.00</td><td><button type="button" data-goto="order-details">View</button></td></tr>
              <tr><td>#10481</td><td>Lina Mansour</td><td>$89.50</td><td><button type="button" data-goto="order-details">View</button></td></tr>
              <tr><td>#10480</td><td>Karim Nasser</td><td>$412.20</td><td><button type="button" data-goto="order-details">View</button></td></tr>
            </tbody>
          </table>
        </main>
      </div>
    </section>
  </div>
</body>
</html>
```

## My dashboard
- Product: <<DESCRIBE THE APP, WHO USES IT AND THE VISUAL STYLE YOU WANT>>
- Screens: <<LIST THE SCREENS, e.g. Login, Dashboard, Orders, Order details, Customers, Settings>>

Before you answer, check the file against every rule of the spec. Then output only the HTML file.
