const gi = import.meta.require('gi');

const Gi = {
    require(name, version = null) {
        if (version !== null)
            gi.versions[name] = version;

        if (name === 'versions')
            throw new Error('Cannot import namespace "versions", use the version parameter of Gi.require to specify versions.');


        return gi[name];
    },
};
Object.freeze(Gi);

export default Gi;
