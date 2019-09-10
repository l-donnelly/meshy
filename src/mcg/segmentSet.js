import {GeometrySet} from "./geometrySet";
import {Types} from "./types"
import {Segment} from "./segment"
import {Polygon} from "./polygon"
import {PolygonSet} from "./polygonSet"
import {DirectedAdjacencyMap} from "./adjacencyMap";

const SegmentSet = (() => {
    class SegmentSet extends GeometrySet {
        constructor(context) {
            super(context);

            this.type = Types.segmentSet;
        }
    }

    Object.assign(SegmentSet.prototype, {

        constructor: SegmentSet,

        addPointPair(p1, p2) {
            this.add(new Segment(this.context, p1, p2));
        },

        forEachPointPair(f) {
            const segments = this.elements;
            const ct = this.count();

            for (let i = 0; i < ct; i++) {
                const s = segments[i];
                f(s.p1, s.p2);
            }
        },

        makeAdjacencyMap() {
            const adjacencyMap = new DirectedAdjacencyMap(this.context);

            const segments = this.elements;
            const ns = segments.length;

            for (let si = 0; si < ns; si++) {
                adjacencyMap.addSegment(segments[si]);
            }

            return adjacencyMap;
        },

        toPolygonSet() {
            const context = this.context;

            const pset = new PolygonSet(context);

            const adjacencyMap = this.makeAdjacencyMap();

            const loops = adjacencyMap.getLoops();
            for (let li = 0; li < loops.length; li++) {
                const polygon = new Polygon(context, loops[li]);
                if (polygon.valid()) pset.add(polygon);
            }

            return pset;
        },

        pointCount() {
            return this.count() * 2;
        }

    });

    return SegmentSet;
})();

export {SegmentSet};
