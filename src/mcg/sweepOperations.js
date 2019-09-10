import {SegmentSet} from "./segmentSet"
import * as Sweep from "./sweep";
import { EventPositionFlags } from "./sweepEvent"

 // adds a new segment set to the result object with the given name
 function resultAddSet(result, context, name) {
        result[name] = new SegmentSet(context);

        return result;
    }

    // assign values to store, from sweep params if provided
    function assignParams(store, params = {}) {
        setProp("minDepthA", 1);
        setProp("minDepthB", 1);
        setProp("handleIntersections", true);
        setProp("dbg", false);

        function setProp(name, def) {
            store[name] = params.hasOwnProperty(name) ? params[name] : def;
        }
    }

    // makes an object containing the init function and event handler
 function makeOperation(initStore, handleEvent) {
        const op = params => ({
            initStore(context, srcA, srcB) {
                return initStore(context, srcA, srcB, params);
            },

            handleEvent
        });

        return op;
    }



    // operation store initialization functions

     function unionInit(context, srcA, srcB, params) {
        const store = { result: resultAddSet({}, context, "union") };

        assignParams(store, params);

        return store;
    }

    function intersectionInit(context, srcA, srcB, params) {
        const store = { result: resultAddSet({}, context, "intersection") };

        assignParams(store, params);

        return store;
    }

   function intersectionOpenInit(context, srcA, srcB, params) {
        const store = { result: resultAddSet({}, context, "intersectionOpen") };

        assignParams(store, params);

        return store;
    }

   function differenceInit(context, srcA, srcB, params) {
        const store = { result: resultAddSet({}, context, "difference") };

        assignParams(store, params);

        return store;
    }

    function fullDifferenceInit(context, srcA, srcB, params) {
        const result = {};

        resultAddSet(result, context, "AminusB");
        resultAddSet(result, context, "BminusA");
        resultAddSet(result, context, "intersection");

        const store =  { result };

        assignParams(store, params);

        return store;
    }

   function linearInfillInit(context, {min}, srcB, params) {
        // calculate the leftmost line that crosses the contour s.t. all lines are
        // vertical, all lines have the given spacing, and one line passes through 0
        const spacing = params.spacing;
        const hline = Math.ceil(min.h / spacing) * spacing;
        const connectLines = params.connectLines;

        const store = {
            spacing,
            hline,
            lineidx: 0,
            connectLines: connectLines || false,
            prevLineEnd: null,
            result: resultAddSet({}, context, "infill")
        };

        assignParams(store, params);

        return store;
    }



    // event handler functions

    function unionHandle(event, status, store) {
        const flags = EventPositionFlags;
        const pos = event.getPosition(store.minDepthA, store.minDepthB);
        const result = store.result;

        const inside = pos & flags.insideA || pos & flags.insideB;
        const boundaryA = pos & flags.boundaryA;
        const boundaryB = pos & flags.boundaryB;
        const fromAtoB = pos & flags.fromAtoB;

        if (!inside && (boundaryA || boundaryB) && !fromAtoB) {
            event.addSegmentToSet(result.union);
        }
    }

   function intersectionHandle(event, status, store) {
        const flags = EventPositionFlags;
        const pos = event.getPosition(store.minDepthA, store.minDepthB);
        const result = store.result;

        const inside = pos & flags.insideA || pos & flags.insideB;
        const boundaryA = pos & flags.boundaryA;
        const boundaryB = pos & flags.boundaryB;
        const boundaryAB = boundaryA && boundaryB;
        const fromAtoB = pos & flags.fromAtoB;

        if (boundaryAB && !fromAtoB) {
            event.addSegmentToSet(result.intersection);
        }
        else if (inside && (boundaryA || boundaryB)) {
            event.addSegmentToSet(result.intersection);
        }
    }

    function intersectionOpenHandle(event, status, store) {
        const flags = EventPositionFlags;
        const pos = event.getPosition(store.minDepthA, store.minDepthB);
        const result = store.result;

        const insideA = pos & flags.insideA;
        const isB = event.weightB !== 0;

        if (insideA && isB) {
            event.addSegmentToSet(result.intersectionOpen);
        }
    }

   function differenceHandle(event, status, store) {
        const flags = EventPositionFlags;
        const pos = event.getPosition(store.minDepthA, store.minDepthB);
        const result = store.result;

        const inside = pos & flags.insideA || pos & flags.insideB;
        const boundaryA = pos & flags.boundaryA;
        const boundaryB = pos & flags.boundaryB;
        const boundaryAB = boundaryA && boundaryB;
        const fromAtoB = pos & flags.fromAtoB;

        if (boundaryAB) {
            if (fromAtoB) {
                event.addSegmentToSet(result.difference, false, event.weightA);
            }
        }
        else if (!inside && boundaryA) {
            event.addSegmentToSet(result.difference);
        }
        else if (inside && boundaryB) {
            event.addSegmentToSet(result.difference, true);
        }
    }

    function fullDifferenceHandle(event, status, store, params) {
        const flags = EventPositionFlags;
        const pos = event.getPosition(store.minDepthA, store.minDepthB);
        const result = store.result;

        const inside = pos & flags.insideA || pos & flags.insideB;
        const boundaryA = pos & flags.boundaryA;
        const boundaryB = pos & flags.boundaryB;
        const boundaryAB = boundaryA && boundaryB;
        const fromAtoB = pos & flags.fromAtoB;

        if (boundaryAB) {
            if (fromAtoB) {
                event.addSegmentToSet(result.AminusB, false, event.weightA);
                event.addSegmentToSet(result.BminusA, false, event.weightB);
            }
            else {
                event.addSegmentToSet(result.intersection);
            }
        }
        else {
            if (!inside && boundaryA) {
                event.addSegmentToSet(result.AminusB);
            }
            if (inside && boundaryB) {
                event.addSegmentToSet(result.AminusB, true);
                event.addSegmentToSet(result.intersection);
            }
            if (!inside && boundaryB) {
                event.addSegmentToSet(result.BminusA);
            }
            if (inside && boundaryA) {
                event.addSegmentToSet(result.BminusA, true);
                event.addSegmentToSet(result.intersection);
            }
        }
    }

    function linearInfillHandle({p, twin}, status, store) {
        const result = store.result;
        const connectLines = store.connectLines;
        let prevLineEnd = store.prevLineEnd;
        const spacing = store.spacing;
        let hline = store.hline;
        let lineidx = store.lineidx;
        const h = p.h;
        const ht = twin.p.h;

        // if segment is vertical, return
        if (h === ht) return;
        // if line position is already past the segment, return
        if (hline >= ht) return;

        // move the line position up, drawing lines as we go, until it clears the
        // segment completely
        while (hline <= ht) {
            // go through events in status, find pairs that enclose the interior of the
            // contour, draw a segment between them
            const iter = status.iterator();
            let prev = null;
            let curr;
            // alternate the direction in which infill lines are drawn
            const dir = lineidx%2 === 0 ? "next" : "prev";

            // last vertex of the line drawn at the current h position
            let currLineEnd = null;

            while ((curr = iter[dir]()) !== null) {
                if (!curr.hcontains(hline)) continue;

                if (prev !== null) {
                    // only write segment if segments border a 0-to-positive-to-0 winding
                    // number transition
                    let writeSegment;
                    if (lineidx%2 === 0) {
                        writeSegment = curr.depthBelowA > 0 && (prev.depthBelowA + prev.weightA) > 0;
                    }
                    else {
                        writeSegment = (curr.depthBelowA + curr.weightA) > 0 && prev.depthBelowA > 0;
                    }

                    if (writeSegment) {
                        // add point pair as usual
                        const p1 = prev.interpolate(hline);
                        const p2 = curr.interpolate(hline);

                        // if
                        // 1. we should connect the last vertex of the previous line to the
                        // first vertex of this one, and
                        // 2. this is the first segment of this line, and
                        // 3. there is a known endpoint for the previous line,
                        // then connect last known endpoint to the first current
                        if (connectLines && currLineEnd === null && prevLineEnd !== null) {
                            // additional check: if connection would be too long (angle with
                            // previous line less than 45 degrees), don't connect
                            const distsq = prevLineEnd.distanceToSq(p1);
                            if (distsq <= spacing * spacing * 2) {
                                result.infill.addPointPair(prevLineEnd.clone(), p1.clone());
                            }
                        }

                        result.infill.addPointPair(p1, p2);

                        // store p2 as the current end of the line
                        currLineEnd = p2;
                    }

                    prev = null;
                }
                else prev = curr;
            }

            prevLineEnd = currLineEnd;

            hline += spacing;
            lineidx++;
        }

        store.hline = hline;
        store.lineidx = lineidx;
        store.prevLineEnd = prevLineEnd;
    }

let Operations = {
    union: makeOperation(unionInit, unionHandle),
    intersection: makeOperation(intersectionInit, intersectionHandle),
    intersectionOpen: makeOperation(intersectionOpenInit, intersectionOpenHandle),
    difference: makeOperation(differenceInit, differenceHandle),
    fullDifference: makeOperation(fullDifferenceInit, fullDifferenceHandle),
    linearInfill: makeOperation(linearInfillInit, linearInfillHandle)
};

export {Operations};
