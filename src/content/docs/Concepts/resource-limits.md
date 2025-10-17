---
title: Resource Limits
---

Yoke `Flights` differ from other configuration-based packages because they are *runnable code*.  
While using WebAssembly (WASM) solves many of the traditional challenges of executing code—such as safety and portability—it’s still important to be conscious of what we’re running.

When executing flights, especially third-party ones, there are two key resource dimensions to consider: **memory** and **CPU/time**.

## Memory

By default, memory is effectively unbounded, aside from the 32-bit WASM architecture limit of **4 GiB** of addressable memory.  
In other words, a flight can allocate memory freely up to that limit; any allocation beyond it will fail.

However, this upper bound is far greater than what’s typically needed for computing Kubernetes resources. Memory usage can be a meaningful concern in server-side environments such as the **Yoke AirTrafficController** or the **YokeCD Plugin Server**.

To prevent excessive usage, you can limit the memory available to a flight in one of three ways:

- Using the `--max-memory-mib` flag with the **Yoke CLI**
- Setting `maxMemoryMib` in an **Airway specification**
- Defining it as a **parameter** in an **ArgoCD Application plugin**

### Yoke CLI

The following example limits a flight to **10 MiB** of memory:

```bash
yoke takeoff --max-memory-mib 10 foo oci://example/module:1.0.0
```

### Airway Specification

```yaml
apiVersion: yoke.cd/v1alpha1
kind: Airway
metadata:
  name: foos.examples.com
spec:
  maxMemoryMib: 10
  wasmUrls:
    flight: oci://example/module:1.0.0
  # ...
```

### ArgoCD Plugin Parameter

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: example
  namespace: argocd
spec:
  project: default
  source:
    plugin:
      name: yokecd
      parameters:
        - name: maxMemoryMib
          string: '10'
```

## Time

A typical flight executes in milliseconds. Depending on its size and complexity, this could be tens of milliseconds, or even hundreds if it needs to make many calls to the Kubernetes API across the WASI boundary.

However, mistakes can happen. A flight could accidentally enter an infinite loop, and the halting problem is famously unsolved, making it impossible to know for sure if a program will ever finish.

Therefore, Yoke flights have a default timeout of 10 seconds. You can adjust this value using the `--timeout` flag.
