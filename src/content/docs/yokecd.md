---
title: YokeCD
---

## GitOps: Yoke & ArgoCD

The Yoke CLI is analogous to the Helm CLI. It is a client-side tool that communicates with your cluster and keeps track of packages deployed to it. However, for many, that is not how we deploy packages anymore. Where the words _Platform Engineering_ are uttered, _GitOps_ is sure to follow.

To that end, we want to be able to write our Flights (programs that encapsulate a set of kubernetes packages as code) and have a continuous deployment tool, such as ArgoCD, manage our resources for us. Out of the box, ArgoCD supports Helm, Jsonnet, and Kustomize. To support more use cases, it accepts extensions via [config management plugins](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins).

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

To configure the yokecd-installer you can pass a yaml or json document over stdin:

```yaml
version: 0.6.0 # default is "latest"
argocd: {} # values are passed directly to the argocd chart.
```

Ready for takeoff?

```bash
yoke takeoff --create-namespace --namespace argocd yokecd oci://ghcr.io/yokecd/yokecd-installer:latest
```

### Patch an Existing ArgoCD Installation

If you already have an existing ArgoCD installation you must patch the argocd-repo-server with the yokecd sidecar image. To do so create the following manifest substituting any names to match your deployment:

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
          imagePullPolicy: IfNotPresent # use the imagePullPolicy that best fits your needs.
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
      volumes:
        - name: cmp-tmp
          emptyDir: {}
```

Once your file is created, let's call it `patch.yaml`, we can now proceed to patch the existing argocd deployment. We will assume in the following command that the argocd repo server deployment has name **argocd-repo-server** as per the standard installation. If this is not the case for your installation please substitute the name accordingly. We will also assume that ArgoCD is deployed in a namespace named **argocd**, if this is not the case please substitute accordingly once more.

```bash
kubectl patch deployments/argocd-repo-server --namespace=argocd --patch-file=patch.yaml
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
| wasm      | string  | The url to download or the relative location in the source repository to the Flight's wasm asset. Cannot be used when parameter **build** is enabled. |
| build     | string  | A boolean string signalling that the wasm should be compiled on the fly by yokecd using the Go Toolchain in the context of the Application's source. Cannot be used with parameter **wasm**. |
| input     | string  | The input that will be passed as stdin to the wasm executable upon execution.                                    |
| args      | []string| The args that will be passed to the Flight Executable upon execution.                                            |

**One of build or wasm must be specified.**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pg
  namespace: argocd
spec:
  project: default

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

        - name: input
          string: 'any-input-you-want'

  destination:
    name: in-cluster
    namespace: default

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

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
