/*
 * Module loader, require(), export etc.
 *
 * Nodemu, Node.js emulated in Lua.
 * (C) Copyright 2014, Karel Tuma <kat@lua.cz>, All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict'

/*
 * TODO:
 * - Rewrite [0]ed retvals from Lua using destructuring when available.
 * - Integrate ES6 module support
 */

/* Cache slow Lua proxies to locals */
let context = lua.js.context,
    open = lua.io.open,
    read = lua.io.stdin.read, // TBD: Ugly.
    close = lua.io.close

/* This is the actual global object shared by everyone. */
let global = {}

/* Canonicalize path. We don't have realpath(2) just yet. */
let realpath = function(path)
{
  let res = [],
      prep = ''

  if (path[0] == '/') {
    path = path.sub(1)
    prep = '/'
  }

  for (let part of path.split('/').values()) {
    if (part === '..' && res.length)
      res.pop()
    else if (part !== '' && part !== '.')
      res.push(part)
  }
  return prep + res.join('/')
}

/* Compute dirname. */
let dirname = function(path)
{
  let parts = path.split('/')
  if (parts.length)
    parts.pop()
  return parts.join('/')
}


/* Constructor */
let Module = function(id, fn, parent)
{
  /* Public API fields. */
  this.dirname = dirname(fn)
  this.filename = fn
  this.id = id
  this.exports = {}
  this.children = []
  if (this.parent = parent)
    parent.children.push(this)
}

/* Default stable search paths. */
Module.path = [
  lua.os.getenv('HOME') + '/.nodemu',
  '/usr/share/nodemu',
]

/* Exposed cache */
let cache = {}

Module.prototype = {
  cache: cache,
  /* Require module in context of 'mid'. */
  require: function(mid)
  {
    if (mid === 'require')
      return Module;

    let key = this.dirname + '\0' + mid,
        mod

    if ((mod = cache[key]) && cache[mod]) // Fastpath cache.
      return cache[key]

    let fullpath = this.resolve(mid) // Resolve where it is.
    if (!fullpath) {
      let exc = new Error('Cannot find module \'' + mid + '\'')
      exc.code = 'MODULE_NOT_FOUND'
      throw exc
    }

    if ((mod = cache[fullpath]) && cache[mod]) // Might be cached after all.
      return cache[fullpath]

    mod = new Module(mid, fullpath, this) // Construct module.
    let ext = '.'+fullpath.split('.').pop()

    cache[key] = mod // Cache early to prevent cycles.
    cache[fullpath] = mod
    cache[mod] = fullpath

    mod.require = mod.require.bind(mod) // Silly node API wants unique instance.
    mod.require.resolve = mod.resolve
    mod.require.cache = cache

    mod.extensions[ext](mod, fullpath, mid) // Ext handler actually loads.

    mod.loaded = true

    return mod.exports
  },

  /* Resolve full path to 'mid' in context of holding module. */
  resolve: function(mid)
  {
    let paths = ['']
    if (mid[0] !== '/' && this.dirname)
      paths.push(this.dirname + '/') // Dirname of parent.

    paths = paths.concat(Module.path) // Stable path comes last.

    for (let path of paths.values()) {
      for (let ext in this.extensions) {
        let attempts = [
          path + mid + '/index' + ext,
          path + mid + ext,
          path + mid,
        ]

        for (let attempt of attempts.values()) {
          let fd = open(attempt, 'r')[0]
          if (fd) {
            close(fd)
            return realpath(attempt)
          }
        }
      }
    }
  },

  /* Extension handlers. */
  extensions: {
    '.js': function(mod, path, mid) {
      var scope = context({
        global: global,
        exports: mod.exports,
        require: mod.require,
        __dirname: mod.dirname,
        __filename: mod.filename,
        module: mod,
        lua: lua,
      })[0] // Start fresh JS context.

      let fd = open(path, 'r')[0]
      let res = read(fd, '*a')[0]
      scope.eval(res)
      close(fd)
    }
  },

  children: [],
  dirname: './'
}

module.exports = Module

