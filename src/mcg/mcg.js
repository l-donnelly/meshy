/*
  Meshy computational geometry namespace.
*/
import * as adjacencyMap from "./adjacencyMap"
import * as Boolean from "./boolean"
import * as Generate from "./generate"
import {Context} from "./context";
import {Vector} from "./vector";
import {GeometrySet} from "./geometrySet";
import * as Infill from "./infill";
import * as Math from "./math";
import {Polygon} from "./polygon"
import {PolygonSet} from "./polygonSet"
import {Segment} from "./segment"
import {SegmentSet} from "./segmentSet"
import * as Sweep from "./sweep";
import * as SweepEvent from "./sweepEvent";
import {Operations} from "./sweepOperations";
import {Types} from "./types"

const MCG = {};

MCG.Types = Types;

// namespaces
MCG.Math = Math;
MCG.Sweep = Sweep;
MCG.Boolean = Boolean;
MCG.Infill = Infill;

MCG.Context = Context;
MCG.Generate = Generate;
MCG.GeometrySet = GeometrySet;
MCG.Polygon = Polygon;
MCG.PolygonSet = PolygonSet;
MCG.Segment = Segment;
MCG.SegmentSet = SegmentSet;
MCG.Sweep.Operations = Operations;
MCG.SweepEvent = SweepEvent;
MCG.Vector = Vector;

MCG.AdjacencyMap = adjacencyMap.AdjacencyMap;
MCG.DirectedAdjacencyMap = adjacencyMap.DirectedAdjacencyMap;
MCG.AdjacencyMapNode = adjacencyMap.AdjacencyMapNode;

export { MCG }