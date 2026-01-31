# Architecture Overview

## Project Structure

The codebase is organized to separate domain logic from storage implementation, making it easy to support multiple storage backends (Soukai+Solid, local storage, etc.).

### Directory Organization

```
src/
├── models/              # Domain models and logic (library-agnostic)
│   ├── TaskClass.ts     # Core task domain model
│   ├── TaskGraph.ts     # Task relationship graph structure
│   └── task-operations.ts # Helper functions for task/graph operations
│
├── storage/             # Storage adapters (pluggable backends)
│   ├── types.ts         # Storage adapter interface
│   └── soukai/          # Soukai-specific implementation
│       ├── Task.model.ts      # Soukai RDF model
│       ├── soukai-storage.ts  # Storage adapter implementation
│       └── namespaces.ts      # RDF namespaces
│
├── solid/               # Solid protocol layer
│   └── config.ts        # Authentication configuration
│
├── stores/              # Pinia state management
├── composables/         # Vue composables
├── components/          # Vue components
├── utils/               # Generic helper functions
│   ├── datetime.ts      # Date/time utilities
│   └── url.ts           # URL utilities
│
└── views/               # Vue views/pages
```

## Key Design Principles

### 1. Separation of Concerns

- **Domain Layer** (`models/`): Contains business logic and data structures that are independent of any storage mechanism
- **Storage Layer** (`storage/`): Implements adapters that persist domain models to various backends
- **Protocol Layer** (`solid/`): Handles Solid-specific concerns (authentication, pod discovery)

### 2. Storage Abstraction

The `TaskStorageAdapter` interface in `storage/types.ts` defines the contract for any storage backend:

- Load tasks with relationships
- Save individual or multiple tasks
- Delete tasks

Current implementation uses Soukai (`storage/soukai/`) for RDF serialization and Solid Pod storage.

### 3. Future Extensibility

To add a new storage backend (e.g., local storage):

1. Create a new directory under `storage/` (e.g., `storage/local/`)
2. Implement the `TaskStorageAdapter` interface
3. Update composables to use the appropriate adapter

### 4. Domain Model Independence

`TaskClass` and `TaskGraph` in `models/` have no dependencies on:

- RDF libraries (Soukai)
- Solid protocol
- Storage mechanisms

They can be used with any storage backend or even in a different project.

## Data Flow

1. **Loading**: Storage adapter → Domain models → Pinia store → Vue components
2. **Saving**: Vue components → Pinia store → Domain models → Storage adapter

The composables (`composables/useSolidTasks.ts`) orchestrate this flow, bridging Vue's reactivity system with the storage layer.
