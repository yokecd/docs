---
title: Resource Readiness
---

Yoke has a notion of resource readiness. It is used in two places:

- The CLI, when you pass `--wait=duration` to `yoke takeoff` or `yoke descent`, waits for every resource in the release to become ready.
- The Air Traffic Controller (ATC) requeues its reconciler until all child resources of an instance are ready, and only then marks the Airway instance or [generic flight](/docs/airtrafficcontroller/generic-flights) as `Ready`.

For this to work, Yoke needs to know what "ready" means for a given resource.

## Built-in readiness

Out of the box, Yoke knows the readiness rules for core Kubernetes resources and standard workloads:

| Resource                          | Ready when                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `Namespace`                       | `status.phase` is `Active`                                                            |
| `Pod`                             | the `Initialized`, `ContainersReady` and `Ready` conditions are true                  |
| `Service`                         | at least one EndpointSlice exists for the service                                     |
| `Deployment`                      | observed generation is current, `Available` is true, and replica counts all match     |
| `ReplicaSet`, `StatefulSet`       | observed generation is current and replica counts all match                           |
| `DaemonSet`                       | observed generation is current and scheduled/updated/available/ready counts all match |
| `Job`                             | the `Complete` condition is true (a `Failed` condition is reported as an error)       |
| `CustomResourceDefinition`        | the `Established` condition is true                                                   |
| `Airway`, `Flight`, `ClusterFlight`| the `Ready` condition is true                                                         |

Resources owned by an Airway (that is, Airway instances) are also considered ready when their `Ready` condition is true.

Any resource Yoke does not recognize is assumed to be ready as soon as it is applied. If your Flight deploys a third-party custom resource, such as a `Certificate`, a `Gateway`, or a database claim, Yoke has no way of guessing what its ready state looks like, and would consider it ready immediately.

## Custom readiness definitions

To close that gap, Yoke reads **custom readiness definitions** from ConfigMaps in your cluster. These ConfigMaps are identified by the label `resource.yoke.cd/readiness`, whose value selects the definition kind: either `conditions` or `lua`.

In both cases, the ConfigMap's data keys are GroupKind strings following Kubernetes' canonical format: `Kind.group`. For core resources with no API group, the key is simply the kind.

Readiness ConfigMaps are read from **all namespaces**. Where you place them is a matter of your own conventions, but note that keys are global: if two ConfigMaps define readiness for the same GroupKind, only one of them wins and which one is undefined. Keep a single definition per GroupKind.

### Conditions

The simplest way to define readiness is by listing the status conditions that must be true. The value is a whitespace-separated list of condition types.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: custom-readiness-conditions
  labels:
    resource.yoke.cd/readiness: conditions
data:
  Certificate.cert-manager.io: Ready
  Gateway.gateway.networking.k8s.io: Accepted Programmed
```

The resource is ready once every listed condition is present with status `True`. If a condition reports an `observedGeneration` greater than zero, it must also match the resource's current generation; otherwise the condition is considered stale and the resource is not ready.

### Lua

When readiness cannot be expressed as a set of conditions, you can write a Lua script instead. Scripts are stored in a ConfigMap labelled `resource.yoke.cd/readiness: lua`, keyed by GroupKind exactly as above.

Each script must evaluate to a function taking the resource and returning a boolean:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: custom-readiness-lua
  labels:
    resource.yoke.cd/readiness: lua
data:
  CustomKind.custom.group: |
    return function(resource)
      return resource.status.deployed > 0 and #resource.status.errors == 0
    end
  Cluster.postgresql.cnpg.io: |
    return function(resource)
      return resource.status.readyInstances == resource.spec.instances
    end
```

The `resource` argument is the entire resource as a Lua table, mirroring its JSON representation: `resource.metadata`, `resource.spec`, `resource.status`, and so on.

Scripts run with the Lua core libraries available. They have no access to the network, the filesystem, or the cluster; `stdin`, `stdout` and `stderr` are not connected to anything. A readiness script is meant to be a pure function of the resource it is given.

Returning `nil` is treated as "not ready". Returning any non-boolean value is an error, and so is a script that fails to load or raises at runtime. Errors are surfaced by the caller: the CLI fails the wait, and the ATC reports the failure on the instance.

> **Note**
> Readiness scripts are evaluated on every poll, for every matching resource. Keep them small and cheap.

### Wildcards

A key whose kind is a single underscore matches **any kind** within that group:

```yaml
data:
  _.custom.group: |
    return function(resource)
      return resource.status.ready
    end
```

Exact GroupKind matches always take precedence over the wildcard, so you can define a group-wide default and override it for specific kinds. Wildcards apply to the kind only; the group must always be spelled out.

### Precedence

Readiness is resolved in the following order:

1. Yoke's built-in rules for core resources and standard workloads.
2. The `Ready` condition, for resources owned by an Airway.
3. A custom definition matching the resource's exact GroupKind.
4. A custom definition matching `_.group`.
5. Otherwise the resource is considered ready.

Custom definitions therefore extend Yoke; they cannot override readiness for the resources Yoke already knows about.

## Enabling custom readiness

### CLI

Loading definitions from the cluster is opt-in for the CLI, via the `--load-custom-readiness` flag on `takeoff` and `descent`:

```bash
yoke takeoff --wait 5m --load-custom-readiness release ./main.wasm
```

The ConfigMaps are listed once at the start of the command, and that snapshot is used for the duration of the run.

### Air Traffic Controller

The ATC has custom readiness **enabled by default**. Rather than polling, it watches readiness ConfigMaps with a one-minute resync period, so definitions can be added, edited, or removed at any time and take effect without restarting the controller.

To turn it off, set `disableCustomReadiness` when deploying the ATC:

```bash
yoke takeoff atc oci://ghcr.io/yokecd/atc-installer:latest <<EOF
disableCustomReadiness: true
EOF
```
