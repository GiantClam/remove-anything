# Delta: `quota-and-task-lifecycle`

## ADDED Requirements

### Requirement: Anonymous and authenticated quotas are server authoritative

The server MUST allow one anonymous low-resolution image task per 24 hours and five authenticated image tasks per UTC calendar month. A signed anonymous principal MUST bind the task and download authorization. Client copy, FAQ, dashboard, and APIs MUST read the same server configuration.

#### Scenario: An anonymous user reaches the quota

- **WHEN** the anonymous principal submits a second task within 24 hours
- **THEN** the server rejects the task with a stable quota error
- **AND** the result/upgrade path explains registration or paid credits without exposing another task

### Requirement: Failed work does not double charge

Uploads that fail MUST not consume quota. A transient processing failure MUST receive at most one automatic retry. Manual retry MUST be idempotent. A permanent failure MUST return any pre-consumed credit and record the refund/return audit event.

#### Scenario: A task fails after credit reservation

- **WHEN** a task has a reserved credit and reaches a permanent failure after its allowed retry
- **THEN** the task is marked failed and the credit is returned at most once
- **AND** the refund or return audit event is linked to the task and cannot be duplicated by a repeated callback

### Requirement: Task states are shared

All six tools MUST expose `queued`, `processing`, `succeeded`, `failed`, and `expired` states. Model adapters MUST map provider-specific states to this contract.

#### Scenario: A provider reports a tool-specific status

- **WHEN** a model adapter receives a provider status for any of the six tools
- **THEN** the task API maps it to exactly one shared lifecycle state
- **AND** clients can render the same queued, processing, succeeded, failed, or expired contract for every tool

### Requirement: Results are secure and temporary

Download endpoints MUST verify task subject, state, and expiry. Source uploads and generated results MUST expire after 24 hours; minimal audit metadata MAY remain for 90 days. Users MUST be able to request earlier deletion.

#### Scenario: An unauthorized or expired download is requested

- **WHEN** a caller requests a result with the wrong subject, a non-succeeded state, or an expiry time in the past
- **THEN** the download endpoint denies access without returning the file
- **AND** expired source and result files are removed while only permitted minimal audit metadata remains
- **AND** the owner can request earlier deletion before the retention deadline

### Requirement: Paid enablement requires a cost decision

Each tool MUST have an approved `creditCost` before paid output is enabled. Unknown cost values MUST block paid enablement and incomplete credit analytics.

#### Scenario: A tool has no approved cost

- **WHEN** a registry entry has a missing or unapproved `creditCost`
- **THEN** paid output and paid credit consumption remain disabled for that tool
- **AND** release checks report the missing cost decision instead of estimating or silently charging
