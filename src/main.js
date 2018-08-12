/**
 Copyright © Oleg Bogdanov
 Developer: Oleg Bogdanov
 Contacts: https://github.com/wormen
 ---------------------------------------------
 */

import safe from 'safe';
import {ObjectID} from 'bson';
import DB from './tdb';
import Code from './tcode';
import TColl from './tcoll';
import Binary from './tbinary';

module.exports = function (opts = {}) {
  const ObjectID = opts.nativeObjectID ? ObjectID : require('./ObjectId');
  if (opts.nativeObjectID) {
    ObjectID.prototype.valueOf = function () {
      return this.toString();
    };
  }

  function gdb(path, optsLocal) {
    DB.call(this, path, optsLocal, opts);
    this.ObjectID = ObjectID;
    this.Code = Code;
    this.Binary = Binary;
    this.Finder = require('./finder')(this);
  }

  safe.inherits(gdb, DB);

  return {
    Db: gdb,
    Collection: TColl,
    Code,
    Binary,
    ObjectID
  };
};
