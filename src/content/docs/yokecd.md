---
title: YokeCD
---

## GitOps: Yoke & ArgoCD

The Yoke CLI is analogous to the Helm CLI. It is a client-side tool that communicates with your cluster and keeps track of packages deployed to it. However, for many, that is not how we deploy packages anymore. Where the words _Platform Engineering_ are uttered, _GitOps_ is sure to follow.

To that end, we want to be able to write our Flights (programs that encapsulate a set of Kubernetes packages as code) and have a continuous deployment tool, such as ArgoCD, manage our resources for us. Out of the box, ArgoCD supports Helm, Jsonnet, and Kustomize. To support more use cases, it accepts extensions via [config management plugins](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins).

YokeCD is the official yoke config management plugin for ArgoCD. It allows you to write ArgoCD Applications but have their source evaluated by yoke's embedded wasm interpreter (wazero). The **yokecd plugin** supports a variety of setups:

- Invoke a local wasm binary found in the application's source.
- Invoke a remote wasm binary downloaded from an http/https url.
- Compile an application's source on the fly and evaluate it using the Go Toolchain.
- Configure any invocation of the binary with flags and standard input defined in the plugin's definition.

## Introducing YokeCD

To be compatible with ArgoCD, Yoke offers an ArgoCD CPM Sidecar Docker image hosted at [ghcr.io/yokecd/yokecd](https://github.com/yokecd/yoke/pkgs/container/yokecd).

## Installing YokeCD Sidecar

### Fresh ArgoCD Installation

The yoke project maintains a Flight called the **yokecd-installer** that wraps the [ArgoCD Chart 7.7.16](https://github.com/argoproj/argo-helm/releases/tag/argo-cd-7.7.16). The Flight patches the argocd-repo-server by adding the yokecd sidecar to it, thus rendering the plugin available to argocd applications.

To configure the `yokecd-installer` you can pass a YAML or JSON document over stdin:

```yaml
# values.yaml
image: ghcr.io/yokecd/yokecd    # default
version: 0.15.0                 # default is "latest"
dockerAuthSecretName: my-secret # see below
yokecd:
  resources: {}                 # normal limits and requests for the yokecd-plugin container.
yokecdServer:
  cacheTTL: 1h                  # default is 24h. Setting it to 0 reduces the cache to its collection time
  cacheCollectionInterval: 5s   # default is 10s. This is the interval at which the cache will check and remove wasm modules from memory
  resources: {}                 # normal limits and requests for the yokecd-server container
argocd: {}                      # values are passed directly to the argocd chart
```

Ready for takeoff?

```bash
yoke takeoff --create-namespace --namespace argocd yokecd oci://ghcr.io/yokecd/yokecd-installer:latest < values.yaml
```

### Patch an Existing ArgoCD Installation

If you already have an existing ArgoCD installation you must patch the argocd-repo-server with the yokecd sidecar image. To do so, create the following manifest, substituting any names to match your deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: YOUR-ARGOCD-REPO-SERVER-NAME    # typically "argocd-repo-server", possibly with a prefix if installed via helm.
  namespace: YOUR-ARGOCD-NAMESPACE-NAME # typically "argocd"
spec:
  template:
    spec:
      containers:
        - name: yokecd
          image: ghcr.io/yokecd/yokecd:latest # or any version you prefer
          imagePullPolicy: IfNotPresent # use the imagePullPolicy that best fits your needs
          command:
            - /var/run/argocd/argocd-cmp-server
          securityContext: # required by argocd cmp spec. Must be user 999.
            runAsNonRoot: true
            runAsUser: 999
          volumeMounts:
            - name: var-files
              mountPath: /var/run/argocd
            - name: plugins
              mountPath: /home/argocd/cmp-server/plugins
            - name: cmp-tmp
              mountPath: /tmp
        - name: yokecd-svr
          image: ghcr.io/yokecd/yokecd:latest # or any version you prefer
          imagePullPolicy: IfNotPresent # use the imagePullPolicy that best fits your needs
          command:
            - yokecd
            - '-svr'
          env:
            # control the time-to-live of your modules
            - name: YOKECD_CACHE_TTL
              value: 24h
            # controls the interval at which the cache is pruned
            # this corresponds to the maximum amount of time an expired module may stay in memory before being removed
            # also serves as a debounce window for concurrent module invocations even when the cache ttl is set to 0.
            - name: YOKECD_CACHE_COLLECTION_INTERVAL
              value: 10s
      volumes:
        - name: cmp-tmp
          emptyDir: {}
```

Once your file is created, let's call it `patch.yaml`, we can now proceed to patch the existing argocd deployment. We will assume in the following command that the argocd repo server deployment has name **argocd-repo-server** as per the standard installation. If this is not the case for your installation please substitute the name accordingly. We will also assume that ArgoCD is deployed in a namespace named **argocd**, if this is not the case please substitute accordingly once more.

```bash
kubectl patch deployments/argocd-repo-server --namespace=argocd --patch-file=patch.yaml
```

### Docker auth secret
If your Flights are in a private repository, or generally behind a Docker login, you need to create a Docker auth config. To do this, first manually create a Kubernetes Secret with the given credentials:

```bash
kubectl create secret docker-registry -n $ARGOCD_NAMESPACE \
  $SECRET_NAME \
  --docker-username=$USERNAME \
  --docker-server=$URL \
  --docker-password=$PASSWORD 
```

Then, either use the `dockerAuthSecretName` parameter for `yokecd-installer`:

```yaml
// values.yaml
dockerAuthSecretName: $SECRET_NAME
```

Or add the additional configuration to the `argo-repo-server` Deployment patch defined above (keep the rest of the patch file!):

```yaml
// patch.yaml
# ...
spec:
  template:
    containers:
      - name: yokecd
        # ...
        volumeMounts:
          - name: docker-auth-secret
            mountPath: /docker/config.json
            subPath: .dockerconfigjson
        env:
          - name: DOCKER_CONFIG
            value: /docker
    volumes:
      - name: docker-auth-secret
        secret:
          secretName: $SECRET_NAME
```

## Creating YokeCD Applications

YokeCD applications are normal ArgoCD Applications that use the yokecd plugin.

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
# ... and all other required fields
```

### Parameters

In order to use and configure the plugin, we must pass parameters to it. The following parameters are supported:

| Parameter | Type    | Description                                                                                                      |
|-----------|---------|------------------------------------------------------------------------------------------------------------------|
| `wasm`      | string  | The url to download or the relative location in the source repository to the Flight's wasm asset. Cannot be used when parameter `build` is enabled. |
| `build`     | string  | A boolean string signalling that the wasm should be compiled on the fly by yokecd using the Go Toolchain in the context of the Application's source. Cannot be used with parameter `wasm`. |
| `input`     | string  | The input that will be passed as stdin to the wasm executable upon execution. This has top-most priority over other `input` parameters                                    |
| `input`     | map[string]string | A map of values or overrides to be passed to the underlying Flight on stdin. Supports a variant of JSON path as keys, and also complex YAML/JSON values as values |
| `inputFiles` | []string | An array of paths for files to be used as parameters of the underlying Flight |
| `args`      | []string| The args that will be passed to the Flight Executable upon execution.                                            |

**One of `build` or `wasm` must be specified.**

#### Note on the input parameters
In order to make the plugin flexible, similarly to how Helm handles values, we support a hierarchy of input parameters. In order of precedence (most precedent to least):
```
input (string) >> input (map) > inputFiles (latter elements > former elements)
```
That means, that:
- `input` parameter with type `string` will just override anything else, without any processing
- parameter `inputFiles` will read all listed files (YAML or JSON), internally parse them and merge them, together with `input` of type `map`, **encode into JSON** and pass it on stdin to the underlying Flight

So in order for your Flight to respect these parameters, it should read your desired parameter structure as JSON from stdin and work with that.

### Example
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pg
  namespace: argocd
spec:
  project: default
  destination:
    name: in-cluster
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
  source:
    repoURL: https://github.com/davidmdm/yokecd-demo
    path: ./cmd/pg
    targetRevision: main
    plugin:
      name: yokecd
      parameters:
        # Will use the asset found at https://github.com/davidmdm/yokecd-demo/cmd/pg/main.wasm.gz
        # at revision main.
        #
        # This parameter cannot be used at the same time as "build"
        - name: wasm
          string: main.wasm.gz # Alternatively can be a url for example:
                               # https://github.com/org/repo/releases/downloads/v1.0.0/main.wasm
                               # If this is the case the application's source is not used.

        # Will build the wasm executable using the Go Toolchain with the source specified by the application.
        # The source must be a Go Module or inside a Go module.
        #
        # This parameter cannot be used at the same time as "wasm"
        - name: build
          string: 'true'

        - name: args
          array: ["--key=value", "positional-arg"]

        # this will override any other `input*` parameters, do not combine them
        - name: input
          string: 'any-input-you-want'

        # these files will be read relative to the source URL, path, revision
        # in this case `https://github.com/davidmdm/yokecd-demo/cmd/pg/{values.yaml, overrides.json}`
        - name: inputFiles
          array:
            - values.yaml
            - overrides.json

        # you can use this parameter to override anything read from `inputFiles` or add new properties
        # for examples, see below
        - name: input
          map:
            another: simple
            override: foo
```

### Input map parameter
ArgoCD's Content Management Plugin spec limits you in what you can write into the `map` type parameter. By definition, it's a `map[string]string`, meaning you can only use strings as the values, and you cannot put any arbitrary structure into the values directly (like Helm's `valuesObject`). 

However, you can achieve almost the same complexity by utilizing JSON paths and JSON/YAML values, see following example:
```yaml
- name: input
  map:
    # you can override/add any simple properties
    property: value
    newProperty: value
    # you can override/add nested properties
    nested.property: value
    # you can override array elements (with 0-based indices)
    array.0: value
    arrayOfObjects.0.property: value
    # you can append items to arrays with a special `-1` index (only once however, that would lead to duplicate keys in this map)
    arrayOfObjects.-1.property: value
    # in order to set more complex values, you can use JSON or YAML format (note the quotes or the `|` character)
    jsonObject: '{"some": "value"}'
    jsonObjectMultiline: |
      {
        "some": "value"
      }
    yamlObject: |
      some: value
      nested:
        value: foo
    # data types - booleans and numbers have to be quoted, but are parsed as respective types in the output JSON
    bool: "true"              # will turn into: "bool": true
    number: "42"              # will turn into: "number": 42
    # unless double quoted (then they're forced strings)
    boolString: '"true"'      # will turn into: "boolString": "true"
    numberString: '"42"'      # will turn into: "numberString": "42"
    # in YAML/JSON, the string quoting on booleans/numbers works normally, no need for additional quoting
    jsonTypes: |
      {
        "bool": true,
        "boolString": "true",
        "num": 42,
        "numString": "42"
      }
    yamlTypes: |
      bool: true
      boolString: "true"
      num: 42
      numString: "42"

```
For more examples of the JSON path syntax, see https://github.com/tidwall/sjson/

## YokeCD Service Catalog

When using ArgoCD, it is common to use the app of apps pattern, and have a root application watch a repository for more applications. Any repository that contains Flight programs can deploy them with ArgoCD via the **yokecd plugin**.

The following is an example structure of a service catalog with two releases: alpha and beta. Both releases are described as Go programs and contain an ArgoCD Application manifest that would use the **yokecd plugin with build parameter**.

```bash
services
├── alpha
│   ├── app.yaml
│   └── main.go
├── beta
│   ├── app.yaml
│   └── main.go
├── go.mod
└── go.sum
```

Other setups are possible, and any service repository can be mixed and matched with regular ArgoCD Applications.

## ArgoCD Config Management Plugin Architecture Overview

ArgoCD allows users to extend its manifest generation capabilities via [config management plugins](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins/).
These work by adding a new sidecar container to the `argocd-repo-server`, providing the required transformation logic.

The plugin image must include the gRPC server provided by ArgoCD,
along with a plugin manifest that defines the command used to generate manifests from an application.

A fundamental limitation of this design is that the plugin process is short-lived — it runs, writes resources to stdout, and exits.

For Yoke, a system that relies on external WASM modules to represent package logic, this presents a problem. Every sync would require downloading and compiling the WASM module, which can lead to slow syncs, sometimes several seconds, depending on the binary size.

What we really want is a long-lived service that can handle module fetching, compilation, caching, and execution.

That’s why the YokeCD plugin is installed as two containers:

- A **plugin container**, which invokes the `yokecd` binary in plugin mode for each sync request.
- A **server container** (`yokecd-server`), which runs a persistent HTTP service responsible for managing and executing WASM modules.

This design enables module caching across syncs, significantly reducing average sync time for Yoke-backed applications — from several seconds down to tens of milliseconds.
