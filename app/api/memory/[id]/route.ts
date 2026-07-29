import { getConnector } from "@/lib/integrations/registry";
import type { EntityDetail, TimelineItem } from "@/lib/memory/types";
import { expand } from "@/lib/retrieval";

/**
 * One memory, with the graph and the evidence around it. This is what makes an
 * answer inspectable: every claim can be opened and walked outwards.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const result = await expand(id);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });

  const { entity, edges, related, evidence } = result;
  const byId = new Map(related.map((e) => [e.id, e]));

  // How this memory came to be known, oldest first.
  const timeline: TimelineItem[] = [
    ...entity.sources.map((source, i) => ({
      at: source.occurredAt,
      kind: (i === entity.sources.length - 1 ? "learned" : "corroborated") as TimelineItem["kind"],
      label:
        i === entity.sources.length - 1
          ? `First learned from ${getConnector(source.integrationId)?.name ?? source.integrationId}`
          : `Corroborated by ${getConnector(source.integrationId)?.name ?? source.integrationId}`,
      sourceType: source.sourceType,
      integrationId: source.integrationId,
      eventId: source.eventId,
    })),
    ...edges.map((edge) => {
      const otherId = edge.fromId === entity.id ? edge.toId : edge.fromId;
      return {
        at: edge.createdAt,
        kind: "linked" as const,
        label: `${edge.type.replace(/_/g, " ")} ${byId.get(otherId)?.title ?? "another memory"}`,
        entityId: otherId,
      };
    }),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const detail: EntityDetail = {
    entity,
    timeline,
    related: edges.flatMap((edge) => {
      const otherId = edge.fromId === entity.id ? edge.toId : edge.fromId;
      const node = byId.get(otherId);
      if (!node) return [];
      return [
        {
          direction: (edge.fromId === entity.id ? "out" : "in") as "in" | "out",
          type: edge.type,
          note: edge.note,
          confidence: edge.confidence,
          entity: {
            id: node.id,
            type: node.type,
            title: node.title,
            summary: node.summary,
            confidence: node.confidence,
          },
        },
      ];
    }),
    evidence: evidence.map((event) => ({
      id: event.id,
      integrationId: event.integrationId,
      integrationName: getConnector(event.integrationId)?.name ?? event.integrationId,
      sourceType: event.sourceType,
      title: event.title,
      body: event.body,
      author: event.author,
      occurredAt: event.occurredAt,
      url: event.url,
    })),
  };

  return Response.json(detail);
}
