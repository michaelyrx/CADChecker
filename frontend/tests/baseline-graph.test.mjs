import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from '../node_modules/typescript/lib/typescript.js';

const source = readFileSync(new URL('../app/lib/baseline-graph.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { emptyGraph, appendGraphRegion } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const region = { page: 1, regionId: 'p1-r1', rect: { x: 0, y: 0, width: 1000, height: 1000 }, overview: { width: 1000, height: 1000 }, display: { width: 500, height: 500 } };
const item = (id, label, extra = {}) => ({ id, label, type: 'circle', bbox: [100, 100, 200, 200], confidence: 0.9, ...extra });

test('builds linked object and annotation inventory with source evidence', () => {
  const graph = appendGraphRegion(emptyGraph(), { views: [item('v1', 'Front')], features: [item('f1', 'Boss', { viewId: 'v1' })], objectRelations: [], annotations: [item('a1', 'Ø20', { viewId: 'v1', rawText: 'Ø20', graphics: ['diameter line', 'two arrows'] })], annotationRelations: [{ id: 'r1', label: 'Diameter controls boss', type: 'diameter', sourceIds: ['a1'], targetIds: ['f1'], confidence: 0.9 }] }, region);
  assert.equal(graph.features[0].viewId, graph.views[0].id);
  assert.deepEqual(graph.annotationRelations[0].sourceIds, [graph.annotations[0].id]);
  assert.deepEqual(graph.annotationRelations[0].targetIds, [graph.features[0].id]);
  assert.equal(graph.annotations[0].visualPageLocation.box.x, 50);
  assert.equal(graph.reviewItems.length, 0);
});

test('queues ambiguous annotation and relation endpoints for review', () => {
  const graph = appendGraphRegion(emptyGraph(), { views: [], features: [], objectRelations: [], annotations: [item('a1', '0.8', { confidence: 0.4, uncertainty: 'target unclear' })], annotationRelations: [{ id: 'r1', label: 'candidate link', type: 'dimension', sourceIds: ['a1'], targetIds: ['missing'], confidence: 0.5 }] }, region);
  assert(graph.reviewItems.some(value => value.targetId === graph.annotations[0].id && value.reason.includes('target')));
  assert(graph.reviewItems.some(value => value.targetId === graph.annotationRelations[0].id));
});

test('rejects incomplete response instead of silently accepting partial inventory', () => {
  assert.throws(() => appendGraphRegion(emptyGraph(), { views: [], features: [] }, region), /incomplete object graph/);
  assert.throws(() => appendGraphRegion(emptyGraph(), { views: [item('x', 'A'), item('x', 'B')], features: [], objectRelations: [], annotations: [], annotationRelations: [] }, region), /duplicate/);
});
