import {Types} from "./types"
import {Vector} from "./vector";

const GeometrySet = (() => {

    function GeometrySet(context) {
        this.context = context;

        this.elements = [];

        this.min = null;
        this.max = null;

        this.initBounds();

        this.type = Types.abstractGeometrySet;
    }

    Object.assign(GeometrySet.prototype, {

        add(e) {
            if (e.valid()) {
                this.elements.push(e);

                e.updateBoundsFromThis(this.min, this.max);
            }

            return this;
        },

        initBounds() {
            const context = this.context;

            this.min = new Vector(context).setScalar(Infinity);
            this.max = new Vector(context).setScalar(-Infinity);
        },

        count() {
            return this.elements.length;
        },

        forEach(f) {
            const elements = this.elements;
            const ct = this.elements.length;

            for (let i = 0; i < ct; i++) {
                f(elements[i]);
            }
        },

        filter(valid) {
            const result = [];

            this.forEach(element => {
                if (valid(element)) result.push(element);
            });

            this.elements = result;

            return this;
        },

        rotate(angle) {
            this.initBounds();
            const _this = this;

            this.forEach(element => {
                element.rotate(angle);
                element.updateBoundsFromThis(_this.min, _this.max);
            });

            return this;
        },

        clone(recursive) {
            const clone = new this.constructor(this.context);
            const elements = clone.elements;

            this.forEach(element => {
                elements.push(recursive ? element.clone(recursive) : element);
            });

            return clone;
        },

        merge(other) {
            const elements = this.elements;

            other.forEach(element => {
                elements.push(element);
            });

            return this;
        },

        setContext(context) {
            this.context = context;

            return this;
        }

    });

    return GeometrySet;

})();

export { GeometrySet };
