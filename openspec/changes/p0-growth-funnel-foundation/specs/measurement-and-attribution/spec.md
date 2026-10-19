# Delta: `measurement-and-attribution`

## ADDED Requirements

### Requirement: Production measurement is a release gate

The system MUST use a target remove-anything GA4 property and verified GSC domain. Production `NEXT_PUBLIC_GA_ID`, GA4 DebugView evidence, and GSC verification MUST exist before the 28-day baseline begins.

#### Scenario: The release is evaluated for the baseline

- **WHEN** the team attempts to start the 28-day baseline
- **THEN** the target GA4 property and production measurement ID are recorded
- **AND** GA4 DebugView evidence and GSC domain verification are attached to the release evidence
- **AND** the baseline remains blocked if any of those checks is missing

### Requirement: Events distinguish behavior from facts

The client MUST emit behavioral events from `tool_view` through checkout initiation. The server MUST emit processing completion/failure, credits consumption, order, and purchase facts. Payment webhook handling MUST be idempotent.

#### Scenario: A purchase webhook is retried

- **WHEN** the same provider webhook is received more than once
- **THEN** the order and credits ledger change at most once
- **AND** at most one deduplicated `purchase_completed` fact is sent

#### Scenario: A task produces a server fact

- **WHEN** a task completes or fails after a client has emitted behavioral events
- **THEN** the server emits the corresponding processing fact with its task identity
- **AND** client behavior and server-confirmed facts remain distinguishable in downstream reports

### Requirement: Events are comparable across tools

Events MUST support `tool_slug`, `landing_page`, `locale`, `file_type`, `file_size_bucket`, `is_authenticated`, `plan`, `credits_before`, `credits_after`, and `experiment_id` where applicable. Task events MUST include `task_id`; payment events MUST include `order_id`; every event MUST include `event_id`.

#### Scenario: A funnel report groups events from different pages

- **WHEN** the weekly report aggregates events from two or more canonical tools
- **THEN** each applicable event can be grouped by tool, landing page, locale, file bucket, authentication state, plan, and experiment
- **AND** task and payment events are joined through `task_id` and `order_id` while every event remains deduplicable by `event_id`

### Requirement: Weekly review is part of the feature

The product and engineering owners MUST review weekly page/tool/locale/auth funnels and reliability metrics covering impressions, visits, completion, download, signup, first purchase, 30-day repeat, failures, latency, cost, and missing events.

#### Scenario: The weekly review is generated

- **WHEN** the weekly review job runs for a completed reporting period
- **THEN** it produces page, tool, locale, and authentication funnel metrics plus reliability metrics for the required measures
- **AND** missing events and unresolved data gaps are visible to the named owners for follow-up
