"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse_error = exports.Duplicated = exports.NothingChanged = exports.NotFound = exports.ValidationError = void 0;
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "ValidationError";
        _this.status = 400;
        return _this;
    }
    return ValidationError;
}(Error));
exports.ValidationError = ValidationError;
var NotFound = /** @class */ (function (_super) {
    __extends(NotFound, _super);
    function NotFound(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "NotFound";
        _this.status = 404;
        return _this;
    }
    return NotFound;
}(Error));
exports.NotFound = NotFound;
var NothingChanged = /** @class */ (function (_super) {
    __extends(NothingChanged, _super);
    function NothingChanged(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "NothingChanged";
        _this.status = 200;
        return _this;
    }
    return NothingChanged;
}(Error));
exports.NothingChanged = NothingChanged;
var Duplicated = /** @class */ (function (_super) {
    __extends(Duplicated, _super);
    function Duplicated(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "Duplicated";
        _this.status = 404;
        return _this;
    }
    return Duplicated;
}(Error));
exports.Duplicated = Duplicated;
function parse_error(res, error) {
    console.log(error);
    if (error instanceof ValidationError || error instanceof NotFound || error instanceof NothingChanged || error instanceof Duplicated)
        return res.status(error.status).json({
            success: false,
            error: error.message
        });
    if (error instanceof SyntaxError) {
        return res.status(400).json({
            success: false,
            error: "Json error:" + error.message
        });
    }
    console.log("parse_error:", error);
    return res.status(500).json({
        success: false,
        error: error.message
    });
}
exports.parse_error = parse_error;
