---
title: Flights
sidebar:
  order: 1
---

### Overview

Flights in Yoke are analogous to Charts in Helm. A Chart is a collection of templates packaged as one referencable entity. Similarly, in Yoke, Flights refer to both the code that describes Kubernetes resources and the packaged WebAssembly (wasm) asset representing the executable.

At its core, a Flight is a piece of software that generates Kubernetes resources. In that way, even a Helm Chart is a subset of Flights (Refer to [Helm Compatibility](/docs/pages/helm_compatibility.html) for more information). This allows us to view Flights at two levels: High and Low Altitude Flights (High-Level vs Low-Level).

### High-Altitude Flights

High-Level Flights are the programs / runtimes / compiled wasm executables that generate the Kubernetes Package Instance for deployment.

### Low-Altitude Flights

Low-Level Flights are the building blocks of the software. These are most likely represented as functions that take inputs and return Kubernetes resources. They can be shared via their language's ecosystems: npm, go modules, cargo, gems, and so on.

## Flight Output

Flights are programs that generate a list of arbitrary Kubernetes resources to be applied as a single release.

The output can be structured in three different ways:

- A single resource.
- A list of resources.
- A list of lists of resources.

The first format is useful when using Yoke to manage a single resource over time. It is functionally equivalent to a list containing a single resource but provides a more convenient representation.

The second format, a list of resources, is the most common type of flight output. This represents the set of resources associated with your release.

The third format, a list of lists of resources, still constitutes a single release, but the resources are applied in stages. This is useful for dependencies within a release. For example, if resource B depends on resource A being present in the cluster, we can deploy A in an earlier stage before B. Internally, a flat list of resources is treated as a list of lists of length one: a deployment with a single stage.

Common use cases for staged releases include, but are not limited to:

- Deploying a Custom Resource Definition (CRD) before creating custom resources that depend on it.
- Creating namespaces before adding new resources to them.
- Running jobs before or after other workloads.


