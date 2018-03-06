// ==UserScript==
// @name         ykh5p
// @namespace    https://github.com/gooyie/ykh5p
// @homepageURL  https://github.com/gooyie/ykh5p
// @supportURL   https://github.com/gooyie/ykh5p/issues
// @updateURL    https://raw.githubusercontent.com/gooyie/ykh5p/master/ykh5p.user.js
// @version      0.12.2
// @description  改善优酷官方html5播放器播放体验
// @author       gooyie
// @license      MIT License
//
// @include      *://v.youku.com/*
// @include      *://player.youku.com/embed/*
// @grant        GM_info
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    /* eslint-disable no-console */
    class Logger {

        static get tag() {
            return `[${GM_info.script.name}]`;
        }

        static log(...args) {
            console.log('%c' + this.tag + '%c' + args.shift(),
                'color: #fff; background: #2FB3FF', '', ...args);
        }

        static info(...args) {
            console.info(this.tag + args.shift(), ...args);
        }

        static debug(...args) {
            console.debug(this.tag + args.shift(), ...args);
        }

        static warn(...args) {
            console.warn(this.tag + args.shift(), ...args);
        }

        static error(...args) {
            console.error(this.tag + args.shift(), ...args);
        }

    }
    /* eslint-enable no-console */

    class Hooker {

        static _hookCall(cb) {
            const call = Function.prototype.call;
            Function.prototype.call = function(...args) {
                let ret = call.apply(this, args);
                try {
                    if (args && cb(args)) {
                        Function.prototype.call = call;
                        cb = () => {};
                        Logger.log('restored call');
                    }
                } catch (err) {
                    Logger.error(err.stack);
                }
                return ret;
            };
            this._hookCall = null;
        }

        static _isEsModule(obj) {
            return obj.__esModule;
        }

        static _isFuction(arg) {
            return 'function' === typeof arg;
        }

        static _isModuleCall(args) { // module.exports, module, module.exports, require
            return args.length === 4 && args[1] && Object.getPrototypeOf(args[1]) === Object.prototype && args[1].hasOwnProperty('exports');
        }

        static _hookModuleCall(cb, pred) {
            const callbacksMap = new Map([[pred, [cb]]]);
            this._hookCall((args) => {
                if (!this._isModuleCall(args)) return;
                const exports = args[1].exports;
                for (const [pred, callbacks] of callbacksMap) {
                    if (!pred.apply(this, [exports])) continue;
                    callbacks.forEach(cb => cb(exports, args));
                    callbacksMap.delete(pred);
                    !callbacksMap.size && (this._hookModuleCall = null);
                    break;
                }
                return !callbacksMap.size;
            });

            this._hookModuleCall = (cb, pred) => {
                if (callbacksMap.has(pred)) {
                    callbacksMap.get(pred).push(cb);
                } else {
                    callbacksMap.set(pred, [cb]);
                }
            };
        }

        static _isUpsModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('getServieceUrl') &&
                   /\.id\s*=\s*"ups"/.test(exports.default.toString());
        }

        static hookUps(cb) {
            this._hookModuleCall(cb, this._isUpsModuleCall);
        }

        static hookUpsOnComplete(cb) {
            this.hookUps((exports) => {
                const onComplete = exports.default.prototype.onComplete;
                exports.default.prototype.onComplete = function(res) {
                    cb(res);
                    onComplete.apply(this, [res]);
                };
            });
        }

        static _isLogoModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('reset') &&
                   /logo\.style\.display/.test(exports.default.prototype.reset.toString());
        }

        static hookLogo(cb) {
            this._hookModuleCall(cb, this._isLogoModuleCall);
        }

        static _isQualityIconComponentModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('renderQuality');
        }

        static hookQualityIcon(cb) {
            this._hookModuleCall(cb, this._isQualityIconComponentModuleCall);
        }

        static hookRenderQuality(cb) {
            Hooker.hookQualityIcon((exports) => {
                const renderQuality = exports.default.prototype.renderQuality;
                exports.default.prototype.renderQuality = function(langCode) {
                    cb(langCode, this);
                    renderQuality.apply(this, [langCode]);
                };
            });
        }

        static hookSetQuality(cb) {
            Hooker.hookQualityIcon((exports) => {
                const setQuality = exports.default.prototype.setQuality;
                exports.default.prototype.setQuality = function(...args) { // quality, innerText
                    cb(args, this);
                    setQuality.apply(this, args);
                };
            });
        }

        static _isManageModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('_resetPlayer');
        }

        static hookManage(cb) {
            this._hookModuleCall(cb, this._isManageModuleCall);
        }

        static hookInitPlayerEvent(cb) {
            Hooker.hookManage((exports) => {
                const _initPlayerEvent = exports.default.prototype._initPlayerEvent;
                exports.default.prototype._initPlayerEvent = function() {
                    cb(this);
                    _initPlayerEvent.apply(this);
                };
            });
        }

        static hookResetPlayerAfter(cb) {
            Hooker.hookManage((exports) => {
                const _resetPlayer = exports.default.prototype._resetPlayer;
                exports.default.prototype._resetPlayer = function() {
                    try {
                        _resetPlayer.apply(this);
                    } catch (err) { // 忽略 ykSDK.destroyAd 异常
                        if (!err.stack.includes('destroyAd')) throw err;
                    }
                    cb(this);
                };
            });
        }

        static _isKeyShortcutsModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('registerEvents');
        }

        static hookKeyShortcuts(cb) {
            this._hookModuleCall(cb, this._isKeyShortcutsModuleCall);
        }

        static _isTipsModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('showHintTips');
        }

        static hookTips(cb) {
            this._hookModuleCall(cb, this._isTipsModuleCall);
        }

        static _isAdServiceModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('requestAdData');
        }

        static hookAdService(cb) {
            this._hookModuleCall(cb, this._isAdServiceModuleCall);
        }

        static _isTopAreaModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('_timerHandler');
        }

        static hookTopArea(cb) {
            this._hookModuleCall(cb, this._isTopAreaModuleCall);
        }

        static hookTopAreaAddEvent(cb) {
            Hooker.hookTopArea((exports) => {
                const _addEvent = exports.default.prototype._addEvent;
                exports.default.prototype._addEvent = function() {
                    cb(this);
                    _addEvent.apply(this);
                };
            });
        }

        static _isPreviewLayerModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('setPreviewShow');
        }

        static hookPreviewLayer(cb) {
            this._hookModuleCall(cb, this._isPreviewLayerModuleCall);
        }

        static hookPreviewLayerBind(cb) {
            Hooker.hookPreviewLayer((exports) => {
                const bind = exports.default.prototype.bind;
                exports.default.prototype.bind = function() {
                    cb(this);
                    bind.apply(this);
                };
            });
        }

        static _isSettingSeriesComponentModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('_addEvent') &&
                   exports.default.prototype._addEvent.toString().includes('seriesliseLayer');
        }

        static hookSettingSeries(cb) {
            this._hookModuleCall(cb, this._isSettingSeriesComponentModuleCall);
        }

        static _isSettingsIconComponentModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('setConfig');
        }

        static hookSettingsIcon(cb) {
            this._hookModuleCall(cb, this._isSettingsIconComponentModuleCall);
        }

        static _isUtilModuleCall(exports) {
            return exports.setLocalData && exports.getLocalData;
        }

        static hookUtil(cb) {
            this._hookModuleCall(cb, this._isUtilModuleCall);
        }

        static _isGlobalModuleCall(exports) {
            return this._isEsModule(exports) && this._isFuction(exports.default) &&
                   exports.default.prototype && exports.default.prototype.hasOwnProperty('resetConfig');
        }

        static hookGlobal(cb) {
            this._hookModuleCall(cb, this._isGlobalModuleCall);
        }

        static hookGlobalConstructorAfter(cb) {
            Hooker.hookGlobal((exports) => {
                const constructor = exports.default;
                exports.default = function(...args) {
                    constructor.apply(this, args);
                    cb(this);
                };
                exports.default.prototype = constructor.prototype;
            });
        }

        static hookGlobalInit(cb) {
            Hooker.hookGlobal((exports) => {
                const init = exports.default.prototype.init;
                exports.default.prototype.init = function(config) {
                    cb(config, this);
                    init.apply(this, [config]);
                };
            });
        }

        static hookGlobalDeal(cb) {
            Hooker.hookGlobal((exports) => {
                const deal = exports.default.prototype.deal;
                exports.default.prototype.deal = function() {
                    cb(this);
                    deal.apply(this);
                };
            });
        }

        static hookGlobalResetAfter(cb) {
            Hooker.hookGlobal((exports) => {
                const reset = exports.default.prototype.reset;
                exports.default.prototype.reset = function() {
                    reset.apply(this);
                    cb(this);
                };
            });
        }

        static _extractArgsName(code) {
            return code.slice(code.indexOf('(') + 1, code.indexOf(')')).split(/\s*,\s*/);
        }

        static _extractFunctionBody(code) {
            return code.slice(code.indexOf('{') + 1, code.lastIndexOf('}'));
        }

        static _isBaseModuleCall(exports) {
            return exports.SingleVideoControl && exports.MultiVideoControl;
        }

        static hookBase(cb, mode) {
            const callbacks = [];
            const codeCallbacks = [];
            (mode === 'code' ? codeCallbacks : callbacks).push(cb);

            this._hookModuleCall((exports, args) => {
                if (codeCallbacks.length > 0) {
                    let code = args[3].m[args[1].i].toString();
                    code = codeCallbacks.reduce((c, cb) => cb(c), code);
                    const fn = new Function(...this._extractArgsName(code), this._extractFunctionBody(code));
                    fn.apply(args[0], args.slice(1));
                }
                callbacks.forEach(cb => cb(args[1].exports));
                this.hookBase = null;
            }, this._isBaseModuleCall);

            this.hookBase = (cb, mode) => (mode === 'code' ? codeCallbacks : callbacks).push(cb);
        }

        static hookOz(cb) {
            const callbacks = [cb];
            const window = unsafeWindow;
            let oz = window.oz; // oz 可能先于脚本执行
            Object.defineProperty(window, 'oz', {
                get: () => {
                    return oz;
                },
                set: (value) => {
                    oz = value;
                    try {
                        callbacks.forEach(cb => cb(oz));
                    } catch (err) {
                        Logger.error(err.stack);
                    }
                }
            });
            if (oz) window.oz = oz; // oz 先于脚本执行

            this.hookOz = (cb) => callbacks.push(cb);
        }

        static hookDefine(name, cb) {
            const callbacksMap = new Map([[name, [cb]]]);
            this.hookOz((oz) => {
                const self = this;
                const define = oz.define;
                oz.define = function(name, deps, block) {
                    if (callbacksMap.has(name)) {
                        let code = block.toString();
                        code = callbacksMap.get(name).reduce((c, cb) => cb(c), code);
                        block = new Function(...self._extractArgsName(code), self._extractFunctionBody(code));
                    }
                    define(name, deps, block);
                };
            });

            this.hookDefine = (name, cb) => {
                if (callbacksMap.has(name)) {
                    callbacksMap.get(name).push(cb);
                } else {
                    callbacksMap.set(name, [cb]);
                }
            };
        }

    }

    class Patch {

        constructor() {
            this._installed = false;
        }

        install() {
            if (!this._installed) {
                this._installed = true;
                this._apply();
            }
        }

        _apply() {}

    }

    class MockAdsPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            const self = this;
            Hooker.hookAdService((exports) => {
                exports.default.prototype.requestAdData = function(obj/* , params */) {
                    setTimeout(() => {
                        if ('frontad' === obj.adtype) {
                            this.success(obj, self._fakeFrontAdData());
                        } else {
                            this.fail(obj, {code: '404', message: 'error'});
                        }
                    }, 0);
                };
            });
            this._hideOppoAds();
        }

        _fakeFrontAdData() {
            const data = {
                VAL: [],
            };
            return data;
        }

        _hideOppoAds() {
            GM_addStyle(`
                .oppo-ads, .oppinfo {
                    display: none !important;
                }
            `);
        }

    }

    class WatermarksPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Hooker.hookLogo((exports) => {
                exports.default.prototype.reset = () => {};
            });
        }

    }

    class VipPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Hooker.hookUpsOnComplete((res) => {
                const data = res.data;
                data.user = Object.assign(data.user || {}, {vip: true});
                data.vip = Object.assign(data.vip || {}, {hd3: true});
            });
        }

    }

    class QualityPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            this._improveAdaptQuality();
        }

        _findBestQuality(qualityList) {
            return ['1080p', '720p', '480p', '320p'].find(q => qualityList.some(v => v === q));
        }

        _improveAdaptQuality() {
            const self = this;
            Hooker.hookGlobal((exports) => {
                const adaptQuality = exports.default.prototype.adaptQuality;
                exports.default.prototype.adaptQuality = function(lang) {
                    const cfg = this._config;
                    const quality = cfg.quality;
                    adaptQuality.apply(this, [lang]);
                    if (!this.qualityList.includes(quality)) {
                        cfg.quality = self._findBestQuality(this.qualityList);
                    }
                };
            });
        }

    }

    class DashboardPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            this._prepare();
            this._patch();
        }

        _prepare() {
            this._exposeDashboard();
            Hooker.hookPreviewLayerBind((that) => {
                that._el.addEventListener('mouseover', () => that.emit('mouseoverpreview'));
                that._el.addEventListener('mouseleave', () => that.emit('mouseleavepreview'));
            });
        }

        _findVarName(code) {
            return /"dashboard"\s*,\s*(\w+)/.exec(code)[1];
        }

        _exposeDashboard() {
            Hooker.hookBase((code) => {
                let varName = this._findVarName(code);
                return code.replace(/\.exports\s*=\s*(\w+)/, `$&;$1.__Dashboard=${varName};`);
            }, 'code');
        }

        _patch() {
            Hooker.hookBase((exports) => {
                const proto = exports.__Dashboard.prototype;

                proto.bindAutoHide = function() {
                    this._args.show = 'function' === typeof this._args.show ? this._args.show : () => {};
                    this._args.hide = 'function' === typeof this._args.hide ? this._args.show : () => {};

                    this._el.addEventListener('mouseover', () => this._mouseover = true);
                    this._el.addEventListener('mouseleave', () => this._mouseover = false);
                    this.on('mouseoverpreview', () => this._mouseoverpreview = true);
                    this.on('mouseleavepreview', () => this._mouseoverpreview = false);
                    this._video.on('play', () => {
                        if (!this._mouseover && !this._mouseoverpreview)
                            this._hideTimeout = setTimeout(this.hide.bind(this), this._args.autoHide);
                    });
                    this._video.on('pause', () => {
                        this._hideTimeout && clearTimeout(this._hideTimeout);
                        this.isShow() || this.show();
                    });
                    this._parent.addEventListener('mousemove', () => {
                        this._hideTimeout && clearTimeout(this._hideTimeout);
                        this.isShow() || this.show();
                        if (!this._isPaused() && !this._mouseover && !this._mouseoverpreview)
                            this._hideTimeout = setTimeout(this.hide.bind(this), this._args.autoHide);
                    });
                    this._parent.addEventListener('mouseleave', () => {
                        this._hideTimeout && clearTimeout(this._hideTimeout);
                        if (!this._isPaused()) this.hide();
                    });
                };

                proto._isPaused = function() {
                    return this._video._videoCore.video.paused;
                };

                proto.isShow = function() {
                    return this._el.style.display !== 'none';
                };

                proto.show = function() {
                    this.emit('dashboardshow');
                    this._parent.style.cursor = '';
                    this._el.style.display = '';
                    this._args.show();
                };

                proto.hide = function() {
                    this.emit('dashboardhide');
                    this._parent.style.cursor = 'none'; // 隐藏鼠标
                    this._el.style.display = 'none';
                    this._args.show();
                };
            });
        }

    }

    class TopAreaPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Hooker.hookTopAreaAddEvent((that) => {
                that.on('webfullscreen', (isWebFullscreen) => {
                    isWebFullscreen ? that._showHideTop(true) : that._hideHideTop();
                });
                that.on('dashboardshow', () => {
                    const playerState = that._video.global.playerState;
                    if (playerState.fullscreen || playerState.webfullscreen) {
                        that._showHideTop(true);
                    }
                });
                that.on('dashboardhide', () => {
                    const playerState = that._video.global.playerState;
                    if (playerState.fullscreen || playerState.webfullscreen) {
                        that._hideHideTop();
                    }
                });
            });
            Hooker.hookResetPlayerAfter((that) => { // 网页全屏播放上下集重置播放器后显示顶部控件
                if (!that.global.playerState.fullscreen)
                    that._player.control.emit('webfullscreen', that.global.playerState.webfullscreen);
            });
        }

    }

    class SettingSeriesPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Hooker.hookSettingSeries((exports) => { // 网页全屏显示选集
                const _addEvent = exports.default.prototype._addEvent;
                exports.default.prototype._addEvent = function() {
                    _addEvent.apply(this);
                    this.on('webfullscreen', (isWebFullscreen) => {
                        if (isWebFullscreen) {
                            if (this.seriesList.length > 1)
                                this._el.style.display = 'inline-block';
                        } else {
                            this._el.style.display = 'none';
                            this._el.classList.remove('cliced');
                            this.emit('seriesliseLayer', false);
                        }
                    });
                };
            });
        }
    }

    class ContinuePlayPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Hooker.hookInitPlayerEvent((that) => { // 视频播放结束处理
                that._player.control.on('ended', that._onEnd.bind(that));
                that._player.control.on('ended', () => this._onEnd(that));
            });
        }

        _onEnd(that) {
            const config = that.global.config;
            const playerState = that.global.playerState;
            if (config.continuePlay && config.nextVid && !playerState.fullscreen) {
                if (playerState.webfullscreen) {
                    that.playByVid({vid: that.global.config.nextVid});
                } else {
                    that.gotoVideo(that.global.config.nextVid);
                }
            }
        }

    }

    class FullscreenPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            Object.defineProperty(document, 'fullscreen', {});
        }

    }

    class WebFullscreen {

        constructor(elem) {
            this._elem = elem;
        }

        isWebFullscreen() {
            return this._elem.classList.contains('webfullscreen');
        }

        enter() {
            this._elem.classList.add('webfullscreen');
            const body = document.body;
            body.style.overflow = 'hidden';

            let parentElement = this._elem.parentElement;
            while (parentElement && parentElement !== body) {
                parentElement.classList.add('z-top');
                parentElement = parentElement.parentElement;
            }
        }

        exit() {
            this._elem.classList.remove('webfullscreen');
            const body = document.body;
            body.style.overflow = '';

            let parentElement = this._elem.parentElement;
            while (parentElement && parentElement !== body) {
                parentElement.classList.remove('z-top');
                parentElement = parentElement.parentElement;
            }
        }

        toggle() {
            this.isWebFullscreen() ? this.exit() : this.enter();
        }

        static addStyle() {
            GM_addStyle(`
                .z-top {
                    position: relative !important;
                    z-index: 23333333 !important;
                }
                .webfullscreen {
                    display: block !important;
                    position: fixed !important;
                    width: 100% !important;
                    height: 100% !important;
                    top: 0 !important;
                    left: 0 !important;
                    background: #000 !important;
                    z-index: 23333333 !important;
                }
            `);
        }
    }

    class ManagePatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            this._prepare();
            this._hookManage();
        }

        _prepare() {
            this._customTip();
            this._disablePlayAfterSeek();
            this._addPrevInfo();
            this._playAfterPlayerReset();
            this._keepPlaybackRate();
            this._playbackRatePersistence();
            (new ContinuePlayPatch()).install();
            (new FullscreenPatch()).install();
        }

        _customTip() {
            Hooker.hookTips((exports) => {
                const showHintTips = exports.default.prototype.showHintTips;
                exports.default.prototype.showHintTips = function(code, info) {
                    if (info.msg) {
                        this._hintLayer.setHintShow(info.msg);
                    } else {
                        showHintTips.apply(this, [code, info]);
                    }
                };
            });
        }

        _disablePlayAfterSeek() { // SingleVideoControl seek 后不自动播放
            Hooker.hookBase((exports) => {
                const _setCurrentTime = exports.SingleVideoControl.prototype._setCurrentTime;
                exports.SingleVideoControl.prototype._setCurrentTime = function(time) {
                    const play = this.video.play;
                    this.video.play = () => {};
                    _setCurrentTime.apply(this, [time]);
                    this.video.play = play;
                };
            });
        }

        _keepPlaybackRate() {
            Hooker.hookBase((exports) => {
                const proto = exports.MultiVideoControl.prototype;
                const _setVideo = proto._setVideo;
                proto._setVideo = function(...args) {
                    const rate = this.video.playbackRate;
                    _setVideo.apply(this, args);
                    this.video.playbackRate = rate;
                };
            });
        }

        _playbackRatePersistence() {
            let util;
            Hooker.hookUtil(exports => util = exports);
            Hooker.hookSettingsIcon((exports) => {
                const proto = exports.default.prototype;
                const setDataUI = proto.setDataUI;
                proto.setDataUI = function(data) {
                    setDataUI.apply(this, [data]);
                    this._video.global.playerState = {playbackRate: data.playbackRate || 1};
                    this.on('playbackratechange', (rate) => {
                        this.data.playbackRate = rate;
                        util.setLocalData('YK_PSL_SETTINGS', this.data);
                    });
                };
            });
        }

        _addPrevInfo() {
            Hooker.hookGlobalDeal((that) => {
                if (that.ups && that.ups.videoData && that.ups.programList && that.ups.programList.videoList) {
                    const list = that.ups.programList.videoList;
                    const currVid = that.ups.videoData.id;
                    const currIdx = list.findIndex(item => parseInt(item.vid) === currVid);
                    if (currIdx > 0) {
                        const prevVideo = list[currIdx - 1];
                        that.ups.programList.prevVideo = prevVideo;
                        prevVideo && (that._config.prevVid = prevVideo.encodevid);
                    }
                }
            });
        }

        _playAfterPlayerReset() {
            Hooker.hookResetPlayerAfter((that) => {
                if (that.global.playerState.state === 'playerreset') that.play();
            });
        }

        _hookManage() {
            Hooker.hookManage(this._hookManageCallback.bind(this));
        }

        _hookManageCallback(exports) {
            const proto = exports.default.prototype;

            const _init = proto._init;
            proto._init = function() {
                _init.apply(this);
                WebFullscreen.addStyle();
                this._webfullscreen = new WebFullscreen(this.container);
            };

            proto._showTip = function(msg) {
                this._emitter.emit('player.showinfo', {type: 'hint', msg});
            };

            proto.play = function() {
                this._player && this._player.control.play();
                this._showTip('播放');
            };

            proto._pause = proto.pause;
            proto.pause = function() {
                this._pause();
                this._showTip('暂停');
            };

            proto.adjustVolume = function(value) {
                let volume = this.global.playerState.volume + value;
                volume = Math.max(0, Math.min(1, volume.toFixed(2)));
                this._player.control.setVolume(volume);
                if (volume === 0) {
                    this._emitter.emit('player.showinfo', {type: 'hint', code: 'H0003', volume: volume + '%'});
                }
            };

            proto.toggleMute = function() {
                if (this.global.playerState.muted) this._showTip('取消静音');
                this.setMuted(!this.global.playerState.muted);
            };

            proto.stepSeek = function(stepTime) {
                const duration = this._player.control.getDuration();
                const currentTime = this.global.currentTime;
                const seekTime = Math.max(0, Math.min(duration, currentTime + stepTime));
                this.seek(seekTime);

                let msg;
                if (Math.abs(stepTime) < 60) {
                    msg = stepTime > 0 ? `步进：${stepTime}秒` : `步退：${Math.abs(stepTime)}秒`;
                } else {
                    msg = stepTime > 0 ? `步进：${stepTime/60}分钟` : `步退：${Math.abs(stepTime)/60}分钟`;
                }
                this._showTip(msg);
            };

            proto.rangeSeek = function(range) {
                const duration = this._player.control.getDuration();
                const seekTime = Math.max(0, Math.min(duration, duration * range));
                this.seek(seekTime);
                this._showTip('定位：' + (range * 100).toFixed(0) + '%');
            };

            proto.isFullscreen = function() {
                return this.global.playerState.fullscreen;
            };

            proto.toggleFullscreen = function() {
                if (this.isFullscreen()) {
                    this.exitFullscreen();
                } else {
                    this.fullScreen();
                }
            };

            proto.isWebFullscreen = function() {
                return this._webfullscreen.isWebFullscreen();
            };

            proto.enterWebFullscreen = function() {
                this._webfullscreen.enter();
                this.global.playerState = {webfullscreen: true};
                this._player.control.emit('webfullscreen', true);
            };

            proto.exitWebFullscreen = function() {
                this._webfullscreen.exit();
                this.global.playerState = {webfullscreen: false};
                this._player.control.emit('webfullscreen', false);
            };

            proto.toggleWebFullscreen = function() {
                this.isWebFullscreen() ? this.exitWebFullscreen() : this.enterWebFullscreen();
            };

            proto.setRate = function(rate) {
                const videoCore = this._player.control._videoCore;
                const video = videoCore.video;
                if (this._player.config.controlType === 'multi') {
                    videoCore._videoElments.forEach(v => v.playbackRate = rate);
                } else {
                    video.playbackRate = rate;
                }
            };

            proto.adjustPlaybackRate = function(value) {
                const video = this._player.control._videoCore.video;
                const rate = Math.max(0.2, Math.min(5, parseFloat((video.playbackRate + value).toFixed(1))));
                this.setRate(rate);
                this.global.playerState = {playbackRate: rate};
                this._player.control.emit('playbackratechange', rate);
                this._showTip(`播放速率：${rate}`);
            };

            proto.turnPlaybackRate = function() {
                const video = this._player.control._videoCore.video;
                const rate = video.playbackRate !== 1 ? 1 : this.global.playerState.playbackRate;
                this.setRate(rate);
                this._showTip(`播放速率：${rate}`);
            };

            proto.getFps = function() {
                return 25; // 标清fps为15，标清以上fps为25。
            };

            proto.prevFrame = function() {
                const state = this.global.playerState.state;
                if (state === 'playing') this.pause();
                const duration = this._player.control.getDuration();
                const currentTime = this.global.currentTime;
                const seekTime = Math.max(0, Math.min(duration, currentTime - 1 / this.getFps()));
                this.seek(seekTime);
                this._showTip('上一帧');
            };

            proto.nextFrame = function() {
                const state = this.global.playerState.state;
                if (state === 'playing') this.pause();
                const duration = this._player.control.getDuration();
                const currentTime = this.global.currentTime;
                const seekTime = Math.max(0, Math.min(duration, currentTime + 1 / this.getFps()));
                this.seek(seekTime);
                this._showTip('下一帧');
            };

            proto.playPrev = function() {
                const prevVid = this.global.config.prevVid;
                if (prevVid) {
                    if (this.isFullscreen() || this.isWebFullscreen()) {
                        this.playByVid({vid: prevVid});
                    } else {
                        this.gotoVideo(prevVid);
                    }
                    this._showTip('播放上一集');
                } else {
                    this._showTip('没有上一集哦');
                }
            };

            const playNext = proto.playNext;
            proto.playNext = function(data) {
                if (data) return playNext.apply(this, [data]);
                const nextVid = this.global.config.nextVid;
                if (nextVid) {
                    if (this.isFullscreen() || this.isWebFullscreen()) {
                        this.playByVid({vid: nextVid});
                    } else {
                        this.gotoVideo(nextVid);
                    }
                    this._showTip('播放下一集');
                } else {
                    this._showTip('没有下一集哦');
                }
            };

            proto.gotoVideo = function(vid) {
                location.href = `//v.youku.com/v_show/id_${vid}.html`;
            };
        }

    }

    const managePatch = new ManagePatch();

    class KeyShortcutsPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            this._prepare();
            this._addListener();
        }

        _prepare() {
            managePatch.install();
            this._obtainPlayer();
        }

        _obtainPlayer() {
            const self = this;
            Hooker.hookKeyShortcuts(exports => {
                exports.default.prototype.registerEvents = function() {
                    self._player = this._player;
                };
            });
        }

        _addListener() {
            document.addEventListener('keydown', this._handler.bind(this));
        }

        _handler(event) {
            if (event.target.nodeName !== 'BODY') return;

            switch (event.keyCode) {
            case 32: // Spacebar
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    const state = this._player.global.playerState.state;
                    if (state  === 'paused') {
                        this._player.play();
                    } else if (state === 'ended') {
                        this._player.replay();
                    } else {
                        this._player.pause();
                    }
                } else {
                    return;
                }
                break;
            case 39:    // → Arrow Right
            case 37: {  // ← Arrow Left
                let stepTime;
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    stepTime = 39 === event.keyCode ? 5 : -5;
                } else if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                    stepTime = 39 === event.keyCode ? 30 : -30;
                } else if (!event.ctrlKey && event.shiftKey && !event.altKey) {
                    stepTime = 39 === event.keyCode ? 60 : -60;
                } else if (event.ctrlKey && !event.shiftKey && event.altKey) {
                    stepTime = 39 === event.keyCode ? 3e2 : -3e2; // 5分钟
                } else {
                    return;
                }
                this._player.stepSeek(stepTime);
                break;
            }
            case 38: // ↑ Arrow Up
            case 40: // ↓ Arrow Down
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.adjustVolume(38 === event.keyCode ? 0.05 : -0.05);
                } else {
                    return;
                }
                break;
            case 77: // M
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.toggleMute();
                } else {
                    return;
                }
                break;
            case 13: // Enter
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.toggleFullscreen();
                } else if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.toggleWebFullscreen();
                } else {
                    return;
                }
                break;
            case 67: // C
            case 88: // X
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.adjustPlaybackRate(67 === event.keyCode ? 0.1 : -0.1);
                } else {
                    return;
                }
                break;
            case 90: // Z
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    this._player.turnPlaybackRate();
                } else {
                    return;
                }
                break;
            case 68: // D
            case 70: // F
                if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                    if (event.keyCode === 68) {
                        this._player.prevFrame();
                    } else {
                        this._player.nextFrame();
                    }
                } else {
                    return;
                }
                break;
            case 80: // P
            case 78: // N
                if (!event.ctrlKey && event.shiftKey && !event.altKey) {
                    if (event.keyCode === 78) {
                        this._player.playNext();
                    } else {
                        this._player.playPrev();
                    }
                } else {
                    return;
                }
                break;
            case 27: // ESC
                if (!event.ctrlKey && !event.shiftKey && !event.altKey)
                    this._player.isWebFullscreen() && this._player.exitWebFullscreen();
                return;
            default:
                if (event.keyCode >= 48 && event.keyCode <= 57) { // 0 ~ 9
                    if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                        this._player.rangeSeek((event.keyCode - 48) * 0.1);
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            }

            event.preventDefault();
            event.stopPropagation();
        }

    }

    class MouseShortcutsPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            this._prepare();
            this._addListener();
        }

        _prepare() {
            managePatch.install();
            this._addStyle();
        }

        _addStyle() {
            GM_addStyle(`
                .h5-layer-conatiner {
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                }
                .h5-ext-layer-adsdk {
                    display: none !important;
                }
            `);
        }

        _addListener() {
            Hooker.hookInitPlayerEvent((that) => {
                let timer;
                let container = that.container.querySelector('.h5-layer-conatiner');
                container.addEventListener('click', function(event) {
                    if (this !== event.target) return;
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                        return;
                    }
                    timer = setTimeout(() => {
                        const state = that.global.playerState.state;
                        if (state  === 'paused') {
                            that.play();
                        } else if (state === 'ended') {
                            that.replay();
                        } else {
                            that.pause();
                        }
                        timer = null;
                    }, 200);
                });
                container.addEventListener('dblclick', function(event) {
                    if (this !== event.target) return;
                    event.ctrlKey ? that.toggleWebFullscreen() : that.toggleFullscreen();
                });
                container.addEventListener('wheel', function(event) {
                    if (this === event.target && (that.isFullscreen() || that.isWebFullscreen())) {
                        const delta = event.wheelDelta || event.detail || (event.deltaY && -event.deltaY);
                        that.adjustVolume(delta > 0 ? 0.05 : -0.05);
                    }
                });
                container = null;
            });
        }

    }

    class ShortcutsPatch extends Patch {

        constructor() {
            super();
        }

        _apply() {
            (new KeyShortcutsPatch()).install();
            Logger.log('添加键盘快捷键');
            (new MouseShortcutsPatch()).install();
            Logger.log('添加鼠标快捷键');
        }

    }

    // class H5Patch extends Patch {

        // constructor() {
            // super();
        // }

        // _apply() {
            // Hooker.hookDefine('page/find/play/player/load', this._forceH5.bind(this));
        // }

        // _forceH5(code) {
            // return code.replace(/(if\s*\().*?(\)\s*\{)/, '$1true$2').replace('window.sessionStorage', 'null');
        // }

    // }

    function ensureH5PlayerEnabled() {
        // (new H5Patch()).install();
        Object.defineProperty(unsafeWindow.navigator, 'plugins', {get: () => ({})});
        Logger.log('启用html5播放器');
    }

    function mockAds() {
        (new MockAdsPatch()).install();
        Logger.log('和谐广告');
    }

    function invalidateWatermarks() {
        (new WatermarksPatch()).install();
        Logger.log('和谐水印');
    }

    function invalidateQualityLimitation() {
        (new VipPatch()).install();
        Logger.log('解除会员画质限制');
    }

    function improveQualityLogic() {
        (new QualityPatch()).install();
        Logger.log('改善画质逻辑');
    }

    function improveAutoHide() {
        (new DashboardPatch()).install();
        (new TopAreaPatch()).install();
        (new SettingSeriesPatch()).install();
        Logger.log('改善控件与光标自动隐藏');
    }

    function improveShortcuts() {
        (new ShortcutsPatch()).install();
    }

//=============================================================================

    ensureH5PlayerEnabled();
    mockAds();
    invalidateWatermarks();
    invalidateQualityLimitation();
    improveQualityLogic();
    improveAutoHide();
    improveShortcuts();

})();
