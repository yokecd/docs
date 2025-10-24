---
title: Schematics
---

**Flight Schematics** are a feature in Yoke that allow authors to embed rich metadata directly into their WASM Flight modules. This addresses a common challenge with binary formats: **discoverability**. Instead of being an opaque binary blob, a Flight can become self-contained and self-documenting.

### The Problem

One of the challenges with WASM as a package format is that the binary is not human-readable. This makes it difficult for users to discover essential information about the package—such as configuration options, documentation, or licensing.

This is often contrasted with text-based formats like Helm charts, which are considered more "declarative." In practice, this "declarative" nature often means users are left parsing a `values.yaml` file filled with a mix of data and comments, or relying on a JSON schema that may not even exist. It’s not uncommon for users to end up searching for external documentation just to understand a chart’s inputs.

Since Yoke uses self-contained WASM modules as its package format, it needs a different approach.

### The Solution: Yoke Schematics

Yoke Schematics provide a standardized solution by leveraging a core feature of WebAssembly itself.

A WASM module is composed of “sections.” One of these is the **Custom Section**, which allows arbitrary data to be stored inside the `.wasm` file. Yoke uses this capability to store named metadata properties called **schematics**.

Schematics can be stored in one of two forms:

#### Static Schematics (Raw Data)

This is the simplest form. You provide a name (e.g., `readme` or `license`) and embed arbitrary text data directly. This is ideal for static content such as:

* README files  
* Documentation  
* Licenses  
* Checksums  

#### Dynamic Schematics (Command-Based)

Instead of storing static data, you can define a **command**—a JSON or YAML array of string arguments. When a user requests this schematic, Yoke executes your Flight’s WASM module with those arguments. The standard output (`stdout`) of that execution becomes the schematic data.

This powerful feature allows you to dynamically generate metadata directly from your Flight’s code. A common use case is generating an input schema for your Flight based on its static types.

---

### CLI Usage: `yoke schematics`

The `yoke schematics` command (alias: `meta`) provides tools to read and write schematic data to and from WASM modules.

#### Authentication

Authentication with private OCI registries (for fetching remote modules) is handled through your local keychain. Ensure you are logged in using `docker login <registry>` before accessing private modules.

#### Command Structure

```sh
yoke schematics --wasm <wasmURL> <subcommand> [..args]
#### Command Structure

```sh
yoke schematics --wasm <wasmURL> <subcommand> [..args]
```

#### Subcommands and Examples

**`ls`**

* **Action:** Lists all available schematic property names in a module.
* **Example:**
    ```sh
    yoke schematics --wasm module.wasm ls
    ```

**`get <name>`**

* **Action:** Prints the data for a specific schematic by name. If the schematic is command-based, this will execute the module to generate the data.
* **Example:**
    ```sh
    # "docs" is the schematic name; it can be any property supported by the module.
    yoke schematics --wasm module.wasm get docs
    ```

**`set <name>`**

* **Action:** Sets the value of a **static (raw data)** schematic property on a **local** WASM module. Remote modules are not supported for this subcommand. The data must be passed via `STDIN`.
* **Example:**
    ```sh
    yoke schematics --wasm module.wasm set docs < ./docs.txt
    ```

**`set --cmd <name>`**

* **Action:** Sets a schematic as a **dynamic (command-based)** property. The input must be a JSON or YAML array of strings passed via `STDIN`.
* **Example:**
    ```sh
    # Sets the command to be executed as '[--docs]'
    yoke schematics --wasm module.wasm set --cmd docs <<< '[--docs]'
    ```

#### Flags

* `--wasm string`
    * Specifies the path or URL to the WASM file. Local paths, `http(s)://` URLs, and `oci://` URLs are supported.
