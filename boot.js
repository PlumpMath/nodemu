/*
 * Module loader, require(), export etc.
 *
 * Nodemu, Node.js emulated
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

let pretty_errors = true // Colors in errors
let global_compat = true // global.* writeable

/*
 * TODO:
 * #1 Rewrite [0]ed retvals from Lua using destructuring when available.
 * #2 Integrate ES6 module support
 * #3 Perhaps un-break 'unique context=unique builtin' in V8 some day
 */

/* Sentinel. */
if (!native) return;

/* Only lua and native at this point. */
let binding = native.binding,
    lua = native.lua,
    self = native.self,
    open = lua.io.open,
    read = lua.io.stdin.read, // TBD: Ugly.
    close = lua.io.close,
    realpath = binding.realpath,
    stat = binding.stat,
    run = binding.eval

/* To pad error strings. */
let spaces = Array(256).join(' ')
let underline = Array(256).join('~')

/* Forward decls. */
let assert

/* Hard-coded module names which can also access native APIs. */
let builtin = ['require','fs','process','vm']

/* Compute dirname. */
let dirname = function(path)
{
  let parts = path.split('/')
  if (parts.length)
    parts.pop()
  return parts.join('/')
}

/* Module constructor. */
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

/* Root module.* prototype. */
Module.prototype = {
  cache: cache,
  /* Require module in context of 'mid'. */
  require: function(mid)
  {
    if (mid === 'require')
      return this.require;

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
      paths.push(this.dirname) // Dirname of parent.

    paths = paths.concat(Module.path) // Stable path comes last.

    for (let path of paths.values()) {
      for (let ext in this.extensions) {
        if (path === '') path = '.'
        if (path[path.length-1] !== '/')
          path += '/'
        let attempts = [
          path + mid + '/index' + ext,
          path + mid + ext,
          path + mid,
        ]

        for (let attempt of attempts.values()) {
          if (stat(attempt) === 0)
            return realpath(attempt)
        }
      }
    }
  },

  /* Extension handlers. */
  extensions: {
    '.js': function(mod, path, mid) {
      var localscope = {
        exports: mod.exports,
        require: mod.require,
        __filename: mod.filename,
        __dirname: mod.dirname,
        native:
          builtin.indexOf(mod.id) >= 0
            && native
            || undefined,
      }

      let fd = open(path, 'r')[0]
      let source = read(fd, '*a')[0]
      close(fd)
      /* See #3.
       *
       * We have to do this because V8 contexes are
       * not a good fit for the likes of Node at the moment
       * (node uses similiar wrapper).
       *
       * Eventually, built-in objects should be
       * one world when inheritance across ctx works.
       *
       * This is exactly how Function.new is implemented
       * in V8 VM genesis snapshot as well, unfortunatelly
       * that one does not take filename argument.
       */
      let body = '\x28function\x28'
      let args = []
      for (var k in localscope) {
        body += k + ','
        args.push(localscope[k])
      }
      body += 'module\x29\x7b' + source + '\n\x7d\x29'
      args.push(mod)
      let f = run(self, body, path)
      if (typeof f != 'function')
        throw new Error('Parser failed for ' + path)
      f.apply(mod, args)
    }
  },

  children: [],
  dirname: './'
}

/* Custom stack trace handler for munging syntax errors. */
let C_ERRMSG = '\x1b[1;41;37m',
    C_BOLD = '\x1b[1;37m',
    C_RESET = '\x1b[0m'
if (!pretty_errors)
  C_ERRMSG = C_BOLD = C_RESET = ''

Error.prepareStackTrace = function(e, trace) {
  let ret = Array()
  if (e.lineNumber) {
    ret.push('\n' + C_BOLD + e.scriptResourceName + C_RESET + ':' +
        e.lineNumber + ':' +
        e.startColumn + '\n');
      ret.push(e.sourceLine + '\n')
      ret.push(spaces.substring(0, e.startColumn) + C_BOLD +
          underline.substring(0, e.endColumn - e.startColumn) + C_RESET + '\n')
  }
  ret.push(e.name + ': ' + C_ERRMSG + e.message + C_RESET + '\n')
  for (let i = 0; i < trace.length; i++)
    ret.push('    at '+trace[i].toString() + '\n')
  return ret.join('')
}

/* Set a global variable from strict mode. */
let setglobal = function(k,v)
{
  Object.defineProperty(self, k, { value: v, writable: true })
  return v
}

/* 
 * Initialize the global object. It is a proxy to the
 * true context global object because majority of node
 * modules do not yet use defineProperty when writing to
 * global.* within strict mode.
 */
let global = global_compat?Proxy.create({
  set: function(recv, k, v) {
    setglobal(k,v)
  },
  get: function(recv, k) {
    return self[k]
  },
  getPropertyNames: function() { return Object.getPropertyNames(self) },
  getOwnPropertyNames: function() { return Object.getOwnPropertyNames(self) },
  defineProperty: function(g,n,pd) {
    return Object.getOwnPropertyNames(self, n, pd) },
}):self
setglobal('global', global)
setglobal('GLOBAL', global)
setglobal('root', global)

/* Initialize process */
setglobal('process', {
  title: 'node',
  versions: {
    node: 'v0.10.0',
    v8: binding.v8_version,
  },
  platform: binding.platform,
  arch: binding.arch,
  env: binding.env,
  pid: binding.pid,
  execPath: native.arg[0],
})

/* Instantiate common global vars. */
setglobal('require', Module.prototype.require.bind(Module.prototype))
setglobal('console', global.require('console'))


