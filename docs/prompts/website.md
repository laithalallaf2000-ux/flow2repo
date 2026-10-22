You are a senior web designer and front-end engineer. Design a multi-page website and deliver it as ONE self-contained HTML file that follows the "Flow2Repo Website Spec" below exactly. The file will be converted automatically into a React project, so the structure rules matter as much as the visual design.

## Flow2Repo Website Spec

### File
1. Output a single complete HTML document (`<!DOCTYPE html>` … `</html>`) in one code block. No explanations before or after it.
2. No JavaScript at all: no `<script>` tags and no inline event attributes such as `onclick`. Interactions are declared with attributes (rule 25).
3. Put all CSS in `<style>` tags inside `<head>`. You may load Google Fonts with `<link>` tags. No CSS or JS frameworks (no Tailwind, no Bootstrap).

### Canvas (presentation only)
4. The body contains exactly one canvas: `<div data-f2r="canvas">`. It lays out all pages side by side so the whole site can be reviewed at once.
5. All canvas-only CSS (board background, grid, gaps, the fixed frame width of each page, frame shadows) goes in ONE separate block: `<style data-f2r="preview">`. Flow2Repo deletes this block, so nothing the real site needs may live there.
6. Nothing visible may be placed on the canvas outside the pages (no captions, labels or arrows). Use `data-title` for page names.

### Pages
7. Every page is a direct child of the canvas: `<section data-screen="pricing" data-title="Pricing"> … </section>`.
   - `data-screen`: unique id in kebab-case (lowercase letters, numbers, hyphens). It becomes the route `/pricing`.
   - `data-title`: human-readable name of the page.
   - Add `data-home` to the home page (route `/`).
8. Each page is complete: it repeats the full navbar and footer and has its own content sections. Never rely on another page's markup.
9. Pages are as long as their content. In the shared styles a page root must not have a fixed width or height; use fluid layouts (flex, grid, `max-width` containers, %). The fixed frame width belongs only in the preview block.
10. Make every page responsive with media queries in the shared styles: on small screens the navbar links collapse behind a menu button (rule 25).

### Navbar and footer
11. Mark the navbar with `data-component="Navbar"` and the footer with `data-component="Footer"` on their root elements, and any other part repeated on several pages (a newsletter band, a call-to-action section) with its own PascalCase name.
12. A component's markup must be IDENTICAL on every page where it appears: same elements, classes, texts and order. Only these differences are allowed:
    - the navbar link of the current page gets the extra class `is-active`;
    - ids inside the component may start with the page id to stay unique in the file (`id="pricing-email"` with `<label for="pricing-email">`).

### Navigation
13. Every link or button that opens another page gets `data-goto="<target page id>"`.
    - Links: `<a href="#pricing" data-goto="pricing">Pricing</a>`
    - Buttons: `<button type="button" data-goto="contact">Book a demo</button>`
14. Only point to pages that exist in the file. Links to the outside world (social profiles, app stores, `mailto:`) use a normal `href` without `data-goto`.
15. Links that scroll to a section of the same page use `href="#section-id"` without `data-goto`, and section ids must never reuse a page id: on the home page use `id="home-features"`, not `id="features"` when a page is called `features`.

### Styles
16. Shared styles go in a plain `<style>` block: design tokens as CSS custom properties on `:root`, base/reset rules, typography, a `.container` with a `max-width`, buttons, shared sections, utilities.
17. Styles that belong to one page only go in `<style data-f2r-screen="pricing">`, and every selector inside it starts with `[data-screen="pricing"]`.
18. Use meaningful class names (BEM-like: `hero`, `hero__title`, `btn btn--primary`). No inline `style` attributes.
19. Motion is CSS only: transitions on `:hover`, `:focus-visible`, `.is-open` and `.is-active`, and `@keyframes` for entrances that play on load (hero text, images). No scroll-triggered effects or parallax: they need JavaScript. Wrap animations in `@media (prefers-reduced-motion: no-preference)`.

### Content and assets
20. Use realistic, persuasive copy: real-sounding headlines, product names, prices, testimonials with names and roles, dates. Never lorem ipsum.
21. Icons: inline SVG only, no icon fonts. Images: `https://` URLs (for example `https://images.unsplash.com/photo-…?w=1200`) with a meaningful `alt`, or relative paths like `assets/hero.jpg` when I provide the files.
22. Use semantic HTML: `header`, `nav`, `main`, `section`, `article`, `footer`, `h1` once per page then `h2`/`h3` in order, `button`, `form`, `label`.

### Lists, forms and interactions
23. Repeated items (feature cards, pricing plans, testimonials, team members, blog posts, logos, footer link columns) use IDENTICAL markup and classes for every item, with different content. Lists inside items (the features of a plan, the links of a footer column) may have a different number of entries per item.
24. Every `<form>` (contact, newsletter, sign-up) has an `id`, and every field has a `name`, a `<label>` (visually hidden is fine), and a realistic placeholder or default `value`. Use `required`, `type="email"`, `minlength`… where they apply. Use `type="submit"` on the submit button. Do not write a form `action`.
25. Interactions are declared with attributes, never with JavaScript:
    - Mobile menu, dropdown or modal: `data-toggle="id"` on the button that opens it, `data-toggle-target="id"` on the panel, and `data-close="id"` on any button inside that closes it. The panel is hidden by default in CSS and shown by the class `is-open` (`.navbar__links.is-open { display: flex }`). Draw it closed.
    - Monthly / yearly pricing and other tabs: `data-tab-group="name"` and `data-tab="key"` on each tab button (the selected one also has `is-active`), and `data-tab-group="name"` with `data-tab-panel="key"` on each panel (hide the inactive panels with `hidden`).
    - FAQ: use native `<details>` and `<summary>` for each question; they open and close without JavaScript.
    - Ids used by `data-toggle` and `data-tab-group` are kebab-case. The button and its panel must be in the same page or in the same `data-component`.

### Skeleton to follow

The skeleton shows two pages with shortened content; your file contains every page in full.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Brewly · Coffee subscriptions</title>
  <style>
    :root { --color-bg: #fffaf3; --color-text: #2b1d14; --color-primary: #c8622a; }
    body { margin: 0; font-family: system-ui, sans-serif; color: var(--color-text); background: var(--color-bg); }
    .container { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .navbar__links { display: flex; gap: 28px; }
    .navbar__menu { display: none; }
    @media (max-width: 800px) {
      .navbar__menu { display: block; }
      .navbar__links { display: none; }
      .navbar__links.is-open { display: flex; flex-direction: column; }
    }
    /* shared site styles… */
  </style>
  <style data-f2r-screen="pricing">
    [data-screen="pricing"] .plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  </style>
  <style data-f2r="preview">
    body { background: #e5e1da; padding: 48px; }
    [data-f2r="canvas"] { display: grid; grid-template-columns: repeat(2, 1440px); gap: 48px; align-items: start; }
    [data-screen] { width: 1440px; overflow: hidden; border-radius: 12px; }
  </style>
</head>
<body>
  <div data-f2r="canvas">
    <section data-screen="home" data-title="Home" data-home>
      <header class="navbar" data-component="Navbar">
        <div class="container navbar__inner">
          <a class="navbar__logo" href="#home" data-goto="home">Brewly</a>
          <button type="button" class="navbar__menu" data-toggle="nav-menu" aria-label="Open menu">Menu</button>
          <nav class="navbar__links" data-toggle-target="nav-menu">
            <a class="navbar__link is-active" href="#home" data-goto="home">Home</a>
            <a class="navbar__link" href="#pricing" data-goto="pricing">Pricing</a>
          </nav>
        </div>
      </header>
      <main>
        <section class="hero container">
          <h1 class="hero__title">Fresh coffee, delivered every week.</h1>
          <a class="btn btn--primary" href="#pricing" data-goto="pricing">See plans</a>
          <a class="btn" href="#home-features">How it works</a>
        </section>
        <section class="features container" id="home-features">
          <article class="feature"><h3 class="feature__title">Roasted to order</h3><p class="feature__text">Never older than a week.</p></article>
          <article class="feature"><h3 class="feature__title">Pause anytime</h3><p class="feature__text">Skip or cancel in one click.</p></article>
          <article class="feature"><h3 class="feature__title">Free shipping</h3><p class="feature__text">On every plan, every week.</p></article>
        </section>
      </main>
      <footer class="footer" data-component="Footer">
        <div class="container">© 2026 Brewly · <a href="mailto:hello@brewly.coffee">hello@brewly.coffee</a></div>
      </footer>
    </section>
    <section data-screen="pricing" data-title="Pricing">
      <header class="navbar" data-component="Navbar">
        <div class="container navbar__inner">
          <a class="navbar__logo" href="#home" data-goto="home">Brewly</a>
          <button type="button" class="navbar__menu" data-toggle="nav-menu" aria-label="Open menu">Menu</button>
          <nav class="navbar__links" data-toggle-target="nav-menu">
            <a class="navbar__link" href="#home" data-goto="home">Home</a>
            <a class="navbar__link is-active" href="#pricing" data-goto="pricing">Pricing</a>
          </nav>
        </div>
      </header>
      <main class="container">
        <h1>Plans</h1>
        <div class="billing" role="tablist">
          <button type="button" class="billing__tab is-active" data-tab-group="billing" data-tab="monthly">Monthly</button>
          <button type="button" class="billing__tab" data-tab-group="billing" data-tab="yearly">Yearly</button>
        </div>
        <div data-tab-group="billing" data-tab-panel="monthly">…three plans with monthly prices…</div>
        <div data-tab-group="billing" data-tab-panel="yearly" hidden>…the same three plans with yearly prices…</div>
        <details class="faq"><summary>Can I change beans?</summary><p>Yes, every week.</p></details>
      </main>
      <footer class="footer" data-component="Footer">
        <div class="container">© 2026 Brewly · <a href="mailto:hello@brewly.coffee">hello@brewly.coffee</a></div>
      </footer>
    </section>
  </div>
</body>
</html>
```

## My website
- Brand and product: <<DESCRIBE THE BUSINESS, ITS AUDIENCE AND THE VISUAL STYLE YOU WANT>>
- Pages: <<LIST THE PAGES, e.g. Home, Features, Pricing, About, Blog, Contact>>
- Sections that matter: <<e.g. hero with a product image, logos of customers, testimonials, FAQ, newsletter>>

Before you answer, check the file against every rule of the spec. Then output only the HTML file.
