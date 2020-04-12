/*
 * Copyright (c) 2020 Evan Welsh <contact@evanwelsh.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/* global debug, ImportError */

if (typeof ImportError !== 'function')
    throw new Error('ImportError is not defined in module loader.');

// NOTE: Gio, GLib, and GObject have no overrides.

function isRelativePath(id) {
    // Check if the path is relative.
    return id.startsWith('./') || id.startsWith('../');
}

const allowedRelatives = ['file', 'resource'];

const relativeResolvers = new Map();
const loaders = new Map();
const asyncLoaders = new Map();

function registerScheme(...schemes) {
    function forEach(fn, ...args) {
        schemes.forEach(s => fn(s, ...args));
    }

    const schemeBuilder = {
        relativeResolver(handler) {
            forEach(scheme => {
                allowedRelatives.push(scheme);
                relativeResolvers.set(scheme, handler);
            });

            return schemeBuilder;
        },
        loader(handler) {
            forEach(scheme => {
                loaders.set(scheme, handler);
            });

            return schemeBuilder;
        },
        asyncLoader(handler) {
            forEach(scheme => {
                asyncLoaders.set(scheme, handler);
            });

            return schemeBuilder;
        },
    };

    return Object.freeze(schemeBuilder);
}

globalThis.registerScheme = registerScheme;

function parseURI(uri) {
    const parsed = GLib.uri_parse_scheme(uri);

    if (!parsed)
        return null;

    return {
        raw: uri,
        scheme: parsed,
    };

}

/**
 * @type {Set<string>}
 *
 * The set of "module" URIs (the module search path)
 */
const moduleURIs = new Set();

function registerModuleURI(uri) {
    moduleURIs.add(uri);
}

// Always let ESM-specific modules take priority over core modules.
registerModuleURI('resource:///org/gnome/gjs/modules/esm/');
registerModuleURI('resource:///org/gnome/gjs/modules/core/');

/**
 * @param {string} specifier the package specifier
 * @returns {string[]} the possible internal URIs
 */
function buildInternalURIs(specifier) {
    const builtURIs = [];

    for (const uri of moduleURIs) {
        const builtURI = `${uri}/${specifier}.js`;

        debug(`Built internal URI ${builtURI} with ${specifier} for ${uri}.`);

        builtURIs.push(builtURI);
    }

    return builtURIs;
}

function resolveRelativePath(moduleURI, relativePath) {
    // If a module has a path, we'll have stored it in the host field
    if (!moduleURI)
        throw new ImportError('Cannot import from relative path when module path is unknown.');

    debug(`moduleURI: ${moduleURI}`);

    const parsed = parseURI(moduleURI);

    // Handle relative imports from URI-based modules.
    if (parsed) {
        const resolver = relativeResolvers.get(parsed.scheme);

        if (resolver) {
            return resolver(parsed, relativePath);
        } else {
            throw new ImportError(
                `Relative imports can only occur from the following URI schemes: ${
                    Array.from(relativeResolvers.keys()).map(s => `${s}://`).join(', ')
                }`);
        }
    } else {
        throw new ImportError(`Module has invalid URI: ${moduleURI}`);
    }
}

function loadURI(uri) {
    debug(`URI: ${uri.raw}`);

    if (uri.scheme) {
        const loader = loaders.get(uri.scheme);

        if (loader)
            return loader(uri);
        else
            throw new ImportError(`No resolver found for URI: ${uri.raw || uri}`);

    } else {
        throw new ImportError(`Unable to load module, module has invalid URI: ${uri.raw || uri}`);
    }
}

async function loadURIAsync(uri) {
    debug(`URI: ${uri.raw}`);

    if (uri.scheme) {
        const loader = asyncLoaders.get(uri.scheme);

        if (loader) {
            const loaded = await loader(uri);

            return loaded;
        } else {
            throw new ImportError(`No resolver found for URI: ${uri.raw || uri}`);
        }
    } else {
        throw new ImportError(`Unable to load module, module has invalid URI: ${uri.raw || uri}`);
    }
}

function resolveSpecifier(specifier, moduleURI = null) {
    // If a module has a path, we'll have stored it in the host field
    let parsedURI = null;

    if (isRelativePath(specifier)) {
        let resolved = resolveRelativePath(moduleURI, specifier);

        parsedURI = parseURI(resolved);
    } else {
        const parsed = parseURI(specifier);

        if (parsed)
            parsedURI = parsed;
    }

    return parsedURI;
}

function resolveModule(specifier, moduleURI) {
    // Check if the module has already been loaded
    //
    // Order:
    // - Local imports
    // - Internal imports

    debug(`Resolving: ${specifier}`);

    let lookup_module = lookupModule(specifier);

    if (lookup_module)
        return lookup_module;

    lookup_module = lookupInternalModule(specifier);

    if (lookup_module)
        return lookup_module;

    // 1) Resolve path and URI-based imports.

    const parsedURI = resolveSpecifier(specifier, moduleURI);

    if (parsedURI) {
        const uri = parsedURI.raw;

        debug(`Full path found: ${uri}`);

        lookup_module = lookupModule(uri);

        // Check if module is already loaded (relative handling)
        if (lookup_module)
            return lookup_module;

        let text = loadURI(parsedURI);

        if (!text)
            return null;

        if (!registerModule(uri, uri, text, text.length, false))
            throw new ImportError(`Failed to register module: ${uri}`);

        return lookupModule(uri);
    }

    // 2) Resolve internal imports.

    const uri = buildInternalURIs(specifier).find(u => {
        let file = Gio.File.new_for_uri(u);

        return file && file.query_exists(null);
    });

    if (!uri)
        throw new ImportError(`Attempted to load unregistered global module: ${specifier}`);

    const text = loaders.get('resource')(parseURI(uri));

    if (!registerInternalModule(specifier, uri, text, text.length))
        return null;

    return lookupInternalModule(specifier);
}

async function resolveModuleAsync(specifier, moduleURI) {
    debug(`Resolving (asynchronously): ${specifier}...`);

    // Check if the module has already been loaded (absolute imports)
    if (lookupModule(specifier)) {
        // Resolve if found.
        return;
    }

    if (lookupInternalModule(specifier))
        return;

    const parsedURI = resolveSpecifier(specifier, moduleURI);

    if (parsedURI) {
        const uri = parsedURI.raw;

        if (lookupModule(uri))
            return;

        let text = await loadURIAsync(parsedURI);

        if (!text)
            return;

        if (!registerModule(uri, uri, text, text.length))
            throw new ImportError(`Failed to register module: ${uri}`);

        const registered = lookupModule(uri);

        if (registered) {
            if (compileAndEvalModule(uri))
                return;
            else
                throw new ImportError(`Failed to compile and evaluate module ${uri}.`);

        }

        // Fail by default.
        throw new ImportError('Unknown dynamic import error occured.');
    } else {
        for (const uri of buildInternalURIs(specifier)) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const text = await loadURIAsync(uri);

                if (!registerInternalModule(specifier, uri, text, text.length))
                    throw new ImportError(`Failed to register internal module: ${specifier} at ${uri}.`);

                if (lookupInternalModule(specifier))
                    return;
            } catch (err) {
                debug(`Failed to load ${uri}.`);
            }
        }

        throw new ImportError(`Attempted to load unregistered global module: ${specifier}`);
    }
}

setModuleDynamicImportHook((referencingInfo, specifier, promise) => {
    debug('Starting dynamic import...');
    const uri = getModuleURI(referencingInfo);

    if (uri)
        debug(`Found base URI: ${uri}`);

    resolveModuleAsync(specifier, uri).then(() => {
        debug('Successfully imported module!');
        finishDynamicModuleImport(referencingInfo, specifier, promise);
    }).catch(err => {
        debug(err);
        debug(err.stack);
        throw new Error(`Dynamic module import failed: ${err}`);
    });
});

setModuleResolveHook((referencingInfo, specifier) => {
    debug('Starting module import...');
    const uri = getModuleURI(referencingInfo);

    if (uri)
        debug(`Found base URI: ${uri}`);

    return resolveModule(specifier, uri);
});
