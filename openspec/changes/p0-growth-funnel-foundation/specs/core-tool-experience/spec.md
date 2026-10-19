# Delta: `core-tool-experience`

## ADDED Requirements

### Requirement: Six canonical pages share one task flow

The following canonical pages MUST support upload → preview → process → result: `/remove-background`, `/remove-objects`, `/transparent-png-maker`, `/white-background-maker`, `/change-background-color`, and `/remove-watermark`.

#### Scenario: A first-time visitor completes a task

- **WHEN** an anonymous visitor uploads a valid image
- **THEN** the visitor can start processing without registering first
- **AND** a successful result provides a low-resolution preview/download and one primary next action
- **AND** high-resolution, batch, history, or commercial actions lead to registration or upgrade

### Requirement: Output claims are truthful

Each page MUST disclose its supported input, output format, preview/full-output distinction, size/resolution limits, expiry, and credits cost. The product MUST NOT advertise high-resolution or lossless output that the implementation does not provide.

#### Scenario: A visitor inspects the tool contract

- **WHEN** a visitor opens any canonical tool page before uploading
- **THEN** the page displays the supported input and output formats, applicable limits, preview or full-output behavior, result expiry, and credit cost
- **AND** the visible claims match the registry and server response contract

### Requirement: High-risk tools record authorization

Watermark, logo, people, and text removal MUST show an authorization confirmation before processing. The system MUST record the confirmation timestamp, policy version, subject, and task ID, and MUST expose abuse reporting/deletion paths.

#### Scenario: A high-risk removal is submitted

- **WHEN** a user submits a watermark, logo, people, or text removal task
- **THEN** processing is blocked until the user confirms authorization
- **AND** the resulting task record stores the confirmation timestamp, policy version, subject, and task ID
- **AND** the page exposes abuse reporting and deletion request paths

### Requirement: UI and API expose recoverable failure

Each page MUST display stable processing states and actionable errors. A retry MUST reuse the task idempotency contract, avoid double charging, and preserve the user's ability to reach support or delete expired data.

#### Scenario: A transient task fails

- **WHEN** a task reaches a retryable provider failure
- **THEN** the UI shows a stable failure state and an actionable retry option
- **AND** the retry reuses the task idempotency contract without creating a second charge
- **AND** the user can reach support or request deletion of expired data

### Requirement: Page content supports the real tool

Each page MUST include a visible H1, usable tool state, before/after example, limits, FAQ, canonical, truthful Schema, and related-tool links. Generic keyword-only landing pages are not acceptable.

#### Scenario: A crawler and visitor load a canonical page

- **WHEN** a canonical tool page is rendered for a crawler or a first-time visitor
- **THEN** it contains a visible H1, an operable tool state, before/after evidence, limits, FAQ, canonical metadata, truthful structured data, and related-tool links
- **AND** the content describes the actual tool behavior rather than keywords alone
