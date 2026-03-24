---
title: Module Provenance
---

Our cloud environments and Kubernetes clusters are critical pieces of infrastructure.

Consequently, tools that interface with these clusters must behave predictably and ensure we are deploying exactly what is intended. For Yoke, this means verifying that the modules you reference are the ones you expect and originate from trusted sources.

This page outlines the various strategies Yoke uses to ensure the Flights you deploy use trusted Wasm modules.

## Checksums

Yoke Wasm modules are single static binary assets, making them simple to validate against checksums. Yoke supports validating a module against a specific SHA-256 checksum.

If you know the checksum of the module you wish to use, you can ensure the module hosted at a specific URL is exactly what you expect:

```bash
yoke takeoff --checksum 01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b release oci://registry/repo/module:v1.2.3
```

By default, Yoke infers the checksum from the OCI tag or from the base path of the module. The following module references all have their SHA-256 inferred:

- oci://registry/repo/module:sha256_01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b
- https://my-domain.com/my_module_sha256_01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b.wasm
- ./main_sha256_01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b.wasm.gz

If the module fetched at these locations does not match the checksum specified in its path, Yoke will error early and refuse to use it.

### Note on the stow command

Since `v0.20.6`, the `yoke stow` command automatically adds a `sha256_...` tag when pushing a Wasm module to an OCI registry.

## Digest Pinning

Yoke automatically tracks release revisions. When using the CLI, a maximum of 10 revisions are preserved; for releases managed by the ATC, 2 revisions are kept.

Each revision includes the checksum of the module used and the URL to that module.

Whenever a new revision is requested, Yoke validates that the module matches the checksum used by previous revisions for that same URL. While this is not a permanent trust-on-first-use (TOFU) system due to the limited revision history, it ensures trust in the most recently used module.

If you change configuration values for a flight but not the underlying Wasm module, digest pinning prevents you from pulling a tampered module from the same URL.

For server-side environments like the ATC, this ensures that during restarts or initial warm-up syncs, Yoke only uses the verified module and does not pull a tampered version.

## Code Signing

You can restrict module usage to only those signed by trusted identities.

Module authors sign Wasm modules via the Yoke CLI with a private key (RSA, ECDSA, or Ed25519). Users then verify them against a set of public keys from trusted authors.

```bash
# sign a module
yoke sign --key private.pem main.wasm

# verify a module
yoke verify --key public.pem main.wasm

# verify at takeoff
yoke takeoff --verify public.pem foo main.wasm
```

Server-side environments like the ATC or ArgoCD Plugin can be configured with a list of public PEMs. Below is an example of deploying the ATC with a public key that all modules must match:

```bash
yoke takeoff atc oci://ghcr.io/yokecd/atc-installer:latest <<EOF
moduleVerificationKeys:
  - |
    -----BEGIN PUBLIC KEY-----
    MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApMDpIbcWU175oBrxH+TN
    XZtA2dXRVTCINDlTXwRQyP/jiVwpqV33iZ6pdHFitDREs/l6N1fB1eYqKn2k05Qa
    PmCBdWbLxkbdBcew0Gfbib3HE6bqODKv6E/L6TR7XxwxVKfc75GfnmR18qUBMzB5
    g0/XrfUdudcprL1Kw4ESGNu+EUWe/3hQ4TaFPskQLlS6h4oYAoPGqjb9BmiS1f59
    zv2ILpsWx7Gi1TxMsEXih8zuoMF9bSiPBo5dYHq4evEA+l8WL4IIYDEaQJs4GKMH
    j1pvTz6H8QgcmvHj1I44lUFUXFNKmIaUtNBHqgKr9WGbluf0cbp7/a8zwvRhFgB4
    JQIDAQAB
    -----END PUBLIC KEY-----
EOF
```

## Module Allow Lists (server-side only)

For the ATC and YokeCD plugin server, you can define a list of globs to match Wasm module URLs. This takes precedence over `moduleVerificationKeys`, allowing you to allowlist domains instead of specific identities.

Using the ATC as an example:

```bash
yoke takeoff atc oci://ghcr.io/yokecd/atc-installer:latest <<EOF
moduleAllowList:
  - oci://ghcr.io/yokecd/* # all modules within yokecd org
  - oci://ghcr.io/example/module:1.* # only version 1 modules of example/module
  - https://some-domain.com/modules/*
EOF
```

Note that a wildcard `*` only matches text within a single segment.
