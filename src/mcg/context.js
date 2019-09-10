import {Types} from "./types"
import * as MCGMath from "./math";
import * as Utils from "./../utils";

const Context = (() => {

    function Context(axis, d, precision) {
        if (axis === undefined) axis = 'z';
        if (d === undefined) d = 0;
        if (precision === undefined) precision = 5;

        this.axis = axis;
        this.ah = MCGMath.cycleAxis(axis);
        this.av = MCGMath.cycleAxis(this.ah);
        this.up = Utils.makeAxisUnitVector(axis);
        this.d = d;
        this.precision = precision;

        this.epsilon = 10 ** -this.precision;
        this.p = 10 ** this.precision;

        this.type = Types.context;
    }

    Object.assign(Context.prototype, {

        constructor: Context,

        clone() {
            return new this.constructor(this.axis, this.d, this.precision);
        }

    });

    return Context;

})();

export {Context}
