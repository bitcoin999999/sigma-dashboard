/**
 * A structured-data block, inlined as text.
 *
 * Crawlers read the tag's text content, so this cannot be a serialised prop or
 * a `<Script>` with a `src`. The escape keeps a stray `<` inside a company name
 * from closing the tag early and spilling the rest of the payload into the DOM.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
