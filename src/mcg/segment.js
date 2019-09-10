import {Types} from "./types"
import {Vector} from "./vector";
import * as MCGMath from "./math";

const Segment = (() => {

    function Segment(context, p1, p2) {
        this.context = context;

        this.p1 = p1;
        this.p2 = p2;

        this.type = Types.segment;
    }

    Object.assign(Segment.prototype, {

        fromVector3Pair(v1, v2, normal) {
            const context = this.context;

            const p1 = new Vector(context).fromVector3(v1);
            const p2 = new Vector(context).fromVector3(v2);

            if (MCGMath.coincident(p1, p2)) return this;

            // if normal not given, assign points in given order
            if (normal === undefined) {
                this.p1 = p1;
                this.p2 = p2;
            }
            // if normal given, use it to assign points s.t. polygon is on the left
            // when traversing from v1 to v2
            else {
                // determine which way the winding order points
                const cross = context.up.clone().cross(normal);
                const dot = cross.dot(v2.clone().sub(v1));

                this.p1 = dot > 0 ? p1 : p2;
                this.p2 = dot > 0 ? p2 : p1;
            }

            return this;
        },

        valid() {
            if (!(this.p1 && this.p2)) return false;

            return !MCGMath.coincident(this.p1, this.p2);
        },

        clone(recursive) {
            const p1 = recursive ? this.p1.clone() : this.p1;
            const p2 = recursive ? this.p2.clone() : this.p2;

            return new this.constructor(this.context, p1, p2);
        },

        rotate(angle) {
            this.p1.rotate(angle);
            this.p2.rotate(angle);

            return this;
        },

        updateBoundsFromThis(min, max) {
            min.min(this.p1);
            max.max(this.p1);
            min.min(this.p2);
            max.max(this.p2);
        },

        lengthSq() {
            return this.p1.distanceToSq(this.p2);
        },

        length() {
            return this.pq.distanceTo(this.p2);
        }

    });

    return Segment;

})();

export {Segment};
