import { verifiedManualFacts } from "@/app/lib/baselines";
import { verifiedPathAssociation } from "@/app/lib/path-association";
import { failure, readDb, updateDb, type DrawingFactKind } from "@/app/lib/store";
export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await updateDb(db => {
      const index = db.baselines.findIndex(value => value.id === id);
      if (index < 0) throw new Error("Baseline not found");
      if (db.baselines[index].status !== "draft") throw new Error("Only draft baselines can be deleted");
      if (db.baselineComparisons.some(value => value.baselineId === id)) throw new Error("Baseline has comparisons");
      db.baselines.splice(index, 1);
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Baseline not found") return failure(message, 404);
    if (message === "Only draft baselines can be deleted" || message === "Baseline has comparisons") return failure(message, 409);
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { action?: unknown; factId?: unknown; observationId?: unknown; graphId?: unknown; review?: unknown; page?: unknown; kind?: unknown; quote?: unknown; pathId?: unknown } | null;
  if (input?.action !== "review" && input?.action !== "review-observation" && input?.action !== "review-graph" && input?.action !== "approve" && input?.action !== "add" && input?.action !== "correct" && input?.action !== "link-path" && input?.action !== "unlink-path") return failure("Invalid baseline action");
  if (input.action === "review" && (typeof input.factId !== "string" || !["confirmed", "rejected"].includes(String(input.review)))) return failure("Invalid fact review");
  if (input.action === "review-observation" && (typeof input.observationId !== "string" || !["confirmed", "rejected"].includes(String(input.review)))) return failure("Invalid observation review");
  if (input.action === "review-graph" && (typeof input.graphId !== "string" || !["confirmed", "rejected"].includes(String(input.review)))) return failure("Invalid graph review");
  if (input.action === "add" && (typeof input.page !== "number" || typeof input.kind !== "string" || typeof input.quote !== "string")) return failure("Invalid drawing fact");
  if (input.action === "correct" && (typeof input.factId !== "string" || typeof input.quote !== "string" || input.quote.trim().length < 3 || input.quote.trim().length > 300 || typeof input.kind !== "string" || !["identity", "view_label", "dimension_text", "gdt_text", "technical_note"].includes(input.kind))) return failure("Invalid visual correction");
  if (input.action === "link-path" && (typeof input.factId !== "string" || typeof input.pathId !== "string" || !/^P\d+-V\d+$/.test(input.pathId))) return failure("Invalid path association");
  if (input.action === "unlink-path" && typeof input.factId !== "string") return failure("Invalid path association");
  try {
    const current = input.action === "add" || input.action === "link-path" ? (await readDb()).baselines.find(item => item.id === id) : undefined;
    if ((input.action === "add" || input.action === "link-path") && !current) return failure("Baseline not found", 404);
    const added = input.action === "add" && current ? await verifiedManualFacts(current, input.page as number, input.kind as DrawingFactKind, input.quote as string) : null;
    const linkFact = input.action === "link-path" ? current?.facts.find(item => item.id === input.factId) : undefined;
    if (input.action === "link-path" && !linkFact) return failure("Fact not found", 404);
    const association = current && linkFact ? await verifiedPathAssociation(current, linkFact, input.pathId as string) : null;
    const baseline = await updateDb(db => {
      const item = db.baselines.find(value => value.id === id);
      if (!item) throw new Error("Baseline not found");
      if (item.status !== "draft") throw new Error("Approved baseline cannot be changed");
      if (input.action === "add") {
        if (!added?.length) throw new Error("Invalid drawing fact");
        const newFacts = added.filter(fact => !item.facts.some(value => value.page === fact.page && value.kind === fact.kind && value.quote.toLocaleLowerCase() === fact.quote.toLocaleLowerCase() && value.textOrigin?.x === fact.textOrigin?.x && value.textOrigin?.y === fact.textOrigin?.y));
        if (!newFacts.length) throw new Error("Fact already exists");
        item.facts.push(...newFacts);
      } else if (input.action === "link-path") {
        const fact = item.facts.find(value => value.id === input.factId);
        if (!fact) throw new Error("Fact not found");
        if (!association || item.analysisRunId !== association.analysisRunId || item.sourceSha256 !== association.sourceSha256 || fact.review !== "confirmed" || fact.kind !== linkFact?.kind || fact.quote !== linkFact?.quote || JSON.stringify(fact.textOrigin) !== JSON.stringify(linkFact?.textOrigin) || fact.sourceMethod !== "pdf_text" || !fact.nearbyPaths?.some(value => value.id === association.pathId && JSON.stringify(value.bbox) === JSON.stringify(association.bbox))) throw new Error("Baseline changed during path review");
        fact.pathAssociation = association;
        fact.pathAssociationHistory ||= [];
        fact.pathAssociationHistory.push({ action: "linked", pathId: association.pathId, at: association.confirmedAt });
      } else if (input.action === "unlink-path") {
        const fact = item.facts.find(value => value.id === input.factId);
        if (!fact) throw new Error("Fact not found");
        if (!fact.pathAssociation) throw new Error("No path association to clear");
        fact.pathAssociationHistory ||= [];
        fact.pathAssociationHistory.push({ action: "cleared", pathId: fact.pathAssociation.pathId, at: new Date().toISOString() });
        delete fact.pathAssociation;
      } else if (input.action === "correct") {
        const fact = item.facts.find(value => value.id === input.factId);
        if (!fact) throw new Error("Fact not found");
        if (fact.sourceMethod !== "vision") throw new Error("Only visual facts can be corrected here");
        fact.quote = (input.quote as string).trim(); fact.kind = input.kind as DrawingFactKind; fact.review = "pending"; fact.confidence = 0.55;
      } else if (input.action === "review") {
        const fact = item.facts.find(value => value.id === input.factId);
        if (!fact) throw new Error("Fact not found");
        fact.review = input.review as "confirmed" | "rejected";
        if (fact.review === "rejected" && fact.pathAssociation) {
          fact.pathAssociationHistory ||= [];
          fact.pathAssociationHistory.push({ action: "cleared", pathId: fact.pathAssociation.pathId, at: new Date().toISOString() });
          delete fact.pathAssociation;
        }
      } else if (input.action === "review-observation") {
        const observation = item.observations?.find(value => value.id === input.observationId);
        if (!observation) throw new Error("Observation not found");
        observation.review = input.review as "confirmed" | "rejected";
      } else if (input.action === "review-graph") {
        const collections = item.graph && [item.graph.views, item.graph.features, item.graph.objectRelations, item.graph.annotations, item.graph.annotationRelations];
        const graphItem = collections?.flat().find(value => value.id === input.graphId);
        if (!graphItem) throw new Error("Graph item not found");
        graphItem.review = input.review as "confirmed" | "rejected";
      } else {
        const graphItems = item.graph && [item.graph.views, item.graph.features, item.graph.objectRelations, item.graph.annotations, item.graph.annotationRelations].flat() || [];
        if (item.promptVersion === "baseline-object-graph-v11" && (!graphItems.length || item.partialText)) throw new Error("Object inventory or drawing coverage is incomplete");
        if (item.facts.some(value => value.review === "pending") || item.observations?.some(value => value.review === "pending") || graphItems.some(value => value.review === "pending") || !item.facts.some(value => value.review === "confirmed") && !item.observations?.some(value => value.review === "confirmed") && !graphItems.some(value => value.review === "confirmed")) throw new Error("Review every candidate and confirm at least one before approval");
        item.status = "approved";
        item.approvedAt = new Date().toISOString();
      }
      return structuredClone(item);
    });
    return Response.json(baseline);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Baseline not found" || message === "Fact not found" || message === "Observation not found" || message === "Graph item not found") return failure(message, 404);
    if (["Approved baseline cannot be changed", "Object inventory or drawing coverage is incomplete", "Review every candidate and confirm at least one before approval", "Fact already exists", "Only visual facts can be corrected here", "Confirm a locatable annotation before linking a path", "Path is not a candidate for this annotation", "Path candidate no longer matches the analysis source", "Baseline changed during path review", "No path association to clear"].includes(message)) return failure(message, 409);
    if (["Invalid drawing fact", "Fact quote is not in the PDF text", "Analysis text source is invalid", "Analysis vector source is invalid"].includes(message)) return failure(message);
    throw error;
  }
}
