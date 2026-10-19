# Delta: `tool-registry-and-seo`

## ADDED Requirements

### Requirement: Registry is the source of truth

The system MUST use one registry for tool identity and SEO configuration. Each entry MUST define `slug`, `canonicalPath`, `indexable`, `primaryKeyword`, `availableLocales`, `toolType`, input/output formats, limits, `creditCost`, primary CTA, `lastModified`, and result expiry.

#### Scenario: A tool is added

- **WHEN** an engineer adds a tool entry to the registry
- **THEN** metadata, canonical, sitemap, related-tool links, and locale availability are generated from that entry
- **AND** no second page-specific copy of the same SEO decision is required

### Requirement: Remove Objects is indexable

`/remove-objects` MUST be `index, follow` and MUST appear in the tool sitemap, navigation, related-tool links, and SEO verification expectations.

#### Scenario: SEO verification runs

- **WHEN** the verification script checks `/remove-objects`
- **THEN** page metadata, canonical, sitemap membership, navigation, and the script all agree on indexability
- **AND** the old `noindex` assertion is absent

### Requirement: Pages earn indexability through real capability

An indexable page MUST expose a real tool, visible H1, input/output behavior, limits, before/after evidence, FAQ, truthful structured data, and related-tool links. Pages without real capability or with sustained zero evidence MUST be merged or set to `noindex`.

#### Scenario: An indexability decision is reviewed

- **WHEN** a page is proposed for indexing or continued indexing
- **THEN** the release evidence verifies its real tool state, visible H1, input/output behavior, limits, before/after evidence, FAQ, structured data, and related-tool links
- **AND** a page that lacks the capability or has sustained zero evidence is merged or changed to `noindex`
