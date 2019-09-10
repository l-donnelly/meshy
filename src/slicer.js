/* slicer.js */
import { GcodeExporter } from "./gcodeExporter.js";
import { Calculate } from './calculate.js'
import * as Utils from "./utils";
import { MCG } from "./mcg/mcg";

// src is either one THREE.Mesh or an array of them
class Slicer {
    constructor(src, params) {
        const meshes = Array.isArray(src) ? src : [src];

        const sourceGeo = new THREE.Geometry();

        // merge the input meshes into the slicer's own copy of the source geometry
        for (let m = 0; m < meshes.length; m++) {
            const mesh = meshes[m];
            if (!mesh) continue;

            sourceGeo.merge(mesh.geometry, mesh.matrixWorld);
        }

        this.sourceGeo = sourceGeo;
        this.sourceVertexCount = sourceGeo.vertices.length;
        this.sourceFaceCount = sourceGeo.faces.length;

        // set only the base parameters - need these to calculate mesh bounds and
        // slice count
        this.setBaseParams(params);

        // 1. assume right-handed coords
        // 2. look along negative this.axis with the other axes pointing up and right
        // then this.ah points right and this.av points up
        this.ah = Utils.cycleAxis(this.axis);
        this.av = Utils.cycleAxis(this.ah);

        // calculate upper and lower bounds of all faces and the entire mesh
        this.calculateFaceBounds();

        // calculate number of slices
        this.calculateNumSlices();

        // init layers to null
        this.sliceLayers = null;
        this.raftLayers = null;

        // set the rest of the parameters
        this.updateParams(params);

        this.currentLevel = this.getMaxLevel();

        // contains the geometry objects that are shown on the screen
        this.geometries = {};
        this.makeGeometry();

        // construct the layers array, which contains the lazily constructed contours
        this.makeLayers();
        // construct the raft layers
        this.makeRaftLayers();

        this.setMode(this.mode);
    }

    setParams(params = {}) {
        for (const p in Slicer.DefaultParams) {
            if (params.hasOwnProperty(p)) {
                this[p] = params[p];
            }
            else {
                this[p] = Slicer.DefaultParams[p];
            }
        }
    }

    // set only the base parameters
    setBaseParams(params) {
        const defaults = Slicer.DefaultParams;

        this.axis = params.axis || defaults.axis;
        this.layerHeight = params.layerHeight || defaults.layerHeight;
        this.lineWidth = params.lineWidth || defaults.lineWidth;
        this.precision = params.precision || defaults.precision;

        this.mode = params.mode || defaults.mode;
    }

    // update slicer params, handle the consequences of updating them, and return
    // those that were updated
    updateParams(params = {}) {
        const defaults = Slicer.DefaultParams;
        const updated = {};

        for (const p in defaults) {
            const hasParam = params.hasOwnProperty(p);
            let val = undefined;

            // if no initial value set, get one from params if present, else, from
            // defaults
            if (this[p] === undefined) val = hasParam ? params[p] : defaults[p];
            // else, if initial value set, only update if present in params
            else if (hasParam) val = params[p];

            if (val !== undefined && this[p] !== val) {
                this[p] = val;
                updated[p] = val;
            }
        }

        this.handleUpdatedParams(updated);

        return updated;
    }

    // if some params changed, they may require invalidating some existing data
    // structures
    handleUpdatedParams(params) {
        let raftUpdated = false;

        if (hasProp("numWalls")) {
            this.forEachSliceLayer(layer => {
                layer.unreadyWalls();
                layer.params.numWalls = params.numWalls;
            });
        }
        if (hasProp("numTopLayers") || hasProp("optimizeTopLayers")) {
            const numTopLayers = this.numTopLayers;
            this.forEachSliceLayer(layer => {
                layer.unreadyInfillContour();
                layer.params.numTopLayers = numTopLayers;
            });
        }
        if (hasProp("infillType")) {
            this.forEachSliceLayer(layer => {
                layer.unreadyInfill();
                layer.params.infillType = params.infillType;
            });
        }
        if (hasProp("infillDensity")) {
            if (this.infillDensity === 0) this.infillType = Slicer.InfillTypes.none;
            this.forEachSliceLayer(layer => {
                layer.unreadyInfill();
                layer.params.infillDensity = params.infillDensity;
            });
        }
        if (hasProp("infillOverlap")) {
            this.forEachSliceLayer(layer => {
                layer.unreadyInfillContour();
                layer.params.infillOverlap = params.infillOverlap;
            });
        }
        if (hasProp("makeRaft")
            || hasProp("raftNumTopLayers")
            || hasProp("raftNumBaseLayers")) {
            this.numRaftLayers = this.makeRaft ? this.raftNumBaseLayers + this.raftNumTopLayers : 0;
            raftUpdated = true;
        }
        if (hasProp("raftTopLayerHeight")
            || hasProp("raftTopDensity")
            || hasProp("raftBaseLayerHeight")
            || hasProp("raftBaseDensity")
            || hasProp("raftGap")
            || hasProp("raftOffset")) {
            raftUpdated = true;
        }

        if (raftUpdated) {
            this.calculateBaseline();
            this.floorToBaseline();
            this.makeRaftLayers();
        }

        function hasProp(name) { return params.hasOwnProperty(name); }
    }

    // map a function to all slice layers
    forEachSliceLayer(f) {
        if (!this.sliceLayers) return;

        for (let i = 0; i < this.sliceLayers.length; i++) {
            f(this.sliceLayers[i]);
        }
    }

    // map a function to all raft layers
    forEachRaftLayer(f) {
        if (!this.raftLayers) return;

        for (let i = 0; i < this.raftLayers.length; i++) {
            f(this.raftLayers[i]);
        }
    }

    // map a function to all layers
    forEachLayer(f) {
        this.forEachSliceLayer(f);
        this.forEachRaftLayer(f);
    }

    // called from constructor, calculates min and max for every face on the axis
    calculateFaceBounds() {
        const faceBounds = [];
        const axis = this.axis;
        const min = new THREE.Vector3().setScalar(Infinity);
        const max = new THREE.Vector3().setScalar(-Infinity);

        for (let i = 0; i < this.sourceFaceCount; i++) {
            const face = this.sourceGeo.faces[i];
            const bounds = Utils.faceGetBounds(face, this.sourceGeo.vertices);

            max.max(bounds.max);
            min.min(bounds.min);

            // store min and max for each face
            faceBounds.push({
                face: face.clone(),
                max: bounds.max[axis],
                min: bounds.min[axis]
            });
        }

        this.min = min;
        this.max = max;

        this.faceBoundsArray = faceBounds;
    }

    calculateNumSlices() {
        // first slice is half a slice height above mesh min and last slice is
        // strictly above mesh, hence +1
        const amax = this.max[this.axis];

        const amin = this.min[this.axis];
        this.numSlices = Math.floor(0.5 + (amax - amin) / this.layerHeight) + 1;
    }

    // calculate the lowest boundary of the print, including the raft
    calculateBaseline() {
        this.baseline = this.min[this.axis];
        if (this.makeRaft) {
            const raftTopHeight = this.raftTopLayerHeight * this.raftNumTopLayers;
            const raftBaseHeight = this.raftBaseLayerHeight * this.raftNumBaseLayers;
            this.baseline -= raftTopHeight + raftBaseHeight + this.raftGap;
        }
    }

    floorToBaseline() {
        if (this.baseline === undefined) this.calculateBaseline();

        const axis = this.axis;
        const baseline = this.baseline;
        const sourceVertices = this.sourceGeo.vertices;
        const faceBounds = this.faceBoundsArray;

        // shift all vertices
        for (var i = 0; i < this.sourceVertexCount; i++) {
            sourceVertices[i][axis] -= baseline;
        }

        this.sourceGeo.verticesNeedUpdate = true;

        // shift all computed face bounds
        for (var i = 0; i < this.sourceFaceCount; i++) {
            const bounds = faceBounds[i];
            bounds.min -= baseline;
            bounds.max -= baseline;
        }

        // shift mesh AABB
        this.min[axis] -= baseline;
        this.max[axis] -= baseline;

        // shift the context calculated for each layer
        this.forEachLayer(({context}) => {
            context.d -= baseline;
        });

        // b/c we just floored, the baseline is 0
        this.baseline = 0;
    }

    gcodeSave(params) {
        const filamentDiameter = params.filamentDiameter;
        const filamentCrossSection = filamentDiameter * filamentDiameter * Math.PI / 4;
        const axis = this.axis;
        const coincident = MCG.Math.coincident;

        const exporter = new GcodeExporter();

        exporter.setFilename(params.filename);
        exporter.setExtension(params.extension);
        exporter.setTravelSpeed(params.travelSpeed);
        exporter.setCoordPrecision(params.coordPrecision);
        exporter.setExtruderPrecision(params.extruderPrecision);

        exporter.init();

        exporter.writeHeader();
        exporter.writeNewline();

        exporter.writeHeatExtruder(params.temperature);
        exporter.writeAbsolutePositionionMode();
        exporter.writeNewline();
        exporter.writeComment("PRIME EXTRUDER");
        exporter.writePrimingSequence(params.primeExtrusion);

        let extruderPosition = exporter.e;

        const level0 = this.getMinLevel();
        const levelk = this.getMaxLevel();

        // write geometry for every layer
        for (let level = level0; level <= levelk; level++) {
            const layer = this.getLayer(level);

            const isRaft = level < 0;
            const isRaftBase = level < (level0 + this.raftNumBaseLayers);

            let layerHeight;
            let lineWidth;
            let wallSpeed;
            let infillSpeed;

            if (isRaft) {
                if (isRaftBase) {
                    layerHeight = this.raftBaseLayerHeight;
                    lineWidth = this.raftBaseLineWidth;
                    wallSpeed = params.wallSpeed;
                    infillSpeed = params.raftBasePrintSpeed;
                }
                else {
                    layerHeight = this.raftTopLayerHeight;
                    lineWidth = this.raftTopLineWidth;
                    wallSpeed = params.wallSpeed;
                    infillSpeed = params.raftTopPrintSpeed;
                }
            }
            else {
                layerHeight = this.layerHeight;
                lineWidth = this.lineWidth;
                wallSpeed = params.wallSpeed;
                infillSpeed = params.infillSpeed;
            }

            // ratio of cross-sections of printed line and filament; multiply by length
            // of segment to get how much to extrude
            const printCrossSection = layerHeight * lineWidth;
            var extrusionFactor = params.extrusionMultiplier * printCrossSection / filamentCrossSection;

            // duplicate context and shift its recorded position up by half a layer
            // height above the center line b/c that's where the extruder will be
            var context = layer.context.clone();
            context.d += layerHeight / 2;
            // constructor for converting intger-space vectors to physical vectors
            var constr = THREE.Vector3;

            // current position in integer-space coordinates; when encountering a new
            // segment to print and current position is not the same as its start point,
            // travel there first
            var ipos = null;

            exporter.writeNewline();
            exporter.writeComment(`LAYER ${level}`);
            if (isRaft) exporter.writeComment("RAFT");
            exporter.writeNewline();

            const infill = layer.getInfill();
            const infillInner = infill.inner;
            const infillSolid = infill.solid;

            // write inner infill
            writeContour(infillInner, infillSpeed);
            // write solid infill
            writeContour(infillSolid, infillSpeed);

            if (!isRaft || this.raftWriteWalls) {
                const walls = layer.getWalls();
                // write walls
                for (let w = walls.length - 1; w >= 0; w--) {
                    writeContour(walls[w], wallSpeed);
                }
            }
        }

        exporter.saveToFile();

        function writeContour(contour, speed) {
            if (!contour) return;

            contour.forEachPointPair((p1, p2) => {
                const v1 = p1.toVector3(constr, context);
                const v2 = p2.toVector3(constr, context);
                const extrusion = v1.distanceTo(v2) * extrusionFactor;
                extruderPosition += extrusion;

                if (ipos === null || !coincident(ipos, p1)) {
                    exporter.writeTravel(v1);
                }

                exporter.writePrint(v2, extruderPosition, speed);

                ipos = p2;
            });
        }
    }

    setMode(mode) {
        this.mode = mode;

        this.setLevel(this.currentLevel);
    }

    getMode() {
        return this.mode;
    }

    getGeometry() {
        return this.geometries;
    }

    getMinLevel() {
        return -this.numRaftLayers;
    }

    getMaxLevel() {
        return this.numSlices - 1;
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

    getLayer(level) {
        if (level >= 0) return this.sliceLayers[level];
        else return this.raftLayers[this.numRaftLayers + level];
    }

    getLevelPos(level) {
        return this.min[this.axis] + (level + 0.5) * this.layerHeight;
    }

    setLevel(level) {
        if (level === undefined) level = this.getCurrentLevel();
        level = Utils.clamp(level, this.getMinLevel(), this.getMaxLevel());

        const prevLevel = this.currentLevel;
        this.currentLevel = level;

        const layers = this.sliceLayers;
        const layer = this.getLayer(level);
        const context = layer.context;
        const axis = context.axis;

        const geos = this.geometries;

        // write the current layer if necessary for the mode and display settings
        if (this.mode !== Slicer.Modes.full || this.fullUpToLayer) {
            const currentLayerBaseGeo = geos.currentLayerBase.geo;
            const currentLayerContourGeo = geos.currentLayerContours.geo;
            const currentLayerInfillGeo = geos.currentLayerInfill.geo;

            const baseVertices = currentLayerBaseGeo.vertices;
            baseVertices.length = 0;
            layer.writeBase(baseVertices);

            var contourVertices = currentLayerContourGeo.vertices;
            contourVertices.length = 0;
            // write walls if slice level, or if raft level and writing raft walls
            if (level >= 0 || (level < 0 && this.raftWriteWalls)) {
                layer.writeWalls(contourVertices);
            }

            const infillVertices = currentLayerInfillGeo.vertices;
            infillVertices.length = 0;
            layer.writeInfill(infillVertices);
        }

        if (this.mode === Slicer.Modes.preview) {
            const slicePos = this.getLevelPos(level);
            const faceBoundsArray = this.faceBoundsArray;

            const vertices = this.sourceGeo.vertices;

            // local vars for ease of access
            const vertexCount = this.sourceVertexCount;
            const faceCount = this.sourceFaceCount;

            if (this.previewSliceMesh) {
                const position = geos.slicedMesh.geo.attributes.position;
                const normal = geos.slicedMesh.geo.attributes.normal;

                let idx = 0;

                for (let f = 0, l = this.faceBoundsArray.length; f < l; f++) {
                    const bounds = faceBoundsArray[f];
                    const face = bounds.face;

                    // if the face is entirely below the slicing plane, include it whole
                    if (bounds.max < slicePos) {
                        const verts = Calculate.faceVertices(face, vertices);

                        for (let v = 0; v < 3; v++) {
                            position.setX(idx, verts[v].x);
                            position.setY(idx, verts[v].y);
                            position.setZ(idx, verts[v].z);

                            normal.setX(idx, face.normal.x);
                            normal.setY(idx, face.normal.y);
                            normal.setZ(idx, face.normal.z);

                            idx += 1;
                        }
                    }
                    // else, if the face intersects the slicing plane, include one or two
                    // faces from slicing the face
                    else if (bounds.min < slicePos) {
                        this.sliceFace(face, vertices, slicePos, axis, ({x, y, z}, contour, A, B, C) => {
                            const verts = [A, B, C];

                            for (let v = 0; v < 3; v++) {
                                position.setX(idx, verts[v].x);
                                position.setY(idx, verts[v].y);
                                position.setZ(idx, verts[v].z);

                                normal.setX(idx, x);
                                normal.setY(idx, y);
                                normal.setZ(idx, z);

                                idx += 1;
                            }
                        });
                    }
                }

                position.needsUpdate = true;
                normal.needsUpdate = true;

                geos.slicedMesh.geo.setDrawRange(0, idx);
            }
        }
        else if (this.mode === Slicer.Modes.full) {
            const allContoursGeo = geos.allContours.geo;

            var contourVertices = allContoursGeo.vertices;
            contourVertices.length = 0;

            const topLevel = this.fullUpToLayer ? level - 1 : this.getMaxLevel();

            for (let i = this.getMinLevel(); i <= topLevel; i++) {
                const ilayer = this.getLayer(i);

                ilayer.writeWalls(contourVertices);

                if (this.fullShowInfill) ilayer.writeInfill(contourVertices);
            }
        }
    }

    makeGeometry() {
        const geos = this.geometries;

        geos.source = {
            geo: this.sourceGeo
        };
        geos.currentLayerContours = {
            geo: new THREE.Geometry()
        };
        geos.currentLayerBase = {
            geo: new THREE.Geometry()
        };
        geos.currentLayerInfill = {
            geo: new THREE.Geometry()
        };
        geos.allContours = {
            geo: new THREE.Geometry()
        };
        geos.slicedMesh = {
            geo: new THREE.Geometry()
        };

        geos.slicedMesh.geo = new THREE.BufferGeometry();

        // factor of 2 because each face may be sliced into two faces, so we need
        // to reserve twice the space
        const position = new Float32Array(this.sourceGeo.faces.length * 9 * 2);
        const normal = new Float32Array(this.sourceGeo.faces.length * 9 * 2);

        const positionAttr = new THREE.BufferAttribute(position, 3);
        const normalAttr = new THREE.BufferAttribute(normal, 3);

        geos.slicedMesh.geo.addAttribute('position', positionAttr);
        geos.slicedMesh.geo.addAttribute('normal', normalAttr);

        /*
        return;

        var vertices = this.sourceGeo.vertices;
        var faces = this.sourceGeo.faces;

        for (var f = 0; f < faces.length; f++) {
          var face = faces[f];

          var vs = [vertices[face.a], vertices[face.b], vertices[face.c]];

          for (var v = 0; v < 3; v++) {
            positionAttr.setX(f*3 + v, vs[v].x);
            positionAttr.setY(f*3 + v, vs[v].y);
            positionAttr.setZ(f*3 + v, vs[v].z);

            normalAttr.setX(f*3 + v, face.normal.x);
            normalAttr.setY(f*3 + v, face.normal.y);
            normalAttr.setZ(f*3 + v, face.normal.z);
          }
        }

        geos.slicedMesh.geo.setDrawRange(0, this.sourceGeo.faces.length * 3);
        */
    }

    makeLayers() {
        const numSlices = this.numSlices;
        const layers = new Array(numSlices);

        // arrays of segment sets, each array signifying all segments in one layer
        const segmentSets = this.buildLayerSegmentSets();
        const layerParamsInit = {
            lineWidth: this.lineWidth,
            numWalls: this.numWalls,
            numTopLayers: this.numTopLayers,
            optimizeTopLayers: this.optimizeTopLayers,
            infillType: this.infillType,
            infillDensity: this.infillDensity,
            infillOverlap: this.infillOverlap,
            infillConnectLines: false,
            layers,
            idx: -1
        };

        // make layers containing slices of the mesh
        for (let i = 0; i < segmentSets.length; i++) {
            const params = Utils.shallowCopy(layerParamsInit);
            params.idx = i;
            const layer = new Layer(params);
            layer.setSource(segmentSets[i]);

            layers[i] = layer;
        }

        this.sliceLayers = layers;
    }

    makeRaftLayers() {
        // if not making a raft or there are no layers on which to base it, return
        if (!this.makeRaft || !this.sliceLayers) {
            this.raftLayers = null;
            return;
        }

        const numRaftLayers = this.numRaftLayers;
        const raftNumTopLayers = this.raftNumTopLayers;
        const raftNumBaseLayers = this.raftNumBaseLayers;
        const raftLayers = new Array(numRaftLayers);
        const raftBaseLayerHeight = this.raftBaseLayerHeight;
        const raftTopLayerHeight = this.raftTopLayerHeight;
        const raftBaseHeight = raftNumBaseLayers * raftBaseLayerHeight;

        // get the lowest slice layer and offset it to use as the base for the raft
        const sourceLayer = this.getLayer(0);
        const sourceOffset = sourceLayer.getBase().foffset(this.raftOffset, this.lineWidth);
        const base = MCG.Boolean.union(sourceOffset).union.toPolygonSet();
        const gap = this.raftGap;
        const baseline = this.baseline;

        const layerParamsInit = {
            lineWidth: this.lineWidth,
            numWalls: this.numWalls,
            numTopLayers: 0,
            infillType: Slicer.InfillTypes.lines,
            infillDensity: 1,
            infillOverlap: this.infillOverlap,
            // connect neighboring lines if not writing walls
            infillConnectLines: !this.raftWriteWalls,
            layers: raftLayers,
            idx: -1
        };

        for (let i = 0; i < numRaftLayers; i++) {
            const isBase = i < raftNumBaseLayers;

            let levelPos = baseline;
            if (isBase) {
                levelPos += (i + 0.5) * raftBaseLayerHeight;
            }
            else {
                levelPos += raftBaseHeight + (i - raftNumBaseLayers + 0.5) * raftTopLayerHeight;
            }

            const context = new MCG.Context(this.axis, levelPos, this.precision);

            // make params object with correct density and idx
            const params = Utils.shallowCopy(layerParamsInit);

            if (isBase) params.infillDensity = this.raftBaseDensity;
            else params.infillDensity = this.raftTopDensity;
            params.idx = i;

            const layer = new Layer(params);
            layer.setBase(base);
            layer.setContext(context);

            raftLayers[i] = layer;
        }

        this.raftLayers = raftLayers;
    }

    // SLICING THE MESH INTO PATHS

    // uses an implementation of "An Optimal Algorithm for 3D Triangle Mesh Slicing"
    // http://www.dainf.ct.utfpr.edu.br/~murilo/public/CAD-slicing.pdf

    // build arrays of faces crossing each slicing plane
    buildLayerFaceLists() {
        const layerHeight = this.layerHeight;
        const faceBoundsArray = this.faceBoundsArray;
        const min = this.min[this.axis];

        const numSlices = this.numSlices;

        // position of first and last layer
        const layer0 = min + layerHeight / 2;
        const layerk = layer0 + layerHeight * (numSlices);

        // init layer lists
        const layerLists = new Array(numSlices);
        for (var i = 0; i < numSlices; i++) layerLists[i] = [];

        // bucket the faces
        for (var i = 0; i < this.sourceFaceCount; i++) {
            const bounds = faceBoundsArray[i];
            let idx;

            /*if (bounds.min < layer0) idx = 0;
            else if (bounds.min > layerk) idx = numSlices;
            else idx = Math.ceil((bounds.min - layer0) / layerHeight);*/

            idx = Math.ceil((bounds.min - layer0) / layerHeight);

            layerLists[idx].push(i);
        }

        return layerLists;
    }

    // build segment sets in each slicing plane
    buildLayerSegmentSets() {
        const layerLists = this.buildLayerFaceLists();

        // various local vars
        const numSlices = layerLists.length;
        const faceBoundsArray = this.faceBoundsArray;
        const axis = this.axis;
        const min = this.min[axis];
        const layerHeight = this.layerHeight;
        const vertices = this.sourceGeo.vertices;
        const faces = this.sourceGeo.faces;

        const segmentSets = new Array(numSlices);

        // running set of active face indices as we sweep up along the layers
        let sweepSet = new Set();

        for (let i = 0; i < numSlices; i++) {
            // height of layer from mesh min
            const slicePos = this.getLevelPos(i);

            // reaching a new layer, insert whatever new active face indices for that layer
            if (layerLists[i].length>0) sweepSet = new Set([...sweepSet, ...layerLists[i]]);

            const context = new MCG.Context(axis, slicePos, this.precision);

            // accumulate segments for this layer
            const segmentSet = new MCG.SegmentSet(context);

            // for each index in the sweep list, see if it intersects the slicing plane:
            //  if it's below the slicing plane, eliminate it
            //  else, store its intersection with the slicing plane
            for (const idx of sweepSet) {
                const bounds = faceBoundsArray[idx];

                if (bounds.max < slicePos) sweepSet.delete(idx);
                else {
                    this.sliceFace(bounds.face, vertices, slicePos, axis, (normal, contour, A, B) => {
                        if (!contour) return;

                        const segment = new MCG.Segment(context);
                        segment.fromVector3Pair(A, B, normal);
                        segmentSet.add(segment);
                    });
                }
            }

            segmentSets[i] = segmentSet;
        }

        return segmentSets;
    }

    // slice a face at the given level and then call the callback
    // callback arguments:
    //  normal: face normal
    //  contour: true if first two points border the slice plane
    //  P, Q, R: three CCW-wound points forming a triangle
    sliceFace(face, vertices, level, axis, callback) {
        // in the following, A is the bottom vert, B is the middle vert, and XY
        // are the points where the triangle intersects the X-Y segment

        const normal = face.normal;

        // get verts sorted on axis; check if this flipped winding order (default is CCW)
        const vertsSorted = Utils.faceGetVertsSorted(face, vertices, axis);
        const [A, B, C] = vertsSorted.verts;
        const ccw = vertsSorted.ccw;

        // if middle vert is greater than slice level, slice into 1 triangle A-AB-AC
        if (B[axis] > level) {
            // calculate intersection of A-B and A-C
            const AB = segmentPlaneIntersection(axis, level, A, B);
            var AC = segmentPlaneIntersection(axis, level, A, C);

            if (ccw) callback(normal, true, AB, AC, A);
            else callback(normal, true, AC, AB, A);
        }
        // else, slice into two triangles: A-B-AC and B-BC-AC
        else {
            // calculate intersection of A-C and B-C
            var AC = segmentPlaneIntersection(axis, level, A, C);
            const BC = segmentPlaneIntersection(axis, level, B, C);

            if (ccw) {
                callback(normal, false, A, B, AC);
                callback(normal, true, BC, AC, B);
            }
            else {
                callback(normal, false, B, A, AC);
                callback(normal, true, AC, BC, B);
            }
        }

        // intersection between line segment and plane normal to axis
        function segmentPlaneIntersection(axis, level, va, vb) {
            if (axis === undefined) axis = 'z';

            // if equal, just return va
            if (va[axis] === vb[axis]) return va;

            // calculate linear interpolation factor; note that, as checked above, the
            // denominator will be positive
            const t = (level - va[axis]) / (vb[axis] - va[axis]);
            // difference vector
            const d = vb.clone().sub(va);
            // interpolate
            return va.clone().addScaledVector(d, t);
        }
    }
}

Slicer.Modes = {
    preview: "preview",
    full: "full"
};

Slicer.InfillTypes = {
    none: 0,
    solid: 1,
    lines: 2,
    grid: 4,
    triangles: 8,
    hex: 16,
    // mask for all infill types that consist of lines that don't need to be
    // connected to each other
    disconnectedLineType: 1 | 4 | 8
};

Slicer.DefaultParams = {
    // base params
    axis: "z",
    layerHeight: 0.1,
    lineWidth: 0.1,
    precision: 5,
    mode: Slicer.Modes.preview,

    numWalls: 2,
    numTopLayers: 3,
    optimizeTopLayers: true,
    infillType: Slicer.InfillTypes.none,
    infillDensity: 0.1,
    infillOverlap: 0.5,

    makeRaft: true,
    raftNumTopLayers: 3,
    raftTopLayerHeight: 0.05,
    raftTopLineWidth: 0.05,
    raftTopDensity: 1.0,
    raftNumBaseLayers: 1,
    raftBaseLayerHeight: 0.1,
    raftBaseLineWidth: 0.1,
    raftBaseDensity: 0.5,
    raftOffset: 1.0,
    raftGap: 0.05,
    raftWriteWalls: false,

    // display params; these determine how much to compute
    previewSliceMesh: false,
    fullUpToLayer: true,
    fullShowInfill: false
};

// contains a single slice of the mesh
class Layer {
    constructor(params) {
        // store parameters
        this.params = params;
        this.context = null;

        // source geometry - base and everything else is derived from this
        this.source = null;

        // base contour, decimated and unified
        this.base = null;

        // internal contours for printing
        this.walls = null;

        // main contour containing the infill
        this.infillContour = null;

        // if infill is not solid, some regions may be filled with that infill, but
        // some might need solid infill b/c they're exposed to air above or below:
        // inner contour can be filled with the specified infill type; solid infill
        // is filled with solid infill
        this.disjointInfillContours = null;

        // set of segments containing the mesh infill
        this.infill = null;
    }

    // readiness checks for various components
    baseReady() { return this.base !== null; }

    wallsReady() { return this.walls !== null; }
    infillContourReady() { return this.infillContour !== null; }
    disjointInfillContoursReady() { return this.disjointInfillContours !== null;}
    infillReady() { return this.infill !== null; }

    // unready components and the components derived from them
    unreadyInfill() {
        this.infill = null;
    }

    unreadyDisjointInfillContours() {
        this.disjointInfillContours = null;
        this.unreadyInfill();
    }

    unreadyInfillContour() {
        this.infillContour = null;
        this.unreadyDisjointInfillContours();
    }

    unreadyWalls() {
        this.walls = null;
        this.unreadyInfillContour();
    }

    unreadyBase() {
        this.base = null;
        this.unreadyWalls();
    }

    // getters for geometry

    getSource() {
        return this.source;
    }

    getBase() {
        this.computeBase();
        return this.base;
    }

    getWalls() {
        this.computeWalls();
        return this.walls;
    }

    getInfillContour() {
        this.computeInfillContour();
        return this.infillContour;
    }

    getDisjointInfillContours() {
        this.computeDisjointInfillContours();
        return this.disjointInfillContours;
    }

    getInfill() {
        this.computeInfill();
        return this.infill;
    }

    // setters for geometry

    setSource(source) {
        this.source = source;
        this.context = source.context;
        return this;
    }

    setBase(base) {
        this.base = base;
        this.context = base.context;
        return this;
    }

    setInfillContour(infillContour) {
        this.infillContour = infillContour;
        this.context = base.context;
        return this;
    }

    setContext(context) {
        this.context = context;
        return this;
    }

    computeBase() {
        if (this.baseReady()) return;

        const lineWidth = this.params.lineWidth;

        const sourceDecimated = this.getSource().toPolygonSet().fdecimate(lineWidth);
        const base = MCG.Boolean.union(sourceDecimated).union.toPolygonSet();

        this.base = base;
    }

    computeWalls() {
        if (this.wallsReady()) return;

        const lineWidth = this.params.lineWidth;
        const lineWidthsq = lineWidth * lineWidth;
        const numWalls = this.params.numWalls;

        const walls = [];
        let contour = this.getBase();

        for (let w = 0; w < numWalls; w++) {
            // inset the first contour by half line width, all others by full width,
            // from the preceding contour
            const dist = (w === 0 ? -0.5 : -1) * lineWidth;

            const offset = contour.foffset(dist, lineWidth);
            const union = MCG.Boolean.union(offset).union.toPolygonSet();//.filter(areaFilterFn);
            walls.push(union);

            contour = union;
        }

        this.walls = walls;

        function areaFilterFn(poly) { return poly.areaGreaterThanTolerance(lineWidthsq); }
    }

    computeInfillContour() {
        if (this.infillContourReady()) return;

        const lineWidth = this.params.lineWidth;
        const numWalls = this.params.numWalls;
        const overlapFactor = 1.0 - this.params.infillOverlap;

        let source;
        let dist;

        if (this.wallsReady()) {
            source = this.walls[this.walls.length-1];
            dist = lineWidth * overlapFactor;
        }
        else {
            source = this.getBase();
            dist = lineWidth * (numWalls + overlapFactor - 0.5);
        }

        this.infillContour = MCG.Boolean.union(source.foffset(-dist, lineWidth)).union;
    }

    computeDisjointInfillContours() {
        if (this.disjointInfillContoursReady()) return;

        const layers = this.params.layers;
        const idx = this.params.idx;
        const idxk = layers.length-1;
        const numTopLayers = this.params.numTopLayers;
        const context = this.context;
        const contour = this.getInfillContour();

        // if number of top layers is 0, don't fill any part of any layer with solid
        // infill - just use inner infill for everything
        if (numTopLayers === 0) {
            this.disjointInfillContours = {
                inner: contour,
                solid: new MCG.SegmentSet(context)
            };
        }
        // else, if the layer is within numTopLayers of the top or bottom, fill the
        // whole layer with solid infill
        else if ((idx < numTopLayers) || (idx > idxk - numTopLayers)) {
            this.disjointInfillContours = {
                inner: new MCG.SegmentSet(context),
                solid: contour
            };
        }
        // else, it has at least numTopLayers layers above and below, calculate infill
        // from those
        else {
            const neighborContours = new MCG.SegmentSet(context);
            let numLayers = 0;

            // if optimizing top layer computation (and there are more than 2 top
            // layers), only use the adjacent layers and the farthest layers
            if (this.params.optimizeTopLayers && numTopLayers > 2) {
                neighborContours.merge(layers[idx + 1].getInfillContour());
                neighborContours.merge(layers[idx - 1].getInfillContour());
                neighborContours.merge(layers[idx + numTopLayers].getInfillContour());
                neighborContours.merge(layers[idx - numTopLayers].getInfillContour());

                numLayers = 4;
            }
            else {
                for (let i = 1; i <= numTopLayers; i++) {
                    neighborContours.merge(layers[idx + i].getInfillContour());
                    neighborContours.merge(layers[idx - i].getInfillContour());
                }

                numLayers = numTopLayers * 2;
            }

            const fullDifference = MCG.Boolean.fullDifference(contour, neighborContours, {
                minDepthB: numLayers
            });

            this.disjointInfillContours = {
                inner: fullDifference.intersection.toPolygonSet().filter(sliverFilterFn),
                solid: fullDifference.AminusB.toPolygonSet().filter(sliverFilterFn)
            };
        }

        function sliverFilterFn(poly) { return !poly.isSliver(); }
    }

    computeInfill() {
        if (this.infillReady()) return;

        const lineWidth = this.params.lineWidth;
        let type = this.params.infillType;
        const density = this.params.infillDensity;
        const connectLines = this.params.infillConnectLines;

        // if grid infill and density is too high, use solid infill instead
        if (type === Slicer.InfillTypes.grid && density >= 1.0) {
            type = Slicer.InfillTypes.solid;
        }

        const iLineWidth = MCG.Math.ftoi(lineWidth, this.context);
        const iLineWidthsq = iLineWidth*iLineWidth;
        let infillInner = null;
        let infillSolid = null;

        // if solid infill, just fill the entire contour
        if (type === Slicer.InfillTypes.solid) {
            const infillContour = this.getInfillContour();

            infillSolid = MCG.Infill.generate(infillContour, MCG.Infill.Types.linear, {
                angle: Math.PI / 4,
                spacing: iLineWidth,
                parity: this.params.idx%2,
                connectLines
            });
        }
        // if other infill, need to determine where to fill with that and where to
        // fill with solid infill
        else {
            const disjointInfillContours = this.getDisjointInfillContours();

            const innerContour = disjointInfillContours.inner;
            const solidContour = disjointInfillContours.solid;

            if (type === Slicer.InfillTypes.lines) {
                infillInner = MCG.Infill.generate(innerContour, MCG.Infill.Types.linear, {
                    angle: Math.PI / 4,
                    spacing: iLineWidth / density,
                    parity: this.params.idx%2,
                    connectLines
                });
            }
            else if (type === Slicer.InfillTypes.grid) {
                infillInner = MCG.Infill.generate(innerContour, MCG.Infill.Types.grid, {
                    angle: Math.PI / 4,
                    spacing: iLineWidth / density,
                    connectLines
                });
            }

            infillSolid = MCG.Infill.generate(solidContour, MCG.Infill.Types.linear, {
                angle: Math.PI / 4,
                spacing: iLineWidth,
                parity: this.params.idx%2,
                connectLines
            });
        }

        if (infillInner !== null) infillInner.filter(lengthFilterFn);
        if (infillSolid !== null) infillSolid.filter(lengthFilterFn);

        this.infill = {
            inner: infillInner,
            solid: infillSolid
        };

        function lengthFilterFn(segment) { return segment.lengthSq() >= iLineWidthsq / 4; }
    }

    writeBase(vertices) {
        const context = this.context;
        const base = this.getBase();
        let count = 0;

        if (base) {
            base.forEachPointPair((p1, p2) => {
                vertices.push(p1.toVector3(THREE.Vector3, context));
                vertices.push(p2.toVector3(THREE.Vector3, context));
                count += 2;
            });
        }

        return count;
    }

    writeWalls(vertices) {
        const context = this.context;
        const walls = this.getWalls();
        let count = 0;

        if (walls) {
            for (let w = 0; w < walls.length; w++) {
                walls[w].forEachPointPair((p1, p2) => {
                    vertices.push(p1.toVector3(THREE.Vector3, context));
                    vertices.push(p2.toVector3(THREE.Vector3, context));
                    count += 2;
                });
            }
        }

        return count;
    }

    writeInfill(vertices) {
        const context = this.context;
        const infill = this.getInfill();
        const infillInner = infill.inner;
        const infillSolid = infill.solid;
        let count = 0;

        if (infillInner) {
            infillInner.forEachPointPair((p1, p2) => {
                vertices.push(p1.toVector3(THREE.Vector3, context));
                vertices.push(p2.toVector3(THREE.Vector3, context));
                count += 2;
            });
        }

        if (infillSolid) {
            infillSolid.forEachPointPair((p1, p2) => {
                vertices.push(p1.toVector3(THREE.Vector3, context));
                vertices.push(p2.toVector3(THREE.Vector3, context));
                count += 2;
            });
        }

        return count;
    }
}

export { Slicer }