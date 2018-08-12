import LeafNode from './leaf_node';

const default_options = {
  order: 100, // Min 1
  sort: 1 // 1, -1 or array
};

class BPlusTree {
  constructor(options) {
    this.options = Object.assign({}, default_options, options || {});

    if (Array.isArray(this.options.sort)) {
      this._compare = (a1, a2) => {
        if (a2.length > a1.length) {
          return -this._compare(a2, a1);
        }

        for (let i = 0; i < a1.length; i++) {
          if (i >= a2.length) {
            return this.options.sort[i];
          }

          let v1 = a1[i];
          let v2 = a2[i];
          if (v1 < v2) {
            return -this.options.sort[i];
          } else if (v1 > v2) {
            return this.options.sort[i];
          }
        }
        return 0;
      };
    } else this._compare = (k1, k2) => {
      if (k1 < k2) {
        return -this.options.sort;
      } else if (k1 > k2) {
        return this.options.sort;
      } else if (k1 === k2) {
        return 0;
      }
      // else FIXME: probably different data types
    };

    this.root = new LeafNode(options.order, this._compare);
  }

  set(key, value) {
    let node = this._search(key);
    let ret = node.insert(key, value);
    if (ret) {
      this.root = ret;
    }
  }

  get(key) {
    let node = this._search(key);
    for (let i = 0; i < node.data.length; i++) {
      if (this._compare(node.data[i].key, key) === 0) {
        return node.data[i].value;
      }
    }
    return null;
  }

  del(key) {
    let node = this._search(key);
    for (let i = 0; i < node.data.length; i++) {
      if (this._compare(node.data[i].key, key) === 0) {
        node.data.splice(i, 1);
        // TODO, NOTE SURE IF THIS IS ENOUGH
        break;
      }
    }
    return null;
  }

  getNode(key) {
    return this._search(key);
  }

  _search(key) {
    let current = this.root;
    let found = false;

    while (current.isInternalNode) {
      found = false;
      let len = current.data.length;
      for (let i = 1; i < len; i += 2) {
        if (this._compare(key, current.data[i]) <= 0) {
          current = current.data[i - 1];
          found = true;
          break;
        }
      }

      // Follow infinity pointer
      if (!found) {
        current = current.data[len - 1];
      }
    }

    return current;
  }

  // walk the tree in order
  each(callback, node) {
    if (!node) {
      node = this.root;
    }
    let current = node;
    if (current.isLeafNode) {
      for (let i = 0; i < current.data.length; i++) {
        node = current.data[i];
        if (node.value) {
          callback(node.key, node.value);
        }
      }
    } else {
      for (let i = 0; i < node.data.length; i += 2) {
        this.each(callback, node.data[i]);
      }
    }
  }

  // walk the tree in order
  all(node, res) {
    if (!res)
      res = [];
    if (!node) {
      node = this.root;
    }

    let current = node;
    if (current.isLeafNode) {
      for (let i = 0; i < current.data.length; i++) {
        node = current.data[i];
        res.push(node.value);
      }
    } else {
      for (let i = 0; i < node.data.length; i += 2) {
        this.all(node.data[i], res);
      }
    }
    return res;
  }

  each_reverse(callback, node) {
    if (!node) {
      node = this.root;
    }

    let current = node;
    if (current.isLeafNode) {
      for (let i = current.data.length - 1; i >= 0; i--) {
        node = current.data[i];
        if (node.value) {
          callback(node.key, node.value);
        }
      }
    } else {
      for (let i = node.data.length - 1; i >= 0; i -= 2) {
        this.each(callback, node.data[i]);
      }
    }
  }

  // Get a range
  range(start, end, callback) {
    let node = this._search(start);
    if (!node) {
      node = this.root;
      while (!node.isLeafNode) {
        node = node[0]; // smallest node
      }
    }

    let ended = false;

    while (!ended) {
      for (let i = 0; i < node.data.length; i++) {
        let data = node.data[i];
        let key = data.key;
        if (end && this._compare(key, end) > 0) {
          ended = true;
          break;
        } else {
          if ((start === undefined || this._compare(start, key) <= 0) && (end === undefined || this._compare(end, key) >= 0) && data.value) {
            callback(key, data.value);
          }
        }
      }
      node = node.nextNode;
      if (!node) {
        ended = true;
      }
    }
  }

  rangeSync(start, end, exclusive_start, exclusive_end) {
    let values = [];
    let node = this._search(start);
    if (!node) {
      node = this.root;
      while (!node.isLeafNode) {
        node = node[0]; // smallest node
      }
    }

    let ended = false;

    const keyCheck = (key) => {
      return (start === undefined
        || start === null
        || !exclusive_start && this._compare(start, key) <= 0
        || exclusive_start && this._compare(start, key) < 0
      ) && (
        end === undefined
        || end === null
        || !exclusive_end && this._compare(end, key) >= 0
        || exclusive_end && this._compare(end, key) > 0
      );
    };

    while (!ended) {
      if (values.length && node.data.length > 0 && keyCheck(node.data[0].key, node.data[0].value) &&
        keyCheck(node.data[node.data.length - 1].key, node.data[node.data.length - 1].value)) {
        // entire node is in range
        for (let i = 0; i < node.data.length; i++) {
          values.push(node.data[i].value);
        }
      } else {
        for (let i = 0; i < node.data.length; i++) {
          let data = node.data[i];
          let key = data.key;
          if (end && this._compare(key, end) > 0) {
            ended = true;
            break;
          } else {
            if (keyCheck(key, data.value)) {
              values.push(data.value);
            }
          }
        }
      }
      node = node.nextNode;
      if (!node) {
        ended = true;
      }
    }
    return values;
  }

  // B+ tree dump routines
  walk(node, level, arr) {
    let current = node;
    if (!arr[level]) {
      arr[level] = [];
    }

    if (current.isLeafNode) {
      for (let i = 0; i < current.data.length; i++) {
        arr[level].push(`<${current.data[i].key}>`);
      }
      arr[level].push(` -> `);
    } else {
      for (let i = 1; i < node.data.length; i += 2) {
        arr[level].push(`<${node.data[i]}>`);
      }
      arr[level].push(` -> `);
      for (let i = 0; i < node.data.length; i += 2) {
        this.walk(node.data[i], level + 1, arr);
      }

    }
    return arr;
  }

  dump() {
    let arr = [];
    this.walk(this.root, 0, arr);
    let s = '';
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr[i].length; j++) {
        s += arr[i][j];
      }
    }
    return s;
  }
}

module.exports.create = function (options) {
  return new BPlusTree(options);
};
