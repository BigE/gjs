// Copyright 2009 Red Hat, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

/* exported bindtextdomain, dcgettext, dgettext, dngettext, domain, dpgettext,
gettext, LocaleCategory, ngettext, pgettext, setlocale, textdomain */

/**
 * This module provides a convenience layer for the "gettext" family of functions,
 * relying on GLib for the actual implementation.
 *
 * Usage:
 *
 * const Gettext = imports.gettext;
 *
 * Gettext.textdomain("myapp");
 * Gettext.bindtextdomain("myapp", "/usr/share/locale");
 *
 * let translated = Gettext.gettext("Hello world!");
 */

const GLib = imports.gi.GLib;
const GjsPrivate = imports.gi.GjsPrivate;

var LocaleCategory = GjsPrivate.LocaleCategory;

function setlocale(category, locale) {
    return GjsPrivate.setlocale(category, locale);
}

function textdomain(dom) {
    return GjsPrivate.textdomain(dom);
}
function bindtextdomain(dom, location) {
    return GjsPrivate.bindtextdomain(dom, location);
}

function gettext(msgid) {
    return GLib.dgettext(null, msgid);
}
function dgettext(dom, msgid) {
    return GLib.dgettext(dom, msgid);
}
function dcgettext(dom, msgid, category) {
    return GLib.dcgettext(dom, msgid, category);
}

function ngettext(msgid1, msgid2, n) {
    return GLib.dngettext(null, msgid1, msgid2, n);
}
function dngettext(dom, msgid1, msgid2, n) {
    return GLib.dngettext(dom, msgid1, msgid2, n);
}
// FIXME: missing dcngettext ?

function pgettext(context, msgid) {
    return GLib.dpgettext2(null, context, msgid);
}
function dpgettext(dom, context, msgid) {
    return GLib.dpgettext2(dom, context, msgid);
}

/**
 * Create an object with bindings for gettext, ngettext,
 * and pgettext bound to a particular translation domain.
 *
 * @param {string} domainName Translation domain string
 * @returns {object} an object with gettext bindings
 */
function domain(domainName) {
    return {
        gettext(msgid) {
            return GLib.dgettext(domainName, msgid);
        },

        ngettext(msgid1, msgid2, n) {
            return GLib.dngettext(domainName, msgid1, msgid2, n);
        },

        pgettext(context, msgid) {
            return GLib.dpgettext2(domainName, context, msgid);
        },
    };
}
