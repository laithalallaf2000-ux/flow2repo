/** HTML attribute names whose React prop name differs from the HTML name. */
export const HTML_RENAMED: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  "accept-charset": "acceptCharset",
  "http-equiv": "httpEquiv",
  accesskey: "accessKey",
  allowfullscreen: "allowFullScreen",
  autocapitalize: "autoCapitalize",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  autoplay: "autoPlay",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  charset: "charSet",
  colspan: "colSpan",
  contenteditable: "contentEditable",
  controlslist: "controlsList",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
  enctype: "encType",
  enterkeyhint: "enterKeyHint",
  fetchpriority: "fetchPriority",
  formaction: "formAction",
  formenctype: "formEncType",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  frameborder: "frameBorder",
  hreflang: "hrefLang",
  inputmode: "inputMode",
  itemid: "itemID",
  itemprop: "itemProp",
  itemref: "itemRef",
  itemscope: "itemScope",
  itemtype: "itemType",
  marginheight: "marginHeight",
  marginwidth: "marginWidth",
  maxlength: "maxLength",
  minlength: "minLength",
  nomodule: "noModule",
  novalidate: "noValidate",
  playsinline: "playsInline",
  popovertarget: "popoverTarget",
  popovertargetaction: "popoverTargetAction",
  readonly: "readOnly",
  referrerpolicy: "referrerPolicy",
  rowspan: "rowSpan",
  spellcheck: "spellCheck",
  srcdoc: "srcDoc",
  srclang: "srcLang",
  srcset: "srcSet",
  tabindex: "tabIndex",
  usemap: "useMap",
};

/** HTML attributes React accepts under the same name. */
export const HTML_PASSTHROUGH = new Set([
  "abbr", "accept", "action", "allow", "alt", "async", "capture", "checked", "cite", "color", "cols",
  "content", "controls", "coords", "decoding", "default", "defer", "dir", "disabled", "download",
  "draggable", "form", "headers", "height", "hidden", "high", "href", "id", "inert", "integrity",
  "is", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "media", "method", "min",
  "multiple", "muted", "name", "nonce", "open", "optimum", "pattern", "placeholder", "popover",
  "poster", "preload", "property", "rel", "required", "reversed", "role", "rows", "sandbox",
  "scope", "selected", "shape", "size", "sizes", "slot", "span", "src", "start", "step", "summary",
  "target", "title", "translate", "type", "value", "width", "wrap",
]);

/** React props that are booleans: written as a bare prop (`disabled`) instead of `disabled="disabled"`. */
export const BOOLEAN_PROPS = new Set([
  "allowFullScreen", "async", "autoFocus", "autoPlay", "checked", "controls", "default", "defer",
  "disabled", "formNoValidate", "hidden", "inert", "itemScope", "loop", "multiple", "muted",
  "noModule", "noValidate", "open", "playsInline", "readOnly", "required", "reversed", "selected",
]);

/** React props typed as numbers. */
export const NUMBER_PROPS = new Set([
  "tabIndex", "colSpan", "rowSpan", "maxLength", "minLength", "rows", "cols", "size", "span", "start",
]);

/** Hyphenated SVG attributes React knows in camelCase. Others keep their hyphenated name. */
export const SVG_CAMEL = new Set([
  "accentHeight", "alignmentBaseline", "arabicForm", "baselineShift", "capHeight", "clipPath",
  "clipRule", "colorInterpolation", "colorInterpolationFilters", "colorProfile", "colorRendering",
  "dominantBaseline", "enableBackground", "fillOpacity", "fillRule", "floodColor", "floodOpacity",
  "fontFamily", "fontSize", "fontSizeAdjust", "fontStretch", "fontStyle", "fontVariant",
  "fontWeight", "glyphName", "glyphOrientationHorizontal", "glyphOrientationVertical",
  "horizAdvX", "horizOriginX", "imageRendering", "letterSpacing", "lightingColor", "markerEnd",
  "markerMid", "markerStart", "overlinePosition", "overlineThickness", "paintOrder",
  "pointerEvents", "renderingIntent", "shapeRendering", "stopColor", "stopOpacity",
  "strikethroughPosition", "strikethroughThickness", "strokeDasharray", "strokeDashoffset",
  "strokeLinecap", "strokeLinejoin", "strokeMiterlimit", "strokeOpacity", "strokeWidth",
  "textAnchor", "textDecoration", "textRendering", "transformOrigin", "underlinePosition",
  "underlineThickness", "unicodeBidi", "unicodeRange", "unitsPerEm", "vAlphabetic", "vHanging",
  "vIdeographic", "vMathematical", "vectorEffect", "vertAdvY", "vertOriginX", "vertOriginY",
  "wordSpacing", "writingMode", "xHeight",
]);

/** Elements rendered as void/self-closing in HTML. */
export const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);

/** Inline-level elements: whitespace next to them is visible, so it must be kept in JSX. */
export const PHRASING_ELEMENTS = new Set([
  "a", "abbr", "audio", "b", "bdi", "bdo", "br", "button", "canvas", "cite", "code", "data", "del",
  "dfn", "em", "i", "iframe", "img", "input", "ins", "kbd", "label", "mark", "meter", "object",
  "output", "picture", "progress", "q", "s", "samp", "select", "small", "span", "strong", "sub",
  "sup", "svg", "textarea", "time", "u", "var", "video", "wbr",
]);

/** HTML elements that React's TypeScript types know. Anything else is converted to a div/span. */
export const KNOWN_HTML_ELEMENTS = new Set([
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "blockquote",
  "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd",
  "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "i",
  "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "menu",
  "meter", "nav", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre",
  "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "slot", "small",
  "source", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "textarea",
  "tfoot", "th", "thead", "time", "tr", "track", "u", "ul", "var", "video", "wbr",
]);

/** Elements that never become JSX (handled elsewhere or unsafe). */
export const SKIPPED_ELEMENTS = new Set([
  "script", "noscript", "template", "style", "link", "meta", "base", "title", "head",
]);

/** Class names that mark the current page in navigation. */
export const ACTIVE_CLASSES = new Set([
  "active", "is-active", "current", "is-current", "selected", "is-selected",
]);

export function camelCaseAttribute(name: string): string {
  return name.replace(/[-:]([a-z])/g, (_, char: string) => char.toUpperCase());
}
