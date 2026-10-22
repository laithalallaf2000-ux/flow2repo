import { describe, expect, it } from "vitest";
import { convert, spec } from "./helpers";

const CUSTOMERS = ["Olivia Martin|24|Premium|New York, US|VIP,EU,Wholesale", "Noah Khan|7|Standard|Dubai, AE|New", "Ava Chen|24|Premium|Singapore, SG|VIP,APAC,Press,Beta", "Liam Smith|3|Trial|Austin, US|New,US,Lead"]
  .map((row) => {
    const [name, orders, segment, place, tags] = row.split("|");
    return `<article class="customer-card"><h3>${name}</h3><div class="stat"><span class="stat__label">Orders</span><strong>${orders}</strong></div><b class="segment">${segment}</b><p>${place}</p><ul class="customer-tags">${tags.split(",").map((t) => `<li class="tag">${t}</li>`).join("")}</ul></article>`;
  })
  .join("");

describe("fixes from a real design review", () => {
  it("never names a count 'name' and never uses a count as a React key", () => {
    const { file } = convert(spec(`<section data-screen="customers"><div class="grid">${CUSTOMERS}</div></section>`));
    const types = file("src/types/customers.ts");
    expect(types).toContain("title: string;");
    expect(types).toContain("orderCount: string;");
    expect(types).not.toMatch(/\bname: string;/);
    expect(types).toContain("customerTags: string[];");
    const page = file("src/pages/CustomersPage.tsx");
    expect(page).toContain("key={customerCard.title}");
    expect(page).not.toContain("key={customerCard.orderCount");
    expect(page).toContain("{customerCard.customerTags.map((customerTag) => (");
    const data = file("src/data/customers.ts");
    expect(data).toContain(`"VIP", "APAC", "Press", "Beta"`);
    expect(data).toContain(`orderCount: "24"`);
  });

  it("keeps the description and sharing meta tags of the design in index.html", () => {
    const { file } = convert(
      spec(`<section data-screen="home"><p>Hi</p></section>`, `<meta name="description" content="Merchant OS for studios"><meta property="og:title" content="Atelier"><meta name="theme-color" content="#111111">`),
    );
    const index = file("index.html");
    expect(index).toContain(`<meta name="description" content="Merchant OS for studios" />`);
    expect(index).toContain(`<meta property="og:title" content="Atelier" />`);
    expect(index).toContain(`<meta name="theme-color" content="#111111" />`);
    expect(index.match(/name="viewport"/g)).toHaveLength(1);
  });

  const TABS = `<section data-screen="orders">
    <div role="tablist" aria-label="Order status" class="tabs">
      <button role="tab" id="t-all" aria-controls="p-all" aria-selected="true" class="tab active">All orders</button>
      <button role="tab" id="t-paid" aria-controls="p-paid" aria-selected="false" class="tab">Paid</button>
      <button role="tab" id="t-pending" aria-controls="p-pending" aria-selected="false" class="tab">Pending</button>
    </div>
    <div role="tabpanel" id="p-all"><table><tr><td>All rows</td></tr></table></div>
    <div role="tabpanel" id="p-paid" hidden><table><tr><td>Paid rows</td></tr></table></div>
    <div role="tabpanel" id="p-pending" hidden><table><tr><td>Pending rows</td></tr></table></div>
  </section>`;

  it("turns ARIA tabs (no Flow2Repo markers) into state, with the design's own active class", () => {
    const { file, result } = convert(spec(TABS));
    const page = file("src/pages/OrdersPage.tsx");
    expect(page).toContain(`const [orderStatusTab, setOrderStatusTab] = useState("p-all");`);
    expect(page).toContain(`className={orderStatusTab === "p-paid" ? "tab active" : "tab"}`);
    expect(page).toContain(`onClick={() => setOrderStatusTab("p-paid")}`);
    expect(page).toContain(`hidden={orderStatusTab !== "p-pending"}`);
    expect(page.match(/aria-selected=/g)).toHaveLength(3);
    expect(page).not.toContain(`aria-selected="true"`);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("says so when buttons look like tabs but nothing wires them, instead of leaving them silently dead", () => {
    const { result, file } = convert(
      spec(`<section data-screen="orders"><div class="tabs"><button class="tab is-active">All</button><button class="tab">Paid</button></div><p>Rows</p></section>`),
    );
    const note = result.warnings.find((w) => w.message.startsWith("Tabs "));
    expect(note?.message).toContain("All, Paid");
    expect(note?.message).toContain("data-tab-group");
    expect(file("src/pages/OrdersPage.tsx")).not.toContain("useState");
  });

  it("uses a custom active class (active, selected) for marker tabs too", () => {
    const { file } = convert(
      spec(`<section data-screen="orders"><button class="t active" data-tab-group="s" data-tab="a">A</button><button class="t" data-tab-group="s" data-tab="b">B</button>
      <div data-tab-group="s" data-tab-panel="a">PA</div><div data-tab-group="s" data-tab-panel="b" hidden>PB</div></section>`),
    );
    expect(file("src/pages/OrdersPage.tsx")).toContain(`sTab === "b" ? "t active" : "t"`);
  });
});
