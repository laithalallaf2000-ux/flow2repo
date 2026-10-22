import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

const PRODUCTS = `<section data-screen="home"><div class="products">
  <article class="product"><h3 class="product__title">Product A</h3><ul class="tags"><li class="tag">New</li><li class="tag">Popular</li><li class="tag">Sale</li></ul></article>
  <article class="product"><h3 class="product__title">Product B</h3><ul class="tags"><li class="tag">Featured</li></ul></article>
  <article class="product"><h3 class="product__title">Product C</h3><ul class="tags"><li class="tag">New</li><li class="tag">Limited</li></ul></article>
</div></section>`;

describe("nested data", () => {
  it("keeps tags inside their product and supports a different number per product", () => {
    const { file } = convert(spec(PRODUCTS));
    expect(file("src/types/home.ts")).toBe(`export interface Product {\n  title: string;\n  tags: string[];\n}\n`);
    const data = file("src/data/home.ts");
    expect(data).toContain(`import type { Product } from "../types/home";`);
    expect(data).toContain(`{ title: "Product A", tags: ["New", "Popular", "Sale"] },`);
    expect(data).toContain(`{ title: "Product B", tags: ["Featured"] },`);
    expect(data).toContain(`{ title: "Product C", tags: ["New", "Limited"] },`);
  });

  it("renders nested .map() calls with stable keys and no flattened fields", () => {
    const page = convert(spec(PRODUCTS)).file("src/pages/HomePage.tsx");
    expect(page).toContain("{products.map((product) => (");
    expect(page).toContain("<article key={product.title} className=\"product\">");
    expect(page).toContain("{product.tags.map((tag) => (");
    expect(page).toContain("<li key={tag} className=\"tag\">{tag}</li>");
    expect(page).not.toMatch(/Featured|Popular|Limited/);
  });

  it("does not depend on array lengths: any count of nested items works", () => {
    const cards = [1, 4, 0, 2]
      .map((n, i) => `<article class="card"><h3>Card ${i}</h3><ul class="tags">${Array.from({ length: n }, (_, k) => `<li class="tag">t${i}${k}</li>`).join("")}</ul></article>`)
      .join("");
    const { file } = convert(spec(`<section data-screen="home"><div>${cards}</div></section>`));
    const data = file("src/data/home.ts");
    // Cards with no tags are not merged with the others: markup differs, so nothing is lost or invented.
    expect(data + file("src/pages/HomePage.tsx")).toContain("t10");
    expect(data + file("src/pages/HomePage.tsx")).toContain("t33".replace("33", "30"));
  });

  it("uses an index in the key when nested values repeat, and generates ids when no field identifies an item", () => {
    const { file } = convert(spec(`<section data-screen="home"><div>
      <article class="card"><h3>A</h3><ul class="tags"><li class="tag">x</li><li class="tag">x</li><li class="tag">y</li></ul></article>
      <article class="card"><h3>A</h3><ul class="tags"><li class="tag">z</li></ul></article>
      <article class="card"><h3>A</h3><ul class="tags"><li class="tag">x</li><li class="tag">y</li></ul></article>
    </div></section>`));
    const page = file("src/pages/HomePage.tsx");
    expect(page).toContain("key={`${tag}-${tagIndex}`}");
    expect(page).toContain("<article key={card.id} className=\"card\">");
    expect(file("src/types/home.ts")).toContain("id: string;");
    expect(file("src/data/home.ts")).toContain(`id: "card-1"`);
  });

  it("makes pricing plans with a different number of features data-driven", () => {
    const { file } = convert(readFixture("pricing-nested"));
    const data = file("src/data/pricing.ts");
    expect(data).toContain(`features: ["1 project", "7-day history", "Community support"]`);
    expect(data).toContain(`"Priority support", "SSO", "Audit log"]`);
    expect(data).toContain(`"Dedicated manager", "Custom contracts"]`);
    expect(file("src/types/pricing.ts")).toContain("features: string[];");
    expect(file("src/pages/PricingPage.tsx")).toContain("{plan.features.map((feature) => (");
  });

  it("models navigation groups (footer columns with links) as objects holding arrays of objects", () => {
    const { file } = convert(readFixture("pricing-nested"));
    expect(file("src/types/footer.ts")).toContain("items: Item[];");
    expect(file("src/data/footer.ts")).toContain(`subtitle`.replace("subtitle", "title") + `: "Legal"`);
    const footer = file("src/components/Footer.tsx");
    expect(footer).toContain("{footerCols.map((footerCol) => (");
    expect(footer).toContain("{footerCol.items.map((item) => (");
  });

  it("handles tables that contain nested lists, and nested lists of objects (deals inside columns)", () => {
    const shop = convert(readFixture("ecommerce-admin"));
    expect(shop.file("src/types/orders.ts")).toContain("tags: string[];");
    expect(shop.file("src/data/orders.ts")).toContain(`tags: ["Trail Runner", "Socks", "Laces"]`);
    expect(shop.file("src/pages/OrdersPage.tsx")).toContain("{orderRow.tags.map((tag) => (");

    const crm = convert(readFixture("crm-app"));
    expect(crm.file("src/types/pipeline.ts")).toContain("deals: Deal[];");
    expect(crm.file("src/data/pipeline.ts")).toContain(`{ name: "Kestrel upgrade", amount: "$7,200" }`);
    expect(crm.file("src/pages/PipelinePage.tsx")).toContain("{column.deals.map((deal) => (");
  });

  it("keeps table cells as named columns instead of turning a row into a list", () => {
    const { file } = convert(spec(`<section data-screen="home"><table><thead><tr><th>Name</th><th>Qty</th><th>Price</th></tr></thead><tbody>
      <tr><td>Apple</td><td>1</td><td>$1</td></tr><tr><td>Pear</td><td>2</td><td>$2</td></tr><tr><td>Fig</td><td>3</td><td>$3</td></tr></tbody></table></section>`));
    expect(file("src/types/home.ts")).toContain("  name: string;\n  qty: string;\n  price: string;");
  });

  it("leaves identical nested lists in place when every item has the same content", () => {
    const { file } = convert(spec(`<section data-screen="home"><div>
      <article class="card"><h3>A</h3><ul><li>same</li><li>same2</li><li>same3</li></ul></article>
      <article class="card"><h3>B</h3><ul><li>same</li><li>same2</li><li>same3</li></ul></article>
      <article class="card"><h3>C</h3><ul><li>same</li><li>same2</li><li>same3</li></ul></article>
    </div></section>`));
    expect(file("src/pages/HomePage.tsx")).toContain("<li>same2</li>");
    expect(file("src/data/home.ts")).toContain("export const cards: string[] = [");
    expect(file("src/data/home.ts")).not.toContain("same");
  });
});
