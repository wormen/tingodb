import _ from 'lodash';

module.exports.intersectIndexes = function (indexes, base) {
  // do intersection of indexes using hashes
  let ops = [], i = 0;
  // convert to hashes
  for (let i = 0; i < indexes.length; i++) {
    let ids = Object.create(null);
    _.each(indexes[i], function (id) {
      ids[id] = id;
    });
    ops.push(ids);
  }
  // find minimal one
  if (_.isUndefined(base)) {
    base = 0;
    for (i = 0; i < ops.length; i++) {
      if (ops[i].length < ops[base].length) {
        base = i;
      }
    }
  }

  // iterate over it
  let m = [];
  _.each(indexes[base], function (id) {
    let match = true;
    for (let i = 0; i < ops.length; i++) {
      if (i === base) {
        continue;
      }

      if (!ops[i][id]) {
        match = false;
        break;
      }
    }

    if (match) {
      m.push(id);
    }
  });
  return m;
};
