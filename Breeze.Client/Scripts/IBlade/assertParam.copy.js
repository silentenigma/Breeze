﻿
define(["coreFns"], function (core) {

    // The %1 parameter 
    // is required
    // must be a %2
    // must be an instance of %2
    // must be an instance of the %2 enumeration
    // must have a %2 property
    // must be an array where each element  
    // is optional or 

    var Param = function (v, name) {
        this.v = v;
        this.name = name;
        this._fns = [null];
        this._pending = [];
    };
    var proto = Param.prototype;

    proto.isObject = function() {
        return this.isTypeOf("object");
    };

    proto.isBoolean = function () {
        return this.isTypeOf('boolean');
    };

    proto.isString = function () {
        return this.isTypeOf('string');
    };

    proto.isNonEmptyString = function() {
        var result = function(that, v) {
            if (v == null) return false;
            return (typeof(v) === 'string') && v.length > 0;
        };
        result.getMessage = function() {
            return " must be a nonEmpty string";
        };
        return this.compose(result);
    };

    proto.isNumber = function () {
        return this.isTypeOf('number');
    };

    proto.isFunction = function () {
        return this.isTypeOf('function');
    };

    proto.isTypeOf = function (typeName) {
        var result = function (that, v) {
            if (v == null) return false;
            if (typeof (v) === typeName) return true;
            return false;
        };
        result.getMessage = function () {
            return core.formatString(" must be a '%1'", typeName);
        };
        return this.compose(result);
    };

    proto.isInstanceOf = function (type, typeName) {
        var result = function (that, v) {
            if (v == null) return false;
            return (v instanceof type);
        };
        typeName = typeName || type.prototype._$typeName;
        result.getMessage = function () {
            return core.formatString(" must be an instance of '%1'", typeName);
        };
        return this.compose(result);
    };

    proto.hasProperty = function (propertyName) {
        var result = function (that, v) {
            if (v == null) return false;
            return (v[propertyName] !== undefined);
        };
        result.getMessage = function () {
            return core.formatString(" must have a '%1' property ", propertyName);
        };
        return this.compose(result);
    };

    proto.isEnumOf = function (enumType) {
        var result = function (that, v) {
            if (v == null) false;
            return enumType.contains(v);
        };
        result.getMessage = function () {
            return core.formatString(" must be an instance of the '%1' enumeration", enumType.name);
        };
        return this.compose(result);
    };

    proto.isRequired = function(allowNull) {
        var result = function (that, v) {
            if (allowNull) {
                return v !== undefined;
            } else {
                return v != null;
            }
        };
        result.getMessage = function() {
            return " is required";
        };
        return this.compose(result);
    };
    
    // combinable methods.

    proto.isOptional = function () {
        if (this._fn) {
            setFn(this, makeOptional(this._fn));
        } else {
            this._pending.push(function (that, fn) {
                return makeOptional(fn);
            });
        }
        return this;
    };

    proto.isNonEmptyArray = function () {
        return this.isArray(true);
    };

    proto.isArray = function (mustBeNonEmpty) {
        if (this._fn) {
            setFn(this, makeArray(this._fn, mustBeNonEmpty));
        } else {
            setFn(this, makeArray(null, mustBeNonEmpty));
            this._pending.push(function (that, fn) {
                return makeArray(fn, mustBeNonEmpty);
            });
        }
        return this;
    };

    proto.or = function () {
        this._fns.push(null);
        this._fn = null;
        return this;
    };   

    proto.check = function (defaultValue) {
        var fn = compile(this);
        if (!fn) return;
        var ok = fn(this, this.v);
        if (!ok) {
            var msg = this._getMessage();
            clean(this);
            throw new Error(msg);
        }
        clean(this);
        
        if (this.v !== undefined) {
            return this.v;
        } else {
            return defaultValue;
        }
    };
    
    proto._getMessage = function() {
        var msg = this._fns.map(function (fn) {
            return fn.getMessage();
        }).join(", or it");
        return core.formatString(this.MESSAGE_PREFIX, this.name) + " " + msg;
    };

    //proto.checkMsg = function () {
    //    var fn = compile(this);
    //    if (!fn) return;
    //    if (!fn(this, this.v)) {
    //        return this.getMessage();
    //    }
    //};

    proto.withDefault = function(defaultValue) {
        this.defaultValue = defaultValue;
        return this;
    };
    
    proto.whereParam = function(propName) {
        return this.parent.whereParam(propName);
    };
    
    proto.applyAll = function (instance, throwIfUnknownProperty) {
        throwIfUnknownProperty = throwIfUnknownProperty == null ? true : throwIfUnknownProperty;
        var clone = core.extend({}, this.parent.config);
        this.parent.params.forEach(function (p) {
            if (throwIfUnknownProperty) delete clone[p.name];
            p._applyOne(instance);
        });
        // should be no properties left in the clone
        if (throwIfUnknownProperty) {
            for (var key in clone) {
                throw new Error("Invalid property in config: " + key);
            }
        }
    };

    proto._applyOne = function( instance ) {
        this.check();
        if (this.v !== undefined) {
            instance[this.name] = this.v;
        } else {
            if (this.defaultValue !== undefined) {
                instance[this.name] = this.defaultValue;
            }
        }
    };

    proto.compose = function (fn) {
        if (this._pending.length > 0) {
            while (this._pending.length > 0) {
                var pending = this._pending.pop();
                fn = pending(this, fn);
            }
            setFn(this, fn);
        } else {
            if (this._fn) {
                throw new Error("Illegal construction - use 'or' to combine checks");
            }
            setFn(this, fn);
        }
        return this;
    };
    
    function clean(that) {
        that._fn = null;
        that._fns = null;
        that._pending = null;
    }

    proto.MESSAGE_PREFIX = "The '%1' parameter ";

    var assertParam = function (v, name) {
        return new Param(v, name);
    };

    var CompositeParam = function(config) {
        if (typeof (config) !== "object") {
            throw new Error("Configuration parameter should be an object, instead it is a: " + typeof (config) );
        }
        this.config = config;
        this.params = [];
    };
    var cproto = CompositeParam.prototype;

    cproto.whereParam = function(propName) {
        var param = new Param(this.config[propName], propName);
        param.parent = this;
        this.params.push(param);
        return param;
    };
    


    var assertConfig = function(config) {
        return new CompositeParam(config);
    };

    // private functions

    function makeOptional(fn) {
        var result = function (that, v) {
            if (v == null) return true;
            return fn(that, v);
        };

        result.getMessage = function () {
            return " is optional, or it" + fn.getMessage();
        };
        return result;
    }

    function makeArray(fn, mustNotBeEmpty) {
        var result = function (that, v) {
            if (!Array.isArray(v)) {
                return false;
            }
            if (mustNotBeEmpty) {
                if (v.length === 0) return false;
            }
            // allow standalone is array call.
            if (!fn) return true;

            return v.every(function (v1) {
                return fn(that, v1);
            });
        };
        result.getMessage = function () {
            var arrayDescr = mustNotBeEmpty ? "a nonEmpty array" : "an array";
            var element = fn ? " where each element" + fn.getMessage() : "";
            return " must be " + arrayDescr + element;
        };
        return result;
    }



    function setFn(that, fn) {
        that._fns[that._fns.length - 1] = fn;
        that._fn = fn;
    }

    function compile(self) {
        // clear off last one if null 
        if (self._fns[self._fns.length - 1] == null) {
            self._fns.pop();
        }
        if (self._fns.length === 0) {
            return undefined;
        }
        return function (that, v) {
            return that._fns.some(function (fn) {
                return fn(that, v);
            });
        };
        //if (!self._compiledFn) {
        //    // clear off last one if null 
        //    if (self._fns[self._fns.length - 1] == null) {
        //        self._fns.pop();
        //    }
        //    if (self._fns.length === 0) {
        //        return undefined;
        //    }
        //    self._compiledFn = function (that, v) {
        //        return that._fns.some(function (fn) {
        //            return fn(that, v);
        //        });
        //    };
        //};
        //return self._compiledFn;
    }


    // Param is exposed so that additional 'is' methods can be added to the prototype.
    return { Param: Param, assertParam: assertParam, assertConfig: assertConfig };



})