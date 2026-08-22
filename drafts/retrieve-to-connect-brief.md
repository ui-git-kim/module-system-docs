# Design brief — retrieve-to-connect (graph-aware extraction)

Status: DRAFT for the **engine session** (cognitive-db), with a smaller cog-ingest follow-up (§7).
Prompted by Kim after reading "Knowledge Graphs from Complex Text" (Vijayan) and Mark Burgess's
Semantic-Spacetime / intent-and-context essays.

## 1. The idea

Today the engine extracts entities and relationships from each document **in isolation**: it is
*type*-aware (it receives the ontology's entity-types / relationship-types as context) but not
*instance*-aware — it does not know which entity **instances** already exist in the graph. So the
same real-world entity gets re-minted per document and cross-document connections are only recovered
later (by dedup / similarity), if at all.

**Retrieve-to-connect** closes that: before extraction, semantically search the existing graph for
related entity instances (and their salient relationships) and feed them to the extraction op as
context, so the model (a) **links** a new mention to the existing node instead of duplicating it, and
(b) **connects** the new content to prior knowledge. This is retrieval-augmented extraction / entity
linking. It is the single biggest lever on graph *coherence* across a corpus.

(Burgess's articles reinforce the surrounding design rather than this step directly: keep the source
NL alongside the graph — already done; converge/merge rather than clobber — the engine's never-decay +
dedup ethos; and rank/associate by *intent* — which the working-memory co-activation edges already
approximate. His actionable contribution is the **Semantic-Spacetime relationship typing** in §6.)

## 2. Where it lives — the engine

The engine owns extraction, connection discovery, entity resolution and the ontology, and it already
holds graph access through the injected `StructureAdapter` (`semanticSearchNodes` / `findSimilarNodes`
/ `getNodeConnections`) plus the op context contract. So retrieve-to-connect is **self-contained in
the engine's `ingestViaStructure` path** — cog-ingest needs no change for the core step (it already
hands the engine the content). The op contract is ~90% shaped for it already: `extract-entities`
receives `role:'context'` items today; this adds one more.

## 3. The step (engine `ingestViaStructure`)

After the content is acquired + embedded, before the `extract-entities` call:

1. **Query vector.** Use the new content's embedding — the node summary vector, or the mean/top of its
   chunk vectors for a long document. (Open Q: summary vs top-chunks — see §8.)
2. **Search existing entities.** `semanticSearchNodes(userId, queryVector, { topK, minScore,
   nodeTypes: <entity types> })` over the existing graph, **excluding the just-created node/subtree**.
   Optionally also a chunk search for background passages (§7).
3. **Expand (optional).** For the top hits, `getNodeConnections` → their salient existing relationships,
   so the model sees "X exists AND X relates to Y", not just a bag of names.
4. **Assemble a compact context block** — for each related entity: `name`, `type`, stable `id`, and 1–3
   key relationships. Token-bounded (drop the tail past the budget; never truncate mid-entity).
5. **Pass as a `role:'context'` item** with a new marker `cognitive-db/related-entities`.
6. `extract-entities` **and** `extract-entities-with-proposals` receive it.

The engine's existing **dedup still runs afterwards** — retrieve-to-connect raises the *link rate* at
extraction time; dedup remains the backstop for anything the model misses. Additive, not a replacement.

## 4. Contract changes (engine operations catalogue)

The catalogue (`COGNITIVE_DB_OPERATIONS`, which cog-ingest seeds verbatim) needs:

- A new **marker** `cognitive-db/related-entities` with a `meaning` along the lines of: *"Entities that
  already exist in the knowledge graph and are semantically related to this content. Use their exact
  names/ids when the content refers to them so the extraction links to the existing node instead of
  creating a duplicate; prefer connecting new entities to these where the content supports it."* (It
  is trusted reference context — same class as `ontology` — not injection-fenced input.)
- The marker wired into the **runtime `role:'context'` items** for `extract-entities` /
  `-with-proposals` (the engine emits it at run time; the item list per op is already documented in
  `operations.ts`).
- **Objective/approach text** updated (see §6). No new *input* item — the primary input is still the
  content; related-entities is context.

Because cog-ingest already seeds markers + ops from the catalogue, shipping this is purely: reshape the
catalogue + emit the new context item at run time. No cog-ingest change for the marker/op.

## 5. Scope + safety (REQUIRED — do not skip)

The retrieval must respect the same boundaries cog-ingest's `retrieve()` fixed in v1.21.13:

- **userId isolation** (solo-business: `tenantId === userId`).
- **Active-scope confinement** — only surface entities within the user's active scope
  (`structure_node.rootNodeId` = the enforced-space / matter root), so a document ingested under matter
  A never pulls matter B's entities into its extraction context.
- **Read-permission exclusion** — respect `getUnreadableTypes` so unreadable node types never leak in.

**Dependency:** the engine's adapter-backed graph searches (`structure-adapter.ts` `semanticSearchNodes`
/ `findSimilarNodes`) are currently **unscoped** (the open B1 follow-up — cog-ingest's own `retrieve()`
is scoped, the engine's graph-build searches are not). Retrieve-to-connect makes scoping those searches
a hard requirement, not a nicety: thread `excludeNodeTypes` / `scopeRootId` into the engine's node
search (the embeddings service already accepts both). Resolve that alongside this.

Degrade-safe: an empty result (first ingest, empty graph, search unavailable) → extraction runs exactly
as today.

## 6. Semantic-Spacetime relationship typing (ontology + prompt)

Burgess's point: an ever-growing relationship ontology makes reasoning + traversal harder. Ground the
relationship types in a **small set of spacetime super-types** — roughly **contains** (aggregation /
part-of), **follows** (sequence / causation / reference), **expresses** (properties / attributes),
**near** (similarity / association) — and let domain relationship types layer *under* them (a
`cited_by` *is-a* follows; `part_of` *is-a* contains). Structure already gives node types a
`superClasses` hierarchy; connection types could get the same, with the four SST types as roots.

- **Shared prompt (seeded op):** ask the model to tag each relationship's **spacetime nature** (one of
  the four) alongside the specific domain type, and to **link to the provided existing entities**.
- **Domain vocabulary stays out of the prompt** — it flows as context (see §7).

## 7. App-specific extraction guidance as config-driven context (Kim's admin-fields idea) — cog-ingest

Keep the **shared seeded prompt generic and reusable across apps**. Anything app- or source-specific —
the domain entity/relationship vocabulary, extraction focus, SST-mapping hints, house instructions —
should be **admin-configurable and flow as a `role:'context'` item**, never hardcoded into the prompt.
This is already true for entity-types / relationship-types (cog-ingest's per-source config → the
`entity-types` / `relationship-types` context). Extend the same pattern:

- **Home:** cog-ingest's **per-source config** (the ingest-source admin already carries `entityTypes`,
  `relationshipTypes`, `extractionContext`). Add an **"extraction guidance"** field (free text, and/or
  structured relationship→SST hints) that flows into the ingest call as an `additional-context` item.
- **Why per-source, not per-op:** the AI Core op is shared/global; the guidance is per-app / per-source,
  so it belongs on cog-ingest's source config and rides in as context, not on the op's seeded segments.
- **Result:** one generic extract-entities op, tuned per source by config — exactly the AI Core
  "purpose + context, not a bespoke prompt" model, extended to the domain vocabulary.

This is the small **cog-ingest follow-up**: a source-config field + wiring it into the context the
engine receives. The engine just consumes another context item.

## 8. Build order + open questions

**Order:** (1) engine node-level retrieve-to-connect + the `related-entities` marker + the prompt/typing
tweak (the biggest lever), with §5 scoping done at the same time; (2) cog-ingest extraction-guidance
source-config field → context (§7); (3) SST connection-type super-types in the ontology (§6) — optional,
can follow.

**Open questions for the engine session:**
- Query vector: the node summary vector, or mean/top of chunk vectors, for a long document?
- `topK` / `minScore` defaults for the related-entity search; token budget for the context block.
- Node-level entities only, or also a chunk-level background pass (reuse cog-ingest's hybrid
  `retrieve()` for passages, vs the engine's own node search for linking)?
- Do the four SST super-types get seeded as real connection-type roots now, or is the spacetime tag just
  a data field on each relationship for now?
- Does retrieve-to-connect run for every op that benefits (extract-concepts / infer-implicit also read
  prior entities), or only extract-entities?
