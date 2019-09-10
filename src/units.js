const Units = (() => {

    const mm = "mm";
    const cm = "cm";
    const inches = "inches";
    const metres = "metres";

    // conversion factors from other units to mm
    const mmfactors = {
        mm: 1,
        cm: 10,
        inches: 25.4,
        metres: 100
    };

    function getFactor(from, to) {
        if (!mmfactors.hasOwnProperty(from) || !mmfactors.hasOwnProperty(to)) return 1;

        return mmfactors[from] / mmfactors[to];
    }

    function id(val) { return val; }

    function getConverter(from, to) {
        const factor = getFactor(from, to);
        return val => val * factor;
    }

    function getConverterV3(from, to) {
        const factor = getFactor(from, to);
        return val => val.clone().multiplyScalar(factor);
    }

    return {
        mm,
        cm,
        inches,
        metres,
        getFactor,
        getConverter,
        getConverterV3
    };

})();

export { Units }
