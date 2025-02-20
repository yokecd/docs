---
title: Wasm as a package format
sidebar:
  order: 2
---

### Why Wasm?

Yoke's goal is to enable software engineers to write packages for Kubernetes as code. The issue is that code is not easy to package, and code itself is useless without its runtime or compiler. Yoke would need to be able to get the appropriate runtime or compiler for any language, and moreover, it would need to get those dependencies compiled for the correct architecture and OS as where Yoke is running. This would be an enormous task.

This leaves us with two options: either accept arbitrary input as packages or find a common target that many languages support. Yoke chooses both options.

### Arbitrary Input

The former allows us to support any runtime, even those that do not compile to wasm. This allows us to write Flights in our beloved dynamic languages:

```bash
# Deploy a Flight defined in Python
python3 app.py | yoke takeoff my-release

# Or in Javascript
node app.js | yoke takeoff my-release

# Or in Ruby
ruby app.rb | yoke takeoff my-release

# Or directly from a file
yoke takeoff my-release < resources.yaml
```

However, it comes with serious drawbacks:

- There are no physical assets that we can version and checksum against.
- Arbitrary programs are running in a context that has access to your Kubernetes cluster.

### Using Wasm

With wasm, we can solve all our problems, including the two mentioned above:

- We have a common target for multiple languages.
- A final asset that Yoke can track internally for changes.
- A runtime that is not dependent on OS/ARCH.
- A runtime that is sandboxed (cannot access the network or filesystem).

Wasm being sandboxed is a big deal for us. It eliminates side-effects such as IO and makes our programs predictable. It buys us a measure of security too, given that should a supply chain attack happen in the dependencies of your programs, an attacker would **not** have direct access to your filesystem, the network, or ultimately your K8s cluster.

Example:

```bash
GOOS=wasip1 GOARCH=wasm go build -o main.wasm ./my-flight
yoke takeoff my-release ./main.wasm
```


