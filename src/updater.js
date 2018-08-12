import _ from 'lodash';

function ensurePath(obj, k, cb) {
  let path = k.split(".");
  let t = null;
  if (path.length == 1) {
    t = obj;
  } else {
    let l = obj;
    for (let i = 0; i < path.length - 1; i++) {
      let p = path[i];
      if (!l[p]) {
        l[p] = {};
      }
      l = l[p];
    }
    t = l;
    k = path[i];
  }
  cb(t, k);
}

function applySet(obj, $set) {
  _.each($set, function (v, k) {
    _.set(obj, k, v);
  });
}

function applyUnset(obj, $unset) {
  _.each($unset, function (v, k) {
    _.unset(obj, k);
  });
}

function applyInc(obj, $inc) {
  _.each($inc, function (v, k) {
    ensurePath(obj, k, function (t, k) {
      if (!t[k]) {
        t[k] = 0;
      }

      if (!_.isFinite(t[k])) {
        throw new Error("Cannot apply $inc modifier to non-number");
      }
      t[k] += v;
    });
  });
}

function applyPush(obj, $push) {
  _.each($push, function (v, k) {
    ensurePath(obj, k, function (t, k) {
      if (!t[k]) {
        t[k] = v.$each ? v.$each : [v];
      } else {
        if (!_.isArray(t[k])) {
          throw new Error("Cannot apply $push/$pushAll modifier to non-array");
        }

        if (v.$each) {
          t[k] = t[k].concat(v.$each);
        } else {
          t[k].push(v);
        }
      }
    });
  });
}

function applyPop(obj, $op) {
  _.each($op, function (v, k) {
    let path = k.split(".");
    let t = obj;
    let i = 0;
    for (i; i < path.length - 1 && t[path[i]]; t = t[path[i++]]) ;
    k = path[i];
    if (t == null || t[k] == null) {
      return;
    }

    if (Array.isArray(t[k])) {
      if (v >= 0) {
        t[k] = t[k].slice(0, -1);
      } else if (v === -1) {
        t[k] = t[k].slice(1);
      }
    } else {
      throw new Error("Cannot apply $pop modifier to non-array");
    }
  });
}

function applyPull(obj, $op, tdb) {
  _.each($op, function (v, k) {
    let path = k.split(".");
    let t = obj;
    let i = 0;
    for (i; i < path.length - 1 && t[path[i]]; t = t[path[i++]]) ;
    k = path[i];
    if (t == null || t[k] == null) {
      return;
    }

    if (Array.isArray(t[k])) {
      let qt = tdb.Finder.matcher({v: v});
      let matcher = new Function("obj", "return " + (qt.native()));
      t[k] = _.reject(t[k], function (obj) {
        return matcher({v: obj});
      });
    } else {
      throw new Error("Cannot apply $pull/$pullAll modifier to non-array");
    }
  });
}

function applyPullAll(obj, $op) {
  _.each($op, function (v, k) {
    let path = k.split(".");
    let t = obj;
    let i = 0;
    for (i; i < path.length - 1 && t[path[i]]; t = t[path[i++]]) ;
    k = path[i];
    if (t == null || t[k] == null) {
      return;
    }

    if (Array.isArray(t[k])) {
      t[k] = _.difference(t[k], v);
    } else {
      throw new Error("Cannot apply $pull/$pullAll modifier to non-array");
    }
  });
}

function applyRename(obj, $op) {
  _.each($op, function (v, k) {
    let path = k.split(".");
    let t = obj;
    let i = 0;
    for (i; i < path.length - 1 && t[path[i]]; t = t[path[i++]]) ;
    k = path[i];
    if (t == null || t[k] == null) {
      return;
    }

    ensurePath(obj, v, function (t1, k1) {
      t1[k1] = t[k];
      delete t[k];
    });
  });
}

function applyAddToSet(obj, $op) {
  _.each($op, function (v, k) {
    ensurePath(obj, k, function (t, k) {
      if (!t[k]) {
        t[k] = v.$each ? v.$each : [v];
      } else {
        if (!Array.isArray(t[k])) {
          throw new Error("Cannot apply $addToSet modifier to non-array");
        }

        if (v.$each) {
          t[k] = _.union(t[k], v.$each);
        } else {
          if (!_.includes(t[k], v)) {
            t[k].push(v);
          }
        }
      }
    });
  });
}

function applyPushAll(obj, $pushAll) {
  _.each($pushAll, function (v, k) {
    ensurePath(obj, k, function (t, k) {
      if (!t[k]) {
        t[k] = v;
      } else {
        if (!_.isArray(t[k])) {
          throw new Error("Cannot apply $push/$pushAll modifier to non-array");
        }

        t[k] = t[k].concat(v);
      }
    });
  });
}

export default class Updater {
  constructor(op, tdb) {
    this._op = op;
    this._tdb = tdb;
  }

  hasAtomic() {
    return _.findKey(this._op, function (v, k) {
      return k[0] === "$";
    }) != null;
  }

  update($doc, upsert) {
    if (this._op.$set) {
      applySet($doc, this._op.$set);
    }

    if (this._op.$unset) {
      applyUnset($doc, this._op.$unset);
    }

    if (this._op.$inc) {
      applyInc($doc, this._op.$inc);
    }

    if (this._op.$push) {
      applyPush($doc, this._op.$push);
    }

    if (this._op.$pushAll) {
      applyPushAll($doc, this._op.$pushAll);
    }

    if (this._op.$addToSet) {
      applyAddToSet($doc, this._op.$addToSet);
    }

    if (this._op.$pop) {
      applyPop($doc, this._op.$pop);
    }

    if (this._op.$pull) {
      applyPull($doc, this._op.$pull, tdb);
    }

    if (this._op.$pullAll) {
      applyPullAll($doc, this._op.$pullAll);
    }

    if (this._op.$rename) {
      applyRename($doc, this._op.$rename);
    }

    if (upsert && this._op.$setOnInsert) {
      applySet($doc, this._op.$setOnInsert);
    }
  }
}
