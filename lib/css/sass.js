'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _toutsuite = require('toutsuite');

var _toutsuite2 = _interopRequireDefault(_toutsuite);

var _detectiveSass = require('detective-sass');

var _detectiveSass2 = _interopRequireDefault(_detectiveSass);

var _detectiveScss = require('detective-scss');

var _detectiveScss2 = _interopRequireDefault(_detectiveScss);

var _sassLookup = require('sass-lookup');

var _sassLookup2 = _interopRequireDefault(_sassLookup);

var _compilerBase = require('../compiler-base');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const mimeTypes = ['text/sass', 'text/scss'];
let sass = null;

/**
 * @access private
 */
class SassCompiler extends _compilerBase.CompilerBase {
  constructor() {
    super();

    this.compilerOptions = {
      comments: true,
      sourceMapEmbed: true,
      sourceMapContents: true
    };

    this.seenFilePaths = {};
  }

  static getInputMimeTypes() {
    return mimeTypes;
  }

  shouldCompileFile(fileName, compilerContext) {
    return _asyncToGenerator(function* () {
      // eslint-disable-line no-unused-vars
      return true;
    })();
  }

  determineDependentFiles(sourceCode, filePath, compilerContext) {
    var _this = this;

    return _asyncToGenerator(function* () {
      return _this.determineDependentFilesSync(sourceCode, filePath, compilerContext);
    })();
  }

  compile(sourceCode, filePath, compilerContext) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      // eslint-disable-line no-unused-vars
      sass = sass || _this2.getSass();

      let thisPath = _path2.default.dirname(filePath);
      _this2.seenFilePaths[thisPath] = true;

      let paths = Object.keys(_this2.seenFilePaths);

      if (_this2.compilerOptions.paths) {
        paths.push(..._this2.compilerOptions.paths);
      }

      paths.unshift('.');

      sass.importer(_this2.buildImporterCallback(paths));

      let opts = Object.assign({}, _this2.compilerOptions, {
        indentedSyntax: filePath.match(/\.sass$/i),
        sourceMapRoot: filePath
      });

      let result = yield new Promise(function (res, rej) {
        sass.compile(sourceCode, opts, function (r) {
          if (r.status !== 0) {
            rej(new Error(r.formatted || r.message));
            return;
          }

          res(r);
          return;
        });
      });

      let source = result.text;

      // NB: If you compile a file that is solely imports, its
      // actual content is '' yet it is a valid file. '' is not
      // truthy, so we're going to replace it with a string that
      // is truthy.
      if (!source) {
        source = ' ';
      }

      return {
        code: source,
        mimeType: 'text/css'
      };
    })();
  }

  shouldCompileFileSync(fileName, compilerContext) {
    // eslint-disable-line no-unused-vars
    return true;
  }

  determineDependentFilesSync(sourceCode, filePath, compilerContext) {
    // eslint-disable-line no-unused-vars
    let dependencyFilenames = _path2.default.extname(filePath) === '.sass' ? (0, _detectiveSass2.default)(sourceCode) : (0, _detectiveScss2.default)(sourceCode);
    let dependencies = [];

    for (let dependencyName of dependencyFilenames) {
      dependencies.push((0, _sassLookup2.default)(dependencyName, _path2.default.basename(filePath), _path2.default.dirname(filePath)));
    }

    return dependencies;
  }

  compileSync(sourceCode, filePath, compilerContext) {
    // eslint-disable-line no-unused-vars
    sass = sass || this.getSass();

    let thisPath = _path2.default.dirname(filePath);
    this.seenFilePaths[thisPath] = true;

    let paths = Object.keys(this.seenFilePaths);

    if (this.compilerOptions.paths) {
      paths.push(...this.compilerOptions.paths);
    }

    paths.unshift('.');
    sass.importer(this.buildImporterCallback(paths));

    let opts = Object.assign({}, this.compilerOptions, {
      indentedSyntax: filePath.match(/\.sass$/i),
      sourceMapRoot: filePath
    });

    let result;
    (0, _toutsuite2.default)(() => {
      sass.compile(sourceCode, opts, r => {
        if (r.status !== 0) {
          throw new Error(r.formatted);
        }
        result = r;
      });
    });

    let source = result.text;

    // NB: If you compile a file that is solely imports, its
    // actual content is '' yet it is a valid file. '' is not
    // truthy, so we're going to replace it with a string that
    // is truthy.
    if (!source) {
      source = ' ';
    }

    return {
      code: source,
      mimeType: 'text/css'
    };
  }

  getSass() {
    let ret;
    (0, _toutsuite2.default)(() => ret = require('sass.js/dist/sass.node').Sass);
    return ret;
  }

  buildImporterCallback(includePaths) {
    const self = this;
    return function (request, done) {
      let file;
      if (request.file) {
        done();
        return;
      } else {
        // sass.js works in the '/sass/' directory
        const cleanedRequestPath = request.resolved.replace(/^\/sass\//, '');
        for (let includePath of includePaths) {
          const filePath = _path2.default.resolve(includePath, cleanedRequestPath);
          let variations = sass.getPathVariations(filePath);

          file = variations.map(self.fixWindowsPath.bind(self)).reduce(self.importedFileReducer.bind(self), null);

          if (file) {
            const content = _fs2.default.readFileSync(file, { encoding: 'utf8' });
            return sass.writeFile(file, content, () => {
              done({ path: file });
              return;
            });
          }
        }

        if (!file) {
          done();
          return;
        }
      }
    };
  }

  importedFileReducer(found, path) {
    // Find the first variation that actually exists
    if (found) return found;

    try {
      const stat = _fs2.default.statSync(path);
      if (!stat.isFile()) return null;
      return path;
    } catch (e) {
      return null;
    }
  }

  fixWindowsPath(file) {
    // Unfortunately, there's a bug in sass.js that seems to ignore the different
    // path separators across platforms

    // For some reason, some files have a leading slash that we need to get rid of
    if (process.platform === 'win32' && file[0] === '/') {
      file = file.slice(1);
    }

    // Sass.js generates paths such as `_C:\myPath\file.sass` instead of `C:\myPath\_file.sass`
    if (file[0] === '_') {
      const parts = file.slice(1).split(_path2.default.sep);
      const dir = parts.slice(0, -1).join(_path2.default.sep);
      const fileName = parts.reverse()[0];
      file = _path2.default.resolve(dir, '_' + fileName);
    }
    return file;
  }

  getCompilerVersion() {
    // NB: There is a bizarre bug in the node module system where this doesn't
    // work but only in saveConfiguration tests
    //return require('@paulcbetts/node-sass/package.json').version;
    return "4.1.1";
  }
}
exports.default = SassCompiler;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jc3Mvc2Fzcy5qcyJdLCJuYW1lcyI6WyJtaW1lVHlwZXMiLCJzYXNzIiwiU2Fzc0NvbXBpbGVyIiwiY29uc3RydWN0b3IiLCJjb21waWxlck9wdGlvbnMiLCJjb21tZW50cyIsInNvdXJjZU1hcEVtYmVkIiwic291cmNlTWFwQ29udGVudHMiLCJzZWVuRmlsZVBhdGhzIiwiZ2V0SW5wdXRNaW1lVHlwZXMiLCJzaG91bGRDb21waWxlRmlsZSIsImZpbGVOYW1lIiwiY29tcGlsZXJDb250ZXh0IiwiZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXMiLCJzb3VyY2VDb2RlIiwiZmlsZVBhdGgiLCJkZXRlcm1pbmVEZXBlbmRlbnRGaWxlc1N5bmMiLCJjb21waWxlIiwiZ2V0U2FzcyIsInRoaXNQYXRoIiwiZGlybmFtZSIsInBhdGhzIiwiT2JqZWN0Iiwia2V5cyIsInB1c2giLCJ1bnNoaWZ0IiwiaW1wb3J0ZXIiLCJidWlsZEltcG9ydGVyQ2FsbGJhY2siLCJvcHRzIiwiYXNzaWduIiwiaW5kZW50ZWRTeW50YXgiLCJtYXRjaCIsInNvdXJjZU1hcFJvb3QiLCJyZXN1bHQiLCJQcm9taXNlIiwicmVzIiwicmVqIiwiciIsInN0YXR1cyIsIkVycm9yIiwiZm9ybWF0dGVkIiwibWVzc2FnZSIsInNvdXJjZSIsInRleHQiLCJjb2RlIiwibWltZVR5cGUiLCJzaG91bGRDb21waWxlRmlsZVN5bmMiLCJkZXBlbmRlbmN5RmlsZW5hbWVzIiwiZXh0bmFtZSIsImRlcGVuZGVuY2llcyIsImRlcGVuZGVuY3lOYW1lIiwiYmFzZW5hbWUiLCJjb21waWxlU3luYyIsInJldCIsInJlcXVpcmUiLCJTYXNzIiwiaW5jbHVkZVBhdGhzIiwic2VsZiIsInJlcXVlc3QiLCJkb25lIiwiZmlsZSIsImNsZWFuZWRSZXF1ZXN0UGF0aCIsInJlc29sdmVkIiwicmVwbGFjZSIsImluY2x1ZGVQYXRoIiwicmVzb2x2ZSIsInZhcmlhdGlvbnMiLCJnZXRQYXRoVmFyaWF0aW9ucyIsIm1hcCIsImZpeFdpbmRvd3NQYXRoIiwiYmluZCIsInJlZHVjZSIsImltcG9ydGVkRmlsZVJlZHVjZXIiLCJjb250ZW50IiwicmVhZEZpbGVTeW5jIiwiZW5jb2RpbmciLCJ3cml0ZUZpbGUiLCJwYXRoIiwiZm91bmQiLCJzdGF0Iiwic3RhdFN5bmMiLCJpc0ZpbGUiLCJlIiwicHJvY2VzcyIsInBsYXRmb3JtIiwic2xpY2UiLCJwYXJ0cyIsInNwbGl0Iiwic2VwIiwiZGlyIiwiam9pbiIsInJldmVyc2UiLCJnZXRDb21waWxlclZlcnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFQSxNQUFNQSxZQUFZLENBQUMsV0FBRCxFQUFjLFdBQWQsQ0FBbEI7QUFDQSxJQUFJQyxPQUFPLElBQVg7O0FBRUE7OztBQUdlLE1BQU1DLFlBQU4sb0NBQXdDO0FBQ3JEQyxnQkFBYztBQUNaOztBQUVBLFNBQUtDLGVBQUwsR0FBdUI7QUFDckJDLGdCQUFVLElBRFc7QUFFckJDLHNCQUFnQixJQUZLO0FBR3JCQyx5QkFBbUI7QUFIRSxLQUF2Qjs7QUFNQSxTQUFLQyxhQUFMLEdBQXFCLEVBQXJCO0FBQ0Q7O0FBRUQsU0FBT0MsaUJBQVAsR0FBMkI7QUFDekIsV0FBT1QsU0FBUDtBQUNEOztBQUVLVSxtQkFBTixDQUF3QkMsUUFBeEIsRUFBa0NDLGVBQWxDLEVBQW1EO0FBQUE7QUFBRTtBQUNuRCxhQUFPLElBQVA7QUFEaUQ7QUFFbEQ7O0FBRUtDLHlCQUFOLENBQThCQyxVQUE5QixFQUEwQ0MsUUFBMUMsRUFBb0RILGVBQXBELEVBQXFFO0FBQUE7O0FBQUE7QUFDbkUsYUFBTyxNQUFLSSwyQkFBTCxDQUFpQ0YsVUFBakMsRUFBNkNDLFFBQTdDLEVBQXVESCxlQUF2RCxDQUFQO0FBRG1FO0FBRXBFOztBQUVLSyxTQUFOLENBQWNILFVBQWQsRUFBMEJDLFFBQTFCLEVBQW9DSCxlQUFwQyxFQUFxRDtBQUFBOztBQUFB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LE1BQVksR0FBaEQsRUFBcUQ7QUFDbkRBLGFBQU9BLEtBQUt5QixLQUFMLENBQVcsQ0FBWCxDQUFQO0FBQ0Q7O0FBRUQ7QUFDQSxRQUFJekIsS0FBSyxDQUFMLE1BQVksR0FBaEIsRUFBcUI7QUFDbkIsWUFBTTBCLFFBQVExQixLQUFLeUIsS0FBTCxDQUFXLENBQVgsRUFBY0UsS0FBZCxDQUFvQixlQUFLQyxHQUF6QixDQUFkO0FBQ0EsWUFBTUMsTUFBTUgsTUFBTUQsS0FBTixDQUFZLENBQVosRUFBZSxDQUFDLENBQWhCLEVBQW1CSyxJQUFuQixDQUF3QixlQUFLRixHQUE3QixDQUFaO0FBQ0EsWUFBTTdFLFdBQVcyRSxNQUFNSyxPQUFOLEdBQWdCLENBQWhCLENBQWpCO0FBQ0EvQixhQUFPLGVBQUtLLE9BQUwsQ0FBYXdCLEdBQWIsRUFBa0IsTUFBTTlFLFFBQXhCLENBQVA7QUFDRDtBQUNELFdBQU9pRCxJQUFQO0FBQ0Q7O0FBRURnQyx1QkFBcUI7QUFDbkI7QUFDQTtBQUNBO0FBQ0EsV0FBTyxPQUFQO0FBQ0Q7QUFyTm9EO2tCQUFsQzFGLFkiLCJmaWxlIjoic2Fzcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB0b3V0U3VpdGUgZnJvbSAndG91dHN1aXRlJztcbmltcG9ydCBkZXRlY3RpdmVTQVNTIGZyb20gJ2RldGVjdGl2ZS1zYXNzJztcbmltcG9ydCBkZXRlY3RpdmVTQ1NTIGZyb20gJ2RldGVjdGl2ZS1zY3NzJztcbmltcG9ydCBzYXNzTG9va3VwIGZyb20gJ3Nhc3MtbG9va3VwJztcbmltcG9ydCB7Q29tcGlsZXJCYXNlfSBmcm9tICcuLi9jb21waWxlci1iYXNlJztcblxuY29uc3QgbWltZVR5cGVzID0gWyd0ZXh0L3Nhc3MnLCAndGV4dC9zY3NzJ107XG5sZXQgc2FzcyA9IG51bGw7XG5cbi8qKlxuICogQGFjY2VzcyBwcml2YXRlXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNhc3NDb21waWxlciBleHRlbmRzIENvbXBpbGVyQmFzZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLmNvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICAgIGNvbW1lbnRzOiB0cnVlLFxuICAgICAgc291cmNlTWFwRW1iZWQ6IHRydWUsXG4gICAgICBzb3VyY2VNYXBDb250ZW50czogdHJ1ZVxuICAgIH07XG5cbiAgICB0aGlzLnNlZW5GaWxlUGF0aHMgPSB7fTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRJbnB1dE1pbWVUeXBlcygpIHtcbiAgICByZXR1cm4gbWltZVR5cGVzO1xuICB9XG5cbiAgYXN5bmMgc2hvdWxkQ29tcGlsZUZpbGUoZmlsZU5hbWUsIGNvbXBpbGVyQ29udGV4dCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBhc3luYyBkZXRlcm1pbmVEZXBlbmRlbnRGaWxlcyhzb3VyY2VDb2RlLCBmaWxlUGF0aCwgY29tcGlsZXJDb250ZXh0KSB7XG4gICAgcmV0dXJuIHRoaXMuZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXNTeW5jKHNvdXJjZUNvZGUsIGZpbGVQYXRoLCBjb21waWxlckNvbnRleHQpO1xuICB9XG5cbiAgYXN5bmMgY29tcGlsZShzb3VyY2VDb2RlLCBmaWxlUGF0aCwgY29tcGlsZXJDb250ZXh0KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICBzYXNzID0gc2FzcyB8fCB0aGlzLmdldFNhc3MoKTtcblxuICAgIGxldCB0aGlzUGF0aCA9IHBhdGguZGlybmFtZShmaWxlUGF0aCk7XG4gICAgdGhpcy5zZWVuRmlsZVBhdGhzW3RoaXNQYXRoXSA9IHRydWU7XG5cbiAgICBsZXQgcGF0aHMgPSBPYmplY3Qua2V5cyh0aGlzLnNlZW5GaWxlUGF0aHMpO1xuXG4gICAgaWYgKHRoaXMuY29tcGlsZXJPcHRpb25zLnBhdGhzKSB7XG4gICAgICBwYXRocy5wdXNoKC4uLnRoaXMuY29tcGlsZXJPcHRpb25zLnBhdGhzKTtcbiAgICB9XG5cbiAgICBwYXRocy51bnNoaWZ0KCcuJyk7XG5cbiAgICBzYXNzLmltcG9ydGVyKHRoaXMuYnVpbGRJbXBvcnRlckNhbGxiYWNrKHBhdGhzKSk7XG5cbiAgICBsZXQgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29tcGlsZXJPcHRpb25zLCB7XG4gICAgICBpbmRlbnRlZFN5bnRheDogZmlsZVBhdGgubWF0Y2goL1xcLnNhc3MkL2kpLFxuICAgICAgc291cmNlTWFwUm9vdDogZmlsZVBhdGgsXG4gICAgfSk7XG5cbiAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlcyxyZWopID0+IHtcbiAgICAgIHNhc3MuY29tcGlsZShzb3VyY2VDb2RlLCBvcHRzLCAocikgPT4ge1xuICAgICAgICBpZiAoci5zdGF0dXMgIT09IDApIHtcbiAgICAgICAgICByZWoobmV3IEVycm9yKHIuZm9ybWF0dGVkIHx8IHIubWVzc2FnZSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcyhyKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBsZXQgc291cmNlID0gcmVzdWx0LnRleHQ7XG5cbiAgICAvLyBOQjogSWYgeW91IGNvbXBpbGUgYSBmaWxlIHRoYXQgaXMgc29sZWx5IGltcG9ydHMsIGl0c1xuICAgIC8vIGFjdHVhbCBjb250ZW50IGlzICcnIHlldCBpdCBpcyBhIHZhbGlkIGZpbGUuICcnIGlzIG5vdFxuICAgIC8vIHRydXRoeSwgc28gd2UncmUgZ29pbmcgdG8gcmVwbGFjZSBpdCB3aXRoIGEgc3RyaW5nIHRoYXRcbiAgICAvLyBpcyB0cnV0aHkuXG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgIHNvdXJjZSA9ICcgJztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29kZTogc291cmNlLFxuICAgICAgbWltZVR5cGU6ICd0ZXh0L2NzcydcbiAgICB9O1xuICB9XG5cbiAgc2hvdWxkQ29tcGlsZUZpbGVTeW5jKGZpbGVOYW1lLCBjb21waWxlckNvbnRleHQpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXNTeW5jKHNvdXJjZUNvZGUsIGZpbGVQYXRoLCBjb21waWxlckNvbnRleHQpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIGxldCBkZXBlbmRlbmN5RmlsZW5hbWVzID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKSA9PT0gJy5zYXNzJyA/IGRldGVjdGl2ZVNBU1Moc291cmNlQ29kZSkgOiBkZXRlY3RpdmVTQ1NTKHNvdXJjZUNvZGUpO1xuICAgIGxldCBkZXBlbmRlbmNpZXMgPSBbXTtcblxuICAgIGZvciAobGV0IGRlcGVuZGVuY3lOYW1lIG9mIGRlcGVuZGVuY3lGaWxlbmFtZXMpIHtcbiAgICAgIGRlcGVuZGVuY2llcy5wdXNoKHNhc3NMb29rdXAoZGVwZW5kZW5jeU5hbWUsIHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpLCBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlcGVuZGVuY2llcztcbiAgfVxuXG4gIGNvbXBpbGVTeW5jKHNvdXJjZUNvZGUsIGZpbGVQYXRoLCBjb21waWxlckNvbnRleHQpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIHNhc3MgPSBzYXNzIHx8IHRoaXMuZ2V0U2FzcygpO1xuXG4gICAgbGV0IHRoaXNQYXRoID0gcGF0aC5kaXJuYW1lKGZpbGVQYXRoKTtcbiAgICB0aGlzLnNlZW5GaWxlUGF0aHNbdGhpc1BhdGhdID0gdHJ1ZTtcblxuICAgIGxldCBwYXRocyA9IE9iamVjdC5rZXlzKHRoaXMuc2VlbkZpbGVQYXRocyk7XG5cbiAgICBpZiAodGhpcy5jb21waWxlck9wdGlvbnMucGF0aHMpIHtcbiAgICAgIHBhdGhzLnB1c2goLi4udGhpcy5jb21waWxlck9wdGlvbnMucGF0aHMpO1xuICAgIH1cblxuICAgIHBhdGhzLnVuc2hpZnQoJy4nKTtcbiAgICBzYXNzLmltcG9ydGVyKHRoaXMuYnVpbGRJbXBvcnRlckNhbGxiYWNrKHBhdGhzKSk7XG5cbiAgICBsZXQgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29tcGlsZXJPcHRpb25zLCB7XG4gICAgICBpbmRlbnRlZFN5bnRheDogZmlsZVBhdGgubWF0Y2goL1xcLnNhc3MkL2kpLFxuICAgICAgc291cmNlTWFwUm9vdDogZmlsZVBhdGgsXG4gICAgfSk7XG5cbiAgICBsZXQgcmVzdWx0O1xuICAgIHRvdXRTdWl0ZSgoKSA9PiB7XG4gICAgICBzYXNzLmNvbXBpbGUoc291cmNlQ29kZSwgb3B0cywgKHIpID0+IHtcbiAgICAgICAgaWYgKHIuc3RhdHVzICE9PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHIuZm9ybWF0dGVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSByO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBsZXQgc291cmNlID0gcmVzdWx0LnRleHQ7XG5cbiAgICAvLyBOQjogSWYgeW91IGNvbXBpbGUgYSBmaWxlIHRoYXQgaXMgc29sZWx5IGltcG9ydHMsIGl0c1xuICAgIC8vIGFjdHVhbCBjb250ZW50IGlzICcnIHlldCBpdCBpcyBhIHZhbGlkIGZpbGUuICcnIGlzIG5vdFxuICAgIC8vIHRydXRoeSwgc28gd2UncmUgZ29pbmcgdG8gcmVwbGFjZSBpdCB3aXRoIGEgc3RyaW5nIHRoYXRcbiAgICAvLyBpcyB0cnV0aHkuXG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgIHNvdXJjZSA9ICcgJztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29kZTogc291cmNlLFxuICAgICAgbWltZVR5cGU6ICd0ZXh0L2NzcydcbiAgICB9O1xuICB9XG5cbiAgZ2V0U2FzcygpIHtcbiAgICBsZXQgcmV0O1xuICAgIHRvdXRTdWl0ZSgoKSA9PiByZXQgPSByZXF1aXJlKCdzYXNzLmpzL2Rpc3Qvc2Fzcy5ub2RlJykuU2Fzcyk7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGJ1aWxkSW1wb3J0ZXJDYWxsYmFjayAoaW5jbHVkZVBhdGhzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIChmdW5jdGlvbiAocmVxdWVzdCwgZG9uZSkge1xuICAgICAgbGV0IGZpbGU7XG4gICAgICBpZiAocmVxdWVzdC5maWxlKSB7XG4gICAgICAgIGRvbmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc2Fzcy5qcyB3b3JrcyBpbiB0aGUgJy9zYXNzLycgZGlyZWN0b3J5XG4gICAgICAgIGNvbnN0IGNsZWFuZWRSZXF1ZXN0UGF0aCA9IHJlcXVlc3QucmVzb2x2ZWQucmVwbGFjZSgvXlxcL3Nhc3NcXC8vLCAnJyk7XG4gICAgICAgIGZvciAobGV0IGluY2x1ZGVQYXRoIG9mIGluY2x1ZGVQYXRocykge1xuICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5yZXNvbHZlKGluY2x1ZGVQYXRoLCBjbGVhbmVkUmVxdWVzdFBhdGgpO1xuICAgICAgICAgIGxldCB2YXJpYXRpb25zID0gc2Fzcy5nZXRQYXRoVmFyaWF0aW9ucyhmaWxlUGF0aCk7XG5cbiAgICAgICAgICBmaWxlID0gdmFyaWF0aW9uc1xuICAgICAgICAgICAgLm1hcChzZWxmLmZpeFdpbmRvd3NQYXRoLmJpbmQoc2VsZikpXG4gICAgICAgICAgICAucmVkdWNlKHNlbGYuaW1wb3J0ZWRGaWxlUmVkdWNlci5iaW5kKHNlbGYpLCBudWxsKTtcblxuICAgICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KTtcbiAgICAgICAgICAgIHJldHVybiBzYXNzLndyaXRlRmlsZShmaWxlLCBjb250ZW50LCAoKSA9PiB7XG4gICAgICAgICAgICAgIGRvbmUoeyBwYXRoOiBmaWxlIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWZpbGUpIHtcbiAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpbXBvcnRlZEZpbGVSZWR1Y2VyKGZvdW5kLCBwYXRoKSB7XG4gICAgLy8gRmluZCB0aGUgZmlyc3QgdmFyaWF0aW9uIHRoYXQgYWN0dWFsbHkgZXhpc3RzXG4gICAgaWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHBhdGgpO1xuICAgICAgaWYgKCFzdGF0LmlzRmlsZSgpKSByZXR1cm4gbnVsbDtcbiAgICAgIHJldHVybiBwYXRoO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZml4V2luZG93c1BhdGgoZmlsZSkge1xuICAgIC8vIFVuZm9ydHVuYXRlbHksIHRoZXJlJ3MgYSBidWcgaW4gc2Fzcy5qcyB0aGF0IHNlZW1zIHRvIGlnbm9yZSB0aGUgZGlmZmVyZW50XG4gICAgLy8gcGF0aCBzZXBhcmF0b3JzIGFjcm9zcyBwbGF0Zm9ybXNcblxuICAgIC8vIEZvciBzb21lIHJlYXNvbiwgc29tZSBmaWxlcyBoYXZlIGEgbGVhZGluZyBzbGFzaCB0aGF0IHdlIG5lZWQgdG8gZ2V0IHJpZCBvZlxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInICYmIGZpbGVbMF0gPT09ICcvJykge1xuICAgICAgZmlsZSA9IGZpbGUuc2xpY2UoMSk7XG4gICAgfVxuXG4gICAgLy8gU2Fzcy5qcyBnZW5lcmF0ZXMgcGF0aHMgc3VjaCBhcyBgX0M6XFxteVBhdGhcXGZpbGUuc2Fzc2AgaW5zdGVhZCBvZiBgQzpcXG15UGF0aFxcX2ZpbGUuc2Fzc2BcbiAgICBpZiAoZmlsZVswXSA9PT0gJ18nKSB7XG4gICAgICBjb25zdCBwYXJ0cyA9IGZpbGUuc2xpY2UoMSkuc3BsaXQocGF0aC5zZXApO1xuICAgICAgY29uc3QgZGlyID0gcGFydHMuc2xpY2UoMCwgLTEpLmpvaW4ocGF0aC5zZXApO1xuICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXJ0cy5yZXZlcnNlKClbMF07XG4gICAgICBmaWxlID0gcGF0aC5yZXNvbHZlKGRpciwgJ18nICsgZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gZmlsZTtcbiAgfVxuXG4gIGdldENvbXBpbGVyVmVyc2lvbigpIHtcbiAgICAvLyBOQjogVGhlcmUgaXMgYSBiaXphcnJlIGJ1ZyBpbiB0aGUgbm9kZSBtb2R1bGUgc3lzdGVtIHdoZXJlIHRoaXMgZG9lc24ndFxuICAgIC8vIHdvcmsgYnV0IG9ubHkgaW4gc2F2ZUNvbmZpZ3VyYXRpb24gdGVzdHNcbiAgICAvL3JldHVybiByZXF1aXJlKCdAcGF1bGNiZXR0cy9ub2RlLXNhc3MvcGFja2FnZS5qc29uJykudmVyc2lvbjtcbiAgICByZXR1cm4gXCI0LjEuMVwiO1xuICB9XG59XG4iXX0=