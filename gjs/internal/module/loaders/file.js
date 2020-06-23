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

/* global registerScheme */

function fromBytes(bytes) {
    return ByteUtils.toString(bytes, 'utf-8');
}

function loadFileSync(output, full_path) {
    try {
        const [, bytes] = output.load_contents(null);
        return fromBytes(bytes);
    } catch (error) {
        throw new Error(`Unable to load file from: ${full_path}`);
    }
}

registerScheme('file', 'resource')
    .relativeResolver((moduleURI, relativePath) => {
        let module_file = Gio.File.new_for_uri(moduleURI.raw);
        let module_parent_file = module_file.get_parent();

        let output = module_parent_file.resolve_relative_path(relativePath);

        return output.get_uri();
    }).loader(uri => {
        const file = Gio.File.new_for_uri(uri.raw);

        return loadFileSync(file, file.get_uri());
    });
