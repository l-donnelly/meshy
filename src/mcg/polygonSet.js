import {Types} from "./types"
import {GeometrySet} from "./geometrySet";

const PolygonSet = (() => {
    class PolygonSet extends GeometrySet {
        constructor(context) {
            super(context);

            this.type = Types.polygonSet;
        }
    }

    Object.assign(PolygonSet.prototype, {

        constructor: PolygonSet,

        forEachPoint(f) {
            this.forEach(polygon => {
                if (polygon.valid()) polygon.forEach(f);
            });
        },

        forEachPointPair(f) {
            this.forEach(polygon => {
                if (polygon.valid()) polygon.forEachPointPair(f);
            });
        },

        forEachSegmentPair(f) {
            this.forEach(polygon => {
                if (polygon.valid()) polygon.forEachSegmentPair(f);
            });
        },

        computeBisectors() {
            this.forEach(polygon => {
                if (polygon.valid()) polygon.computeBisectors();
            });
        },

        foffset(fdist, ftol) {
            const polygonSet = new this.constructor(this.context);

            this.forEach(polygon => {
                const offset = polygon.foffset(fdist, ftol);

                if (offset.valid()) polygonSet.add(offset);
            });

            return polygonSet;
        },

        offset(dist, tol) {
            const polygonSet = new this.constructor(this.context);

            this.forEach(polygon => {
                const offset = polygon.offset(dist, tol);

                if (offset.valid()) polygonSet.add(offset);
            });

            return polygonSet;
        },

        fdecimate(ftol) {
            this.forEach(polygon => {
                polygon.fdecimate(ftol);
            });

            // remove invalid polygons
            this.filter(polygon => polygon.valid());

            return this;
        },

        decimate(tol) {
            this.forEach(polygon => {
                polygon.decimate(tol);
            });

            // remove invalid polygons
            this.filter(polygon => polygon.valid());

            return this;
        },

        pointCount() {
            let count = 0;

            this.forEach(polygon => {
                count += polygon.count();
            });

            return count;
        }

    });

    return PolygonSet;
})();

export {PolygonSet};

