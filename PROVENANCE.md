# Project Provenance

This document records the technical and historical provenance of Helpdesk Jarvis. It is intended to keep project history separate from environment-specific deployments and from legal conclusions about ownership.

## Repository history

- The GitHub repository was created on **December 1, 2023**.
- The repository is maintained under the `iCaptainNemo` account.
- Git history records contributions from multiple identities, including `FernXP`; individual commits remain the authoritative source for contribution details.
- The project is licensed under **GNU GPL v3.0**.

## Technical lineage

Jarvis is designed as a **domain-agnostic helpdesk automation system**. Its generic code is intended to operate across Active Directory environments rather than encode a single organization's domain.

The architecture separates reusable logic from environment-specific configuration:

```text
generic PowerShell / .NET / Active Directory operations
    -> domain detection and configuration
    -> reusable helpdesk workflows
    -> environment-specific configuration and log-format adaptation
```

Core operations rely on standard Microsoft and .NET interfaces such as the Active Directory PowerShell module and `System.DirectoryServices`. The project adds orchestration, configuration, presentation, fallback behavior, and reusable workflows around those platform capabilities.

## Pre-repository lineage

The maintainer reports that the design approach grew from personal batch-script tooling dating to approximately **2011**, before this GitHub repository and before the current PowerShell implementation.

Those 2011 artifacts are **not currently present in this repository**, so this statement is recorded as maintainer-reported project history rather than as a claim established by the Git history in this repository. If historical source files are recovered, they should be preserved separately rather than inserted with altered dates or rewritten Git history.

## Environment-specific material

The repository is structured so that reusable code remains separate from deployment-specific configuration. Domain-specific configuration, credentials, private data, and organization-specific operational details should not be committed to the public repository.

## Scope of this document

This file documents technical design and project history only. It does **not** determine copyright ownership, work-for-hire status, patent rights, employer rights, or the interpretation of any employment or intellectual-property agreement.
