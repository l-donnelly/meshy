import {Context} from "./context";
import {Types} from "./types"
import * as MCGMath from "./math";
/*
  Integer point based on a Vector3, expanded to p decimal places.
*/

const Vector = (() => {

    function Vector(context, h, v) {
        this.context = context || new Context();

        this.h = Math.round(h || 0);
        this.v = Math.round(v || 0);

        this.type = Types.vector;
    }

    Object.assign(Vector.prototype, {

        fromVector3(v3) {
            const context = this.context;
            const ftoi = MCGMath.ftoi;

            this.h = ftoi(v3[context.ah], context);
            this.v = ftoi(v3[context.av], context);

            return this;
        },

        // arguments:
        //  constr: 3-vector constructor; assumed to follow THREE.Vector3 API
        //  context: context to use, if different from this.context
        toVector3(constr, context) {
            context = context || this.context;

            const itof = MCGMath.itof;

            const res = new constr();
            res[context.axis] = context.d;
            res[context.ah] = itof(this.h, context);
            res[context.av] = itof(this.v, context);

            return res;
        },

        set(h, v) {
            this.h = Math.round(h);
            this.v = Math.round(v);

            return this;
        },

        setH(h) {
            this.h = Math.round(h);

            return this;
        },

        setV(v) {
            this.v = Math.round(v);

            return this;
        },

        setUnitVector(axis) {
            const p = this.context.p;

            if (axis === "h") this.set(p, 0);
            else this.set(0, p);

            return this;
        },

        setScalar(s) {
            this.h = s;
            this.v = s;

            return this;
        },

        negate() {
            this.h *= -1;
            this.v *= -1;

            return this;
        },

        copy({h, v, context}) {
            this.h = h;
            this.v = v;
            this.context = context;

            return this;
        },

        clone() {
            return new this.constructor().copy(this);
        },

        hash() {
            return `${this.h}_${this.v}`;
        },

        sh() {
            return MCGMath.itof(this.h, this.context);
        },

        sv() {
            return MCGMath.itof(this.v, this.context);
        },

        add({h, v}) {
            this.h += h;
            this.v += v;

            return this;
        },

        sub({h, v}) {
            this.h -= h;
            this.v -= v;

            return this;
        },

        multiply({h, v}) {
            this.h = this.h * h;
            this.v = this.v * v;

            return this;
        },

        divide({h, v}) {
            this.h = Math.round(this.h / h);
            this.v = Math.round(this.v / v);

            return this;
        },

        multiplyScalar(s) {
            this.h = Math.round(this.h * s);
            this.v = Math.round(this.v * s);

            return this;
        },

        divideScalar(s) {
            return this.multiplyScalar(1 / s);
        },

        addScaledVector({h, v}, s) {
            return this.set(this.h + h * s,
                this.v + v * s);
        },

        lengthSq() {
            return this.h * this.h + this.v * this.v;
        },

        length() {
            return Math.sqrt(this.lengthSq());
        },

        setLength(l) {
            const tl = this.length();
            if (tl === l) return this;

            return this.multiplyScalar(l / tl);
        },

        // normalize the vector to length this.context.p (1 in its original
        // floating-point space)
        normalize() {
            if (this.h === 0 && this.v === 0) return this;

            const length = this.context.p;
            return this.setLength(length);
        },

        distanceToSq({h, v}) {
            const dh = this.h - h;
            const dv = this.v - v;
            return dh * dh + dv * dv;
        },

        distanceTo(other) {
            return Math.sqrt(this.distanceToSq(other));
        },

        dot({h, v}) {
            return this.h * h + this.v * v;
        },

        // component of the cross product normal to the plane
        cross({v, h}) {
            return this.h * v - this.v * h;
        },

        angleTo(other) {
            const normalization = Math.sqrt(this.lengthSq() * other.lengthSq());

            return acos(this.dot(other) / normalization);
        },

        vectorTo(other) {
            return other.clone().sub(this);
        },

        max({h, v}) {
            this.h = Math.max(this.h, h);
            this.v = Math.max(this.v, v);

            return this;
        },

        min({h, v}) {
            this.h = Math.min(this.h, h);
            this.v = Math.min(this.v, v);

            return this;
        },

        hcompare({h}) {
            return Math.sign(this.h - h);
        },

        vcompare({v}) {
            return Math.sign(this.v - v);
        },

        // rotates CCW
        rotate(angle) {
            const h = this.h;
            const v = this.v;
            const c = Math.cos(angle);
            const s = Math.sin(angle);

            this.setH(c * h - s * v);
            this.setV(s * h + c * v);

            return this;
        }

    });

    return Vector;

})();

export { Vector };