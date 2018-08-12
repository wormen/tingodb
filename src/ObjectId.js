var _ = require('lodash');
const reg = /^-?\d+$/;

let inproc_id = -1;
let tempset = Object.create(null);

class ObjectID {
  constructor(val) {
    // every new instance will have temporary inproc unique value
    // minus sign will let know to db layer that value is temporary
    // and need to be replaced
    this.id = --inproc_id;
    this._init(val);
    // we need to keep track all temporary instances with goal
    // to update them at later tima
    if (this.id < 0) {
      if (!tempset[this.id])
        tempset[this.id] = [this];
      else
        tempset[this.id].push(this);
    }
  }

  _persist(v) {
    let oldid = this.id;
    if (oldid < 0) {
      _.each(tempset[oldid], function (oid) {
        oid.id = v;
      });
      delete tempset[oldid];
    }
  }

  _init(val) {
    if (_.isInteger(val)) {
      this.id = val;
    } else if (val instanceof ObjectID) {
      this.id = val.id;
    } else if (_.isString(val)) {
      if (reg.test(val)) {
        this.id = Number(val);
      } else {
        this.id = NaN;
      }
    }
    if (val && isNaN(this.id)) {
      throw new Error("ObjectId should be ObjectId (whatever it is designed to be) " + val);
    }
  }

  toString() {
    return this.id.toString();
  }

  inspect() {
    return this.id.toString();
  }

  toJSON() {
    return this.id;
  }

  valueOf() {
    return this.id;
  }

  equals(val) {
    if (val instanceof ObjectID) {
      return this.id === val.id;
    }

    let temp = new ObjectID(val);
    return this.id === temp.id;
  }

  // Something for fake compatibiltity with BSON.ObjectId
  toHexString() {
    let l = this.id.toString();
    let zeros = "000000000000000000000000";
    return zeros.substr(0, zeros.length - l.length) + l;
  }

  static createFromHexString(str) {
    return new ObjectID(str);
  }

  static createFromString(str) {
    return new ObjectID(str);
  }
}

module.exports = ObjectID;
