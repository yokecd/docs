---
title: Helm Compatibility
sidebar:
  order: 4
---

## Overview

Although Yoke has the potential to change how we write Kubernetes Packages, as of today and for the past almost 10 years, kubernetes package management has been dominated by [Helm](https://helm.sh). Yoke has no chance of succeeding if it cannot build off of Helm and provide a migration path forward.

At its core, a Yoke Flight is a piece of software that generates Kubernetes resources. In that way, even a Helm Chart is a subset of Flights. From that vantage point, our Flight needs to accomplish two things to be compatible with Helm:

- Embed a Chart.
- Render the Chart with some values.

At the time of this writing, Yoke provides Go packages to accomplish the above items simply and easily.

### Disclaimer

The following examples are built in Go. This is partly due to the ease of using Go Embedding, but mostly because Yoke and Helm are written in Go. The reader is expected to be familiar with Go Embedding.

## Embedding a Chart as a Zipped Archive

The Yoke helm package supplies a function for creating a Chart from it's embedded archive. Suppose you wanted to use the [bitnami redis chart](oci://registry-1.docker.io/bitnamicharts/redis) from Yoke. The first step is to download the archive using helm.

```bash
helm pull oci://registry-1.docker.io/bitnamicharts/redis --version 18.17.0
```

This will create a tar file on your machine such as **redis-18.17.0.tgz**. From there you embed it into your application, and invoke it using the name of the release, destination k8s namespace, and any values you wish to pass to it.

```go
package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"

  "github.com/yokecd/yoke/pkg/flight"
	"github.com/yokecd/yoke/pkg/helm"
)

//go:embed redis-18.17.0.tgz
var archive []byte

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	chart, err := helm.LoadChartFromZippedArchive(archive)
	if err != nil {
		return fmt.Errorf("failed to load chart from zipped archive: %w", err)
	}

	resources, err := chart.Render(
    flight.Release(),
		flight.Namespace(),
		// Arguments as described by the bitnami redis chart.
		// Any value that serializes to equivalent json will work.
		map[string]any{"auth": map[string]any{"enabled": "false"}},
	)
	if err != nil {
		return fmt.Errorf("failed to render chart: %w", err)
	}

	return json.NewEncoder(os.Stdout).Encode(resources)
}
```

## Progressive Migration via Chart FS Embedding

The advantage of embedding a zipped archive is that it is simpler to get started and use the chart. It's a great approach when you want to wrap a Chart, or combine multiple Charts into one. Its major problem is that we can't modify the Chart, which is key when we want to port the logic out of the chart and into code. For this purpose, Yoke provides the ability to load a chart from an embedded filesystem.

Continuing from our previous example, let's untar the archive:

```bash
tar xvf redis-18.17.0.tgz
```

We should now have a directory called **redis** containing the Chart's contents. With a small tweak of our previous example we can now use this folder to create our Chart instance directly in our Flight.

```go
// the "all:" prefix is important, otherwise Go will not embed hidden and private files
//go:embed all:redis
var chartFS embed.FS
```

```go
chart, err := helm.LoadChartFromFS(chartFS)
if err != nil {
	return fmt.Errorf("failed to load chart from zipped archive: %w", err)
}
```

From here, now you can iterate on your flight, slowly porting the template rendering logic into code.

## Generating Flights from Chart Repos Automatically

Embedding charts and rendering their contents via Yoke works well enough. Doing those steps by hand isn't a lot of work, but why not automate it? While we are at it, is there anything we can gain from an automated approach?

Yoke provides a utility command called **helm2go**. To install it run:

```bash
go install github.com/yokecd/yoke/cmd/helm2go@latest
```

The utility is a wrapper over:

- helm for pulling charts (requires helm to be installed in $PATH)
- bitnami's [readme-generator-for-helm](https://github.com/bitnami/readme-generator-for-helm) which converts a Chart's values.yaml into a json schema (requires a NodeJS Runtime 16+)
- [go-jsonschema](https://github.com/atombender/go-jsonschema) for converting jsonschema definitions to Go Types (requires the Go Toolchain to be present to install the library if not present)

Together, all these tools allow us to generate Flight packages directly from a Chart URL:

```bash
helm2go --repo=oci://registry-1.docker.io/bitnamicharts/mongodb --outdir=flights/mongodb
```

Then we can simply use the generated **mongodb** package to handle all the boilerplate of instantiating and executing the Chart, plus provide inferred typings directly from the Chart.

```go
package main

import (
	"encoding/json"
	"os"

  "github.com/yokecd/yoke/pkg/flight"
	"github.com/yokecd/yoke/cmd/examples/internal/flights/mongodb"
)

func main() {
	resources, err := mongodb.RenderChart(flight.Release(), flight.Namespace(), &mongodb.Values{
		// ... values ...
	})
	if err != nil {
		panic(err)
	}
	json.NewEncoder(os.Stdout).Encode(resources)
}
```
```` ▋
