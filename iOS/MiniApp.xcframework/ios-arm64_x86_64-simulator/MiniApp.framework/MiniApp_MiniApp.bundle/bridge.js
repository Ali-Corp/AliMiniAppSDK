(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
/** @internal */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiniAppBridgeUtils = exports.MiniAppBridge = exports.mabKeyboardEventQueue = exports.mabCustomEventQueue = exports.mabMessageQueue = void 0;
var secure_storage_1 = require("./types/secure-storage");
var share_info_1 = require("./types/share-info");
// import { AccessTokenData, NativeTokenData } from './types/token-data';
var error_types_1 = require("./types/error-types");
var event_types_1 = require("./types/event-types");
var ga_1 = require("./modules/ga");
var userprofile_manager_1 = require("./modules/userprofile-manager");
/** @internal */
var mabMessageQueue = [];
exports.mabMessageQueue = mabMessageQueue;
var mabCustomEventQueue = [];
exports.mabCustomEventQueue = mabCustomEventQueue;
var mabKeyboardEventQueue = [];
exports.mabKeyboardEventQueue = mabKeyboardEventQueue;
/** @internal */
var MiniAppBridge = /** @class */ (function () {
    function MiniAppBridge(executor) {
        var _this = this;
        this.isSecureStorageReady = false;
        this.secureStorageLoadError = null;
        this.executor = executor;
        this.platform = executor.getPlatform();
        this.googleAnalytic = new ga_1.GoogleAnalytic(this.platform);
        this.userProfileManager = new userprofile_manager_1.UserProfileManager(executor);
        if (window) {
            window.addEventListener('DOMContentLoaded', (function (event) {
                _this.googleAnalytic.init();
                _this.init().then(function (initData) {
                    var searchParams = new URLSearchParams(initData);
                    _this.googleAnalytic.updateSDKKey(searchParams.get('sdk_key'));
                });
            }).bind(this));
            window.addEventListener('load', function () {
                _this.googleAnalytic.trackAppStart();
                _this.googleAnalytic.trackComprehensiveMobileInfo();
            });
            window.addEventListener(secure_storage_1.MiniAppSecureStorageEvents.onReady, function () { return (_this.isSecureStorageReady = true); });
            window.addEventListener(secure_storage_1.MiniAppSecureStorageEvents.onLoadError, function (e) {
                return (_this.secureStorageLoadError = (0, error_types_1.parseMiniAppError)(e.detail.message));
            });
            window.addEventListener(event_types_1.HostAppEvents.SCREEN_DIMENSION_CHANGE, function (event) {
                var message = event.detail.message;
                var action = JSON.parse(message);
                var safeAreaInsets = action.safeAreaInsets;
                document.documentElement.style.setProperty('--safe-area-inset-top', "".concat(safeAreaInsets.top, "px"));
                document.documentElement.style.setProperty('--safe-area-inset-right', "".concat(safeAreaInsets.right, "px"));
                document.documentElement.style.setProperty('--safe-area-inset-bottom', "".concat(safeAreaInsets.bottom, "px"));
                document.documentElement.style.setProperty('--safe-area-inset-left', "".concat(safeAreaInsets.left, "px"));
            });
            // Stop all media (audio and video) content when the page is about to unload
            window.addEventListener('beforeunload', function () {
                _this.googleAnalytic.trackAppClose();
                // Pause all audio elements
                var audioElements = document.querySelectorAll('audio');
                audioElements.forEach(function (audio) {
                    if (!audio.paused) {
                        audio.pause();
                    }
                });
                // Pause all video elements
                var videoElements = document.querySelectorAll('video');
                videoElements.forEach(function (video) {
                    if (!video.paused) {
                        video.pause();
                    }
                });
                // Also stop any HTML5 media elements that might be created via MediaElement API
                var mediaElements = document.querySelectorAll('.media-element');
                mediaElements.forEach(function (element) {
                    var mediaElement = element;
                    if (mediaElement && !mediaElement.paused) {
                        mediaElement.pause();
                    }
                });
            });
        }
    }
    /**
     * Success Callback method that will be called from native side
     * to this bridge. This method will send back the value to the
     * mini apps that uses promises.
     * @param  {[String]} messageId Message ID which will be used to get callback object from messageQueue
     * @param  {[String]} value Response value sent from the native on invoking the action command
     */
    MiniAppBridge.prototype.execSuccessCallback = function (messageId, value) {
        var queueObj = mabMessageQueue.filter(function (callback) { return callback.id === messageId; })[0];
        if (value) {
            queueObj.onSuccess(value);
        }
        else {
            queueObj.onError('Unknown Error');
        }
        removeFromMessageQueue(queueObj);
    };
    /**
     * Error Callback method that will be called from native side
     * to this bridge. This method will send back the error message to the
     * mini apps that uses promises.
     * @param  {[String]} messageId Message ID which will be used to get callback object from messageQueue
     * @param  {[String]} errorMessage Error message sent from the native on invoking the action command
     */
    MiniAppBridge.prototype.execErrorCallback = function (messageId, errorMessage) {
        var queueObj = mabMessageQueue.filter(function (callback) { return callback.id === messageId; })[0];
        if (!errorMessage) {
            errorMessage = 'Unknown Error';
        }
        queueObj.onError(errorMessage);
        removeFromMessageQueue(queueObj);
    };
    /**
     * Event Callback method that will be called from native side
     * to this bridge. This method will send back the value to the
     * mini app that listen to this eventType.
     * @param  {[String]} eventType EventType which will be used to listen for the event
     * @param  {[String]} value Additional message sent from the native on invoking for the eventType
     */
    MiniAppBridge.prototype.execCustomEventsCallback = function (eventType, value) {
        var event = new CustomEvent(eventType, {
            detail: { message: value },
        });
        var queueObj = mabCustomEventQueue.filter(function (customEvent) { return customEvent === event; })[0];
        if (!queueObj) {
            if (eventType === event.type) {
                removeFromEventQueue(event);
            }
            queueObj = event;
            mabCustomEventQueue.unshift(queueObj);
        }
        this.executor.execEvents(queueObj);
    };
    /**
     * Keyboard Events Callback method that will be called from native side
     * to this bridge. This method will send back the value to the
     * mini app that listen to this eventType.
     * @param  {[String]} eventType EventType which will be used to listen for the event
     * @param  {[String]} message Additional message sent from the native on invoking for the eventType
     * @param  {[String]} navigationBarHeight Additional message sent from the native on invoking for the navigationBarHeight
     * @param  {[String]} screenHeight Additional message sent from the native on invoking for the screenHeight
     * @param  {[String]} keyboardHeight Additional message sent from the native on invoking for the keyboardHeight
     */
    MiniAppBridge.prototype.execKeyboardEventsCallback = function (eventType, message, navigationBarHeight, screenHeight, keyboardHeight) {
        var event = new CustomEvent(eventType, {
            detail: {
                message: message,
                navigationBarHeight: navigationBarHeight,
                screenHeight: screenHeight,
                keyboardHeight: keyboardHeight,
            },
        });
        var queueObj = mabKeyboardEventQueue.filter(function (customEvent) { return customEvent === event; })[0];
        if (!queueObj) {
            if (eventType === event.type) {
                removeFromKeyboardEventQueue(event);
            }
            queueObj = event;
            mabKeyboardEventQueue.unshift(queueObj);
        }
        this.executor.execEvents(queueObj);
    };
    /**
     * Initialize miniapp session
     */
    MiniAppBridge.prototype.init = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('init', null, function (success) { return resolve(success); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating getDeviceId function to MiniAppBridge object.
     */
    MiniAppBridge.prototype.getDeviceId = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getDeviceId', null, function (id) { return resolve(id); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating getMessagingUniqueId function to MiniAppBridge object.
     */
    // getMessagingUniqueId() {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'getMessagingUniqueId',
    //       null,
    //       id => resolve(id),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating getMauid function to MiniAppBridge object.
     */
    MiniAppBridge.prototype.getMauid = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getMauid', null, function (id) {
                _this.googleAnalytic.updateUserId(id);
                resolve(id);
            }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating requestPermission function to MiniAppBridge object.
     * @param {DevicePermission} permissionType Type of permission that is requested e.g. location
     */
    MiniAppBridge.prototype.requestPermission = function (permissionType) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('requestPermission', { permission: permissionType }, function (success) { return resolve(success); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating showInterstitialAd function to MiniAppBridge object.
     * @param {string} id ad unit id of the intertitial ad
     */
    // showInterstitialAd(id: string) {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'showAd',
    //       { adType: AdTypes.INTERSTITIAL, adUnitId: id },
    //       closeSuccess => resolve(closeSuccess),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating loadInterstitialAd function to MiniAppBridge object.
     * This function preloads interstitial ad before they are requested for display.
     * Can be called multiple times to pre-load multiple ads.
     * @param {string} id ad unit id of the interstitial ad that needs to be loaded.
     */
    // loadInterstitialAd(id: string) {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'loadAd',
    //       { adType: AdTypes.INTERSTITIAL, adUnitId: id },
    //       loadSuccess => resolve(loadSuccess),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating loadRewardedAd function to MiniAppBridge object.
     * This function preloads Rewarded ad before they are requested for display.
     * Can be called multiple times to pre-load multiple ads.
     * @param {string} id ad unit id of the Rewarded ad that needs to be loaded.
     */
    // loadRewardedAd(id: string) {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'loadAd',
    //       { adType: AdTypes.REWARDED, adUnitId: id },
    //       loadSuccess => resolve(loadSuccess),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating showRewardedAd function to MiniAppBridge object.
     * @param {string} id ad unit id of the Rewarded ad
     */
    // showRewardedAd(id: string) {
    //   return new Promise<Reward>((resolve, reject) => {
    //     return this.executor.exec(
    //       'showAd',
    //       { adType: AdTypes.REWARDED, adUnitId: id },
    //       rewardResponse => resolve(JSON.parse(rewardResponse) as Reward),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating requestCustomPermissions function to MiniAppBridge object
     * @param [CustomPermissionType[] permissionTypes, Types of custom permissions that are requested
     * using an Array including the parameters eg. name, description.
     *
     * For eg., Miniapps can pass the array of valid custom permissions as following
     * [
     *  {"name":"ali.miniapp.user.USER_INFO", "description": "Reason to request for the custom permission"},
     *  {"name":"ali.miniapp.user.CONTACT_LIST", "description": "Reason to request for the custom permission"}
     * ]
     */
    MiniAppBridge.prototype.requestCustomPermissions = function (permissionTypes) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('requestCustomPermissions', { permissions: permissionTypes }, function (success) { return resolve(JSON.parse(success)); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating shareInfo function to MiniAppBridge object.
     * This function returns the shared info action state.
     * @param {info} The shared info object.
     */
    MiniAppBridge.prototype.shareInfo = function (info) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var shareInfo;
            try {
                shareInfo = (0, share_info_1.validateShareInfo)(info);
            }
            catch (error) {
                reject(error);
                return;
            }
            return _this.executor.exec('shareInfo', { shareInfo: shareInfo }, function (success) { return resolve(success); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating getUserInfo function to MiniAppBridge object.
     * This function returns user info from host app
     * (provided the ali.miniapp.user.USER_INFO is allowed by the user)
     * It returns error info if user had denied the custom permission
     */
    MiniAppBridge.prototype.getUserInfo = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getUserInfo', null, function (success) { return resolve(JSON.parse(success)); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating getContacts function to MiniAppBridge object.
     * This function returns contact list from the user profile.
     * (provided the ali.miniapp.user.CONTACT_LIST is allowed by the user)
     * It returns error info if user had denied the custom permission
     */
    MiniAppBridge.prototype.choosePhoneContact = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('choosePhoneContact', null, function (contact) { return resolve(JSON.parse(contact)); }, function (error) { return reject(error); });
        });
    };
    /**
     * Associating getContacts function to MiniAppBridge object.
     * This function returns contact list from the user profile.
     * (provided the ali.miniapp.user.CONTACT_LIST is allowed by the user)
     * It returns error info if user had denied the custom permission
     */
    // getContacts() {
    //   return new Promise<Contact[]>((resolve, reject) => {
    //     return this.executor.exec(
    //       'getContacts',
    //       null,
    //       contacts => resolve(JSON.parse(contacts) as Contact[]),
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating getAccessToken function to MiniAppBridge object.
     * This function returns access token details from the host app.
     * (provided the ali.miniapp.user.ACCESS_TOKEN is allowed by the user)
     * It returns error info if user had denied the custom permission
     * @param {string} audience the audience the MiniApp requests for the token
     * @param {string[]} scopes the associated scopes with the requested audience
     */
    // getAccessToken(audience: string, scopes: string[]) {
    //   return new Promise<AccessTokenData>((resolve, reject) => {
    //     return this.executor.exec(
    //       'getAccessToken',
    //       { audience, scopes },
    //       tokenData => {
    //         const nativeTokenData = JSON.parse(tokenData) as NativeTokenData;
    //         resolve(new AccessTokenData(nativeTokenData));
    //       },
    //       error => reject(parseMiniAppError(error))
    //     );
    //   });
    // }
    /**
     * This function does not return anything back on success.
     * @param {screenAction} The screen state that miniapp wants to set on device.
     */
    MiniAppBridge.prototype.setScreenOrientation = function (screenAction) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('setScreenOrientation', { action: screenAction }, function (success) { return resolve(success); }, function (error) { return reject(error); });
        });
    };
    /**
     * @param message The message to send to contact.
     * @returns Promise resolves with the contact id received a message.
     * Can also resolve with null response in the case that the message was not sent to a contact, such as if the user cancelled sending the message.
     * Promise rejects in the case that there was an error.
     * It returns error info if user had denied the custom permission for sending message.
     */
    // sendMessageToContact(message: MessageToContact) {
    //   return new Promise<string | null>((resolve, reject) => {
    //     return this.executor.exec(
    //       'sendMessageToContact',
    //       {
    //         messageToContact: {
    //           ...message,
    //           bannerMessage: trimBannerText(message.bannerMessage),
    //         },
    //       },
    //       contactId => {
    //         if (contactId !== 'null' && contactId !== null) {
    //           resolve(contactId);
    //         } else {
    //           resolve(null);
    //         }
    //       },
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * @param id The id of the contact receiving a message.
     * @param message The message to send to contact.
     * @returns Promise resolves with the contact id received a message.
     * @see {sendMessageToContact}
     */
    // sendMessageToContactId(id: string, message: MessageToContact) {
    //   return new Promise<string | null>((resolve, reject) => {
    //     return this.executor.exec(
    //       'sendMessageToContactId',
    //       {
    //         contactId: id,
    //         messageToContact: {
    //           ...message,
    //           bannerMessage: trimBannerText(message.bannerMessage),
    //         },
    //       },
    //       contactId => {
    //         if (contactId !== 'null' && contactId !== null) {
    //           resolve(contactId);
    //         } else {
    //           resolve(null);
    //         }
    //       },
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * @param message The message to send to contact.
     * @returns Promise resolves with an array of contact id which were sent the message.
     * Can also resolve with null array in the case that the message was not sent to any contacts, such as if the user cancelled sending the message.
     * Promise rejects in the case that there was an error.
     * It returns error info if user had denied the custom permission for sending message.
     */
    // sendMessageToMultipleContacts(message: MessageToContact) {
    //   return new Promise<string[] | null>((resolve, reject) => {
    //     return this.executor.exec(
    //       'sendMessageToMultipleContacts',
    //       {
    //         messageToContact: {
    //           ...message,
    //           bannerMessage: trimBannerText(message.bannerMessage),
    //         },
    //       },
    //       contactIds => {
    //         if (contactIds !== 'null' && contactIds !== null) {
    //           resolve(JSON.parse(contactIds) as string[]);
    //         } else {
    //           resolve(null);
    //         }
    //       },
    //       error => reject(error)
    //     );
    //   });
    // }
    /**
     * Associating get point balance function to MiniAppBridge object.
     * (provided ali.miniapp.user.POINTS is allowed by the user)
     */
    // getPoints() {
    //   return new Promise<Points>((resolve, reject) => {
    //     return this.executor.exec(
    //       'getPoints',
    //       null,
    //       points => resolve(JSON.parse(points) as Points),
    //       error => reject(parseMiniAppError(error))
    //     );
    //   });
    // }
    MiniAppBridge.prototype.getHostEnvironmentInfo = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getHostEnvironmentInfo', null, function (info) {
                return resolve(__assign(__assign({}, JSON.parse(info)), { platform: _this.platform }));
            }, function (error) { return reject(error); });
        });
    };
    MiniAppBridge.prototype.downloadFile = function (filename, url, headers) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('downloadFile', { filename: filename, url: url, headers: headers }, function (id) {
                if (id !== 'null' && id !== null) {
                    resolve(id);
                }
                else {
                    resolve(null);
                }
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.setSecureStorage = function (items) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('setSecureStorageItems', { secureStorageItems: items }, function (success) { return resolve(undefined); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.getSecureStorageItem = function (key) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getSecureStorageItem', { secureStorageKey: key }, function (responseData) { return resolve(responseData); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.removeSecureStorageItems = function (keys) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('removeSecureStorageItems', { secureStorageKeyList: keys }, function (success) { return resolve(undefined); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.clearSecureStorage = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('clearSecureStorage', null, function (success) { return resolve(undefined); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.getSecureStorageSize = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getSecureStorageSize', null, function (responseData) {
                resolve(JSON.parse(responseData));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * @param alertInfo Close confirmation alert info.
     * @see {setCloseAlert}
     */
    MiniAppBridge.prototype.setCloseAlert = function (alertInfo) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('setCloseAlert', { closeAlertInfo: alertInfo }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     *
     * @param props AppViewProps object
     * @returns {configAppView}
     */
    MiniAppBridge.prototype.configAppView = function (appViewProps) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('configAppView', { appViewProps: appViewProps }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * Associating sendJsonToHostapp function to MiniAppBridge object.
     * @param {info} JSON/String information that you would like to send to HostApp.
     * @see {sendJsonToHostapp}
     */
    MiniAppBridge.prototype.sendJsonToHostapp = function (info) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('sendJsonToHostapp', { jsonInfo: { content: info } }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * Associating closeMiniApp function to MiniAppBridge object.
     * @param {withConfirmation} boolean value which will be used by the host app to show/hide close confirmation alert
     * which should be set using `setCloseAlert` method in prior before calling this interface
     * @see {closeMiniApp}
     */
    MiniAppBridge.prototype.closeMiniApp = function (withConfirmation) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('closeMiniApp', { withConfirmationAlert: withConfirmation }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.openMiniApp = function (info) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('openMiniApp', { openMiniAppInfo: info }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.openWebView = function (url) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('openWebView', { url: url }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.openUrl = function (url) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('openUrl', { url: url }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.openPhone = function (phoneNumber) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('openPhone', { phoneNumber: phoneNumber }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.scanQRCode = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('scanQRCode', null, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.chooseImage = function (options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('chooseImage', { chooseImageOptions: options }, function (response) { return resolve(JSON.parse(response)); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * Associating sendInfoToHostapp function to MiniAppBridge object.
     * @param {info} UniversalBridgeInfo information that you would like to send to HostApp.
     * @see {sendInfoToHostapp}
     */
    MiniAppBridge.prototype.sendInfoToHostapp = function (info) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('sendInfoToHostapp', { universalBridgeInfo: info }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.getHostAppThemeColors = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('getHostAppThemeColors', null, function (response) {
                resolve(JSON.parse(response));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.isDarkMode = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('isDarkMode', null, function (response) {
                resolve(MiniAppBridgeUtils.BooleanValue(response));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    // showKeyboard(): Promise<string> {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'showKeyboard',
    //       null,
    //       success => resolve(success),
    //       error => reject(parseMiniAppError(error))
    //     );
    //   });
    // }
    // hideKeyboard(): Promise<string> {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'hideKeyboard',
    //       null,
    //       success => resolve(success),
    //       error => reject(parseMiniAppError(error))
    //     );
    //   });
    // }
    MiniAppBridge.prototype.vibrate = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('vibrate', null, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    MiniAppBridge.prototype.keepScreen = function (keepScreenOn) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('keepScreen', { keepScreenOn: keepScreenOn }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    // sendAnalytics(analytics: MAAnalyticsInfo) {
    //   return new Promise<string>((resolve, reject) => {
    //     return this.executor.exec(
    //       'sendAnalytics',
    //       { analyticsInfo: analytics },
    //       success => resolve(success),
    //       error => reject(parseMiniAppError(error))
    //     );
    //   });
    // }
    MiniAppBridge.prototype.startVoIPCall = function (voipProps) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('startVoIPCall', { voipProps: voipProps }, function (success) { return resolve(success); }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * This interface is used to know if the user login status
     * @returns true/false based on the user profile status
     */
    MiniAppBridge.prototype.isLoggedIn = function () {
        return this.userProfileManager.isLoggedIn();
    };
    /**
     * Triggers the login UI for the user.
     * @returns - A promise that resolves when the login UI is triggered.
     */
    MiniAppBridge.prototype.triggerLoginUI = function () {
        return this.userProfileManager.triggerLoginUI();
    };
    /**
     * Triggers the register UI for the user.
     * @returns - A promise that resolves when the register UI is triggered.
     */
    MiniAppBridge.prototype.triggerRegisterUI = function () {
        return this.userProfileManager.triggerRegisterUI();
    };
    return MiniAppBridge;
}());
exports.MiniAppBridge = MiniAppBridge;
/**
 * Method to remove the callback object from the message queue after successful/error communication
 * with the native application
 * @param  {[Object]} queueObj Queue Object that holds the references of callback information.
 * @internal
 */
function removeFromMessageQueue(queueObj) {
    var messageObjIndex = mabMessageQueue.indexOf(queueObj);
    if (messageObjIndex !== -1) {
        mabMessageQueue.splice(messageObjIndex, 1);
    }
}
function removeFromEventQueue(queueObj) {
    var eventObjIndex = mabCustomEventQueue.indexOf(mabCustomEventQueue.filter(function (customEvent) { return customEvent.type === queueObj.type; })[0]);
    if (eventObjIndex !== -1) {
        mabCustomEventQueue.splice(eventObjIndex, 1);
    }
}
function removeFromKeyboardEventQueue(queueObj) {
    var eventObjIndex = mabKeyboardEventQueue.indexOf(mabKeyboardEventQueue.filter(function (customEvent) { return customEvent.type === queueObj.type; })[0]);
    if (eventObjIndex !== -1) {
        mabKeyboardEventQueue.splice(eventObjIndex, 1);
    }
}
// function trimBannerText(message: string = null, maxLength = 128) {
//   return message?.length > maxLength
//     ? message?.substring(0, maxLength - 1) + '…'
//     : message;
// }
var MiniAppBridgeUtils = /** @class */ (function () {
    function MiniAppBridgeUtils() {
    }
    MiniAppBridgeUtils.BooleanValue = function (value) {
        if (typeof value === 'boolean') {
            return value;
        }
        else if (typeof value === 'string') {
            var lowerCaseValue = value.toLowerCase();
            if (lowerCaseValue === 'true' || lowerCaseValue === '1') {
                return true;
            }
            else if (lowerCaseValue === 'false' || lowerCaseValue === '0') {
                return false;
            }
        }
        return false;
    };
    return MiniAppBridgeUtils;
}());
exports.MiniAppBridgeUtils = MiniAppBridgeUtils;

},{"./modules/ga":3,"./modules/userprofile-manager":4,"./types/error-types":6,"./types/event-types":9,"./types/secure-storage":11,"./types/share-info":12}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var common_bridge_1 = require("../common-bridge");
var platform_1 = require("../types/platform");
/* tslint:disable:no-any */
var uniqueId = Math.random();
// tslint:disable-next-line: variable-name
var GeolocationPositionError = {
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
};
var IOSExecutor = /** @class */ (function () {
    function IOSExecutor() {
    }
    IOSExecutor.prototype.execEvents = function (event) {
        window.dispatchEvent(event);
    };
    IOSExecutor.prototype.exec = function (action, param, onSuccess, onError) {
        var callback = {};
        callback.onSuccess = onSuccess;
        callback.onError = onError;
        callback.id = String(++uniqueId);
        common_bridge_1.mabMessageQueue.unshift(callback);
        window.webkit.messageHandlers.MiniAppiOS.postMessage(JSON.stringify({ action: action, param: param, id: callback.id }));
    };
    IOSExecutor.prototype.getPlatform = function () {
        return platform_1.Platform.IOS;
    };
    return IOSExecutor;
}());
var iOSExecutor = new IOSExecutor();
window.MiniAppBridge = new common_bridge_1.MiniAppBridge(iOSExecutor);
navigator.geolocation.getCurrentPosition = function (success, error, options) {
    return iOSExecutor.exec('getCurrentPosition', { locationOptions: options }, function (value) {
        try {
            var parsedData = JSON.parse(value);
            success(parsedData);
        }
        catch (error) {
            error({
                code: GeolocationPositionError.POSITION_UNAVAILABLE,
                message: 'Failed to parse location object from MiniAppBridge: ' + error,
            });
        }
    }, function (error) { return console.error(error); });
};

},{"../common-bridge":1,"../types/platform":10}],3:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAnalytic = void 0;
function getQueryParams() {
    var params = {};
    if (typeof window !== 'undefined' &&
        window.location &&
        window.location.search) {
        var searchParams = new URLSearchParams(window.location.search);
        searchParams.forEach(function (value, key) {
            params[key] = value;
        });
    }
    return params;
}
function extractMiniAppId(url) {
    var uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    var match = url.match(uuidPattern);
    return match ? match[0] : null;
}
// Re-adding 'export' allows this class to be imported by other files.
var GoogleAnalytic = /** @class */ (function () {
    function GoogleAnalytic(platform) {
        this.GA_STAG_ID = 'G-0GVMYK0E9Y';
        this.GA_ID = 'G-BWZK3HBEGY';
        this.MP_API_SECRET = 'T2xmX1ovTJWRfa6Zb02TBQ'; // Replace with your production API secret
        this.MP_API_SECRET_STAG = 'zR-y-Sj2R3uTJSBkZmrESQ'; // Replace with your staging API secret
        this.MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
        this.MP_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
        this.miniAppId = null;
        this.platform = platform;
        this.clientId = this.getOrCreateClientId();
    }
    // Helper function to get/set a client_id in localStorage
    GoogleAnalytic.prototype.getOrCreateClientId = function () {
        // Check if localStorage is available (not available in Node.js/test environment)
        if (typeof localStorage === 'undefined') {
            // Fallback for test environment - generate a random client ID
            return ('ga4-test-' + Date.now() + '-' + Math.floor(Math.random() * 1000000000));
        }
        var clientId = localStorage.getItem('ga4_client_id');
        if (!clientId) {
            clientId =
                'ga4-' + Date.now() + '-' + Math.floor(Math.random() * 1000000000);
            localStorage.setItem('ga4_client_id', clientId);
        }
        return clientId;
    };
    // Helper function to get/set a session_id and engagement time
    GoogleAnalytic.prototype.getSessionInfo = function () {
        // Check if localStorage is available (not available in Node.js/test environment)
        if (typeof localStorage === 'undefined') {
            // Fallback for test environment - return a simple session
            var now_1 = Date.now();
            return {
                session_id: "test-session-".concat(now_1),
                engagement_time_msec: 0,
            };
        }
        var sessionId = localStorage.getItem('ga4_session_id');
        var sessionStartTime = localStorage.getItem('ga4_session_start_time');
        var engagementTime = 0;
        var now = Date.now();
        var sessionTimeout = 30 * 60 * 1000; // 30 minutes for a new session
        if (!sessionId ||
            !sessionStartTime ||
            now - Number(sessionStartTime) > sessionTimeout) {
            // New session
            sessionId = now.toString(); // Use current timestamp as session ID
            sessionStartTime = now.toString();
            localStorage.setItem('ga4_session_id', sessionId);
            localStorage.setItem('ga4_session_start_time', sessionStartTime);
        }
        else {
            // Continue existing session, calculate engagement time
            engagementTime = now - Number(sessionStartTime);
            localStorage.setItem('ga4_session_start_time', now.toString()); // Update last interaction time
        }
        return {
            session_id: sessionId,
            engagement_time_msec: engagementTime,
        };
    };
    GoogleAnalytic.prototype.reportWebVital = function (metric) {
        return __awaiter(this, void 0, void 0, function () {
            var success;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.gaId)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.sendMPEvent(metric.name, {
                                value: metric.delta,
                                event_category: 'web_vitals',
                                event_label: metric.id,
                            })];
                    case 1:
                        success = _a.sent();
                        if (success) {
                            console.log("Web-vital ".concat(metric.name, " reported via MP to ").concat(this.gaId));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    GoogleAnalytic.prototype.init = function () {
        var _this = this;
        try {
            this.miniAppId = extractMiniAppId(window.location.href);
            var queryParams = getQueryParams();
            var env = queryParams.env;
            this.miniAppVersion = queryParams.mini_app_version;
            console.log('🚀 ~ GoogleAnalytic ~ init ~ queryParams:', queryParams);
            console.log('🚀 ~ GoogleAnalytic ~ miniAppId:', this.miniAppId);
            this.gaId = !!env ? this.GA_STAG_ID : this.GA_ID;
            this.mpApiSecret = !!env ? this.MP_API_SECRET_STAG : this.MP_API_SECRET;
            console.log('🚀 ~ GoogleAnalytic ~ using GA ID:', this.gaId);
            console.log('🚀 ~ GoogleAnalytic ~ using MP API Secret:', this.mpApiSecret ? 'SET' : 'NOT SET');
            if (queryParams.eruda === '1') {
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/eruda';
                script.onload = function () {
                    if (window.eruda) {
                        window.eruda.init({
                            tool: ['console', 'elements', 'network', 'resources', 'info'],
                        });
                    }
                };
                document.body.appendChild(script);
            }
            Promise.resolve().then(function () { return __importStar(require('web-vitals')); }).then(function (_a) {
                var onCLS = _a.onCLS, onINP = _a.onINP, onFCP = _a.onFCP, onLCP = _a.onLCP, onTTFB = _a.onTTFB;
                onCLS(_this.reportWebVital.bind(_this));
                onINP(_this.reportWebVital.bind(_this));
                onFCP(_this.reportWebVital.bind(_this));
                onLCP(_this.reportWebVital.bind(_this));
                onTTFB(_this.reportWebVital.bind(_this));
            });
        }
        catch (error) {
            console.error('Error initializing library analytics', error);
        }
    };
    GoogleAnalytic.prototype.updateSDKKey = function (newSdkKey) {
        if (newSdkKey && !this.sdkKey) {
            this.sdkKey = newSdkKey;
        }
    };
    GoogleAnalytic.prototype.updateUserId = function (newUserId) {
        this.userId = newUserId;
    };
    // Measurement Protocol: Send event directly to GA4 via HTTP
    GoogleAnalytic.prototype.sendMPEvent = function (eventName, eventParams, useDebug) {
        if (eventParams === void 0) { eventParams = {}; }
        if (useDebug === void 0) { useDebug = false; }
        return __awaiter(this, void 0, void 0, function () {
            var sessionInfo, payload, endpoint, baseUrl, success, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.gaId || !this.clientId || !this.mpApiSecret) {
                            console.error('GA ID, Client ID, or MP API Secret is not initialized. Cannot send MP event.');
                            return [2 /*return*/, false];
                        }
                        sessionInfo = this.getSessionInfo();
                        payload = {
                            client_id: this.clientId,
                            events: [
                                {
                                    name: eventName,
                                    params: __assign(__assign({}, eventParams), { session_id: sessionInfo.session_id, engagement_time_msec: sessionInfo.engagement_time_msec, 
                                        // Add mini app specific data
                                        mini_app_id: this.miniAppId, sdk_key: this.sdkKey, platform: this.platform, mini_app_version: this.miniAppVersion }),
                                },
                            ],
                        };
                        // Include user_id if available
                        if (this.userId) {
                            payload.user_id = this.userId;
                        }
                        endpoint = useDebug ? this.MP_DEBUG_ENDPOINT : this.MP_ENDPOINT;
                        baseUrl = "".concat(endpoint, "?measurement_id=").concat(this.gaId, "&api_secret=").concat(this.mpApiSecret);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Try using sendBeacon first (more reliable for analytics)
                        if (typeof navigator !== 'undefined' &&
                            navigator.sendBeacon &&
                            !useDebug) {
                            success = navigator.sendBeacon(baseUrl, JSON.stringify(payload));
                            if (success) {
                                console.log("\uD83D\uDE80 GA4 MP event '".concat(eventName, "' sent via sendBeacon"));
                                return [2 /*return*/, true];
                            }
                        }
                        return [4 /*yield*/, fetch(baseUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                body: JSON.stringify(payload),
                            })];
                    case 2:
                        response = _a.sent();
                        console.log("\uD83D\uDE80 GA4 MP event '".concat(eventName, "' sent via fetch (no-cors)"));
                        if (useDebug) {
                            console.log('🔍 Debug mode: Request sent but response not readable due to CORS');
                            console.log('💡 To see debug results, use server-side implementation or CORS proxy');
                        }
                        return [2 /*return*/, true];
                    case 3:
                        error_1 = _a.sent();
                        console.error("\u274C Error sending GA4 MP event '".concat(eventName, "':"), error_1);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Send custom event via Measurement Protocol
    GoogleAnalytic.prototype.sendMPCustomEvent = function (eventName, customParams) {
        if (customParams === void 0) { customParams = {}; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent(eventName, __assign(__assign({}, customParams), { source_page: typeof window !== 'undefined' ? window.location.pathname : '/test' }))];
            });
        });
    };
    // === SUGGESTED GA EVENTS FOR MINI-APP TRACKING ===
    // 1. APP LIFECYCLE EVENTS
    GoogleAnalytic.prototype.trackAppStart = function (loadTime) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('app_start', {
                        event_category: 'app_lifecycle',
                        event_label: 'mini_app_launch',
                        value: loadTime || Date.now(),
                        app_start_time: new Date().toISOString(),
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackAppClose = function (sessionDuration) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('app_close', {
                        event_category: 'app_lifecycle',
                        event_label: 'mini_app_exit',
                        value: sessionDuration,
                        session_duration: sessionDuration,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackAppBackground = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('app_background', {
                        event_category: 'app_lifecycle',
                        event_label: 'mini_app_background',
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackAppForeground = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('app_foreground', {
                        event_category: 'app_lifecycle',
                        event_label: 'mini_app_foreground',
                    })];
            });
        });
    };
    // 2. FEATURE USAGE EVENTS
    GoogleAnalytic.prototype.trackFeatureUsage = function (featureName, success, responseTime) {
        if (success === void 0) { success = true; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('feature_usage', {
                        event_category: 'feature_engagement',
                        event_label: featureName,
                        feature_name: featureName,
                        success: success,
                        response_time: responseTime,
                        value: success ? 1 : 0,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackPermissionRequest = function (permission, granted) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('permission_request', {
                        event_category: 'permissions',
                        event_label: permission,
                        permission_type: permission,
                        permission_granted: granted,
                        value: granted ? 1 : 0,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackApiCall = function (apiName, success, responseTime, errorCode) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('api_call', {
                        event_category: 'api_usage',
                        event_label: apiName,
                        api_name: apiName,
                        success: success,
                        response_time: responseTime,
                        error_code: errorCode || '',
                        value: responseTime,
                    })];
            });
        });
    };
    // 3. USER INTERACTION EVENTS
    GoogleAnalytic.prototype.trackButtonClick = function (buttonName, buttonLocation) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('button_click', {
                        event_category: 'user_interaction',
                        event_label: buttonName,
                        button_name: buttonName,
                        button_location: buttonLocation || 'unknown',
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackPageView = function (pageName, pageTitle) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('page_view', {
                        event_category: 'navigation',
                        event_label: pageName,
                        page_name: pageName,
                        page_title: pageTitle || pageName,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackUserInteraction = function (interactionType, elementName, value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('user_interaction', {
                        event_category: 'engagement',
                        event_label: "".concat(interactionType, "_").concat(elementName),
                        interaction_type: interactionType,
                        element_name: elementName,
                        value: value,
                    })];
            });
        });
    };
    // 4. ERROR TRACKING EVENTS
    GoogleAnalytic.prototype.trackError = function (errorType, errorMessage, errorCode, fatal) {
        if (fatal === void 0) { fatal = false; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('error_occurred', {
                        event_category: 'errors',
                        event_label: errorType,
                        error_type: errorType,
                        error_message: errorMessage,
                        error_code: errorCode || '',
                        fatal_error: fatal,
                        value: fatal ? 1 : 0,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackApiError = function (apiName, errorCode, errorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.trackError('api_error', errorMessage, errorCode, false)];
            });
        });
    };
    // 5. BUSINESS/CONVERSION EVENTS
    GoogleAnalytic.prototype.trackPurchase = function (transactionId, value, currency, items) {
        if (currency === void 0) { currency = 'USD'; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('purchase', {
                        event_category: 'ecommerce',
                        event_label: 'in_app_purchase',
                        transaction_id: transactionId,
                        value: value,
                        currency: currency,
                        items: JSON.stringify(items || []),
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackSignUp = function (method) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('sign_up', {
                        event_category: 'conversion',
                        event_label: method,
                        sign_up_method: method,
                        value: 1,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackShare = function (contentType, itemId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('share', {
                        event_category: 'engagement',
                        event_label: contentType,
                        content_type: contentType,
                        item_id: itemId || '',
                    })];
            });
        });
    };
    // 6. PERFORMANCE EVENTS
    GoogleAnalytic.prototype.trackLoadTime = function (loadType, duration) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('load_time', {
                        event_category: 'performance',
                        event_label: loadType,
                        load_type: loadType,
                        duration: duration,
                        value: duration,
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackNetworkSpeed = function (connectionType, speed) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('network_info', {
                        event_category: 'performance',
                        event_label: connectionType,
                        connection_type: connectionType,
                        connection_speed: speed || 'unknown',
                    })];
            });
        });
    };
    // 7. ENGAGEMENT EVENTS
    GoogleAnalytic.prototype.trackSessionStart = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('session_start', {
                        event_category: 'engagement',
                        event_label: 'new_session',
                        session_start_time: new Date().toISOString(),
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackEngagementTime = function (timeOnPage, pageName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('engagement_time', {
                        event_category: 'engagement',
                        event_label: pageName,
                        page_name: pageName,
                        time_on_page: timeOnPage,
                        value: timeOnPage,
                    })];
            });
        });
    };
    // 8. MINI-APP SPECIFIC EVENTS
    GoogleAnalytic.prototype.trackMiniAppOpen = function (openMethod) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('mini_app_open', {
                        event_category: 'mini_app_flow',
                        event_label: openMethod,
                        open_method: openMethod, // 'direct', 'deeplink', 'notification', etc.
                    })];
            });
        });
    };
    GoogleAnalytic.prototype.trackHostAppIntegration = function (integrationPoint, success) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sendMPEvent('host_app_integration', {
                        event_category: 'integration',
                        event_label: integrationPoint,
                        integration_point: integrationPoint,
                        success: success,
                        value: success ? 1 : 0,
                    })];
            });
        });
    };
    // === DEVICE TRACKING METHODS ===
    // Get comprehensive device information optimized for mobile webview
    GoogleAnalytic.prototype.getDeviceInfo = function () {
        var _a;
        var deviceInfo = {};
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            // Basic device info
            deviceInfo.user_agent = navigator.userAgent;
            // Enhanced mobile webview detection
            deviceInfo.is_mobile_webview = this.isMobileWebView();
            deviceInfo.webview_type = this.getWebViewType();
            // Use userAgentData if available (modern browsers), fallback to user agent parsing
            if ('userAgentData' in navigator &&
                navigator.userAgentData) {
                var userAgentData = navigator.userAgentData;
                if ((userAgentData === null || userAgentData === void 0 ? void 0 : userAgentData.brands) && userAgentData.brands.length > 0) {
                    deviceInfo.browser_brands = userAgentData.brands
                        .map(function (brand) { return "".concat(brand.brand, ":").concat(brand.version); })
                        .join(',');
                }
                deviceInfo.mobile = (userAgentData === null || userAgentData === void 0 ? void 0 : userAgentData.mobile) || true; // Default to true for mobile-only app
                deviceInfo.platform_from_ua_data = userAgentData === null || userAgentData === void 0 ? void 0 : userAgentData.platform;
            }
            deviceInfo.platform = this.platform;
            // Language and locale info
            deviceInfo.language = navigator.language;
            deviceInfo.languages = ((_a = navigator.languages) === null || _a === void 0 ? void 0 : _a.join(',')) || '';
            deviceInfo.cookie_enabled = navigator.cookieEnabled;
            // Mobile screen information (always present on mobile)
            if (screen) {
                deviceInfo.screen_width = screen.width;
                deviceInfo.screen_height = screen.height;
                deviceInfo.screen_color_depth = screen.colorDepth;
                deviceInfo.screen_pixel_depth = screen.pixelDepth;
                deviceInfo.screen_resolution = "".concat(screen.width, "x").concat(screen.height);
                // Available screen size (excluding system bars) - important for mobile
                deviceInfo.available_width = screen.availWidth;
                deviceInfo.available_height = screen.availHeight;
                // Device pixel ratio - crucial for mobile displays
                deviceInfo.device_pixel_ratio = window.devicePixelRatio || 1;
                // Mobile orientation
                if (screen.orientation) {
                    deviceInfo.screen_orientation = screen.orientation.type;
                    deviceInfo.screen_orientation_angle = screen.orientation.angle;
                }
                else {
                    // Fallback orientation detection
                    deviceInfo.screen_orientation =
                        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
                }
            }
            // Viewport information - critical for mobile webview
            if (window.innerWidth && window.innerHeight) {
                deviceInfo.viewport_width = window.innerWidth;
                deviceInfo.viewport_height = window.innerHeight;
                deviceInfo.viewport_resolution = "".concat(window.innerWidth, "x").concat(window.innerHeight);
                // Calculate if there are browser UI elements visible
                deviceInfo.viewport_ratio = (window.innerHeight / screen.height).toFixed(3);
                deviceInfo.has_browser_ui = window.innerHeight < screen.availHeight;
            }
            // Visual viewport API (useful for mobile keyboards, etc.)
            if (window.visualViewport) {
                deviceInfo.visual_viewport_width = window.visualViewport.width;
                deviceInfo.visual_viewport_height = window.visualViewport.height;
                deviceInfo.visual_viewport_scale = window.visualViewport.scale;
            }
            // Mobile connection information
            var connection = navigator.connection ||
                navigator.mozConnection ||
                navigator.webkitConnection;
            if (connection) {
                deviceInfo.connection_type =
                    connection.effectiveType || connection.type || 'unknown';
                deviceInfo.connection_downlink = connection.downlink || 0;
                deviceInfo.connection_rtt = connection.rtt || 0;
                deviceInfo.connection_save_data = connection.saveData || false;
            }
            // Memory information (available on some mobile browsers)
            if (navigator.deviceMemory) {
                deviceInfo.device_memory = navigator.deviceMemory;
            }
            // Hardware concurrency (CPU cores) - useful for mobile performance
            if (navigator.hardwareConcurrency) {
                deviceInfo.cpu_cores = navigator.hardwareConcurrency;
            }
            // Touch support - essential for mobile
            deviceInfo.touch_support =
                'ontouchstart' in window || navigator.maxTouchPoints > 0;
            deviceInfo.max_touch_points = navigator.maxTouchPoints || 0;
            // Mobile-specific features
            deviceInfo.supports_vibration = 'vibrate' in navigator;
            deviceInfo.supports_geolocation = 'geolocation' in navigator;
            deviceInfo.supports_accelerometer = 'DeviceMotionEvent' in window;
            deviceInfo.supports_gyroscope = 'DeviceOrientationEvent' in window;
            // Timezone information
            deviceInfo.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            deviceInfo.timezone_offset = new Date().getTimezoneOffset();
            // Battery API (if available)
            if ('getBattery' in navigator) {
                // Note: This is async, but we'll mark that it's supported
                deviceInfo.supports_battery_api = true;
            }
            // Standalone mode detection (PWA on mobile)
            deviceInfo.is_standalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                    navigator.standalone === true;
            // Mobile safe area insets (if available)
            var computedStyle = window.getComputedStyle(document.documentElement);
            var safeAreaTop = computedStyle.getPropertyValue('env(safe-area-inset-top)');
            var safeAreaBottom = computedStyle.getPropertyValue('env(safe-area-inset-bottom)');
            if (safeAreaTop || safeAreaBottom) {
                deviceInfo.safe_area_inset_top = safeAreaTop || '0px';
                deviceInfo.safe_area_inset_bottom = safeAreaBottom || '0px';
            }
        }
        return deviceInfo;
    };
    // Helper method to detect mobile webview
    GoogleAnalytic.prototype.isMobileWebView = function () {
        if (typeof navigator === 'undefined')
            return false;
        var userAgent = navigator.userAgent;
        // iOS WebView detection
        if (/iPad|iPhone|iPod/.test(userAgent)) {
            // Not Safari browser = WebView
            return (!/Safari/.test(userAgent) ||
                /(?:FB|FBAN|FBAV|FBSV|Line|WhatsApp|WeChat|Instagram|Twitter)/.test(userAgent));
        }
        // Android WebView detection
        if (/Android/.test(userAgent)) {
            // Has 'wv' in user agent or doesn't have Chrome
            return (/wv/.test(userAgent) ||
                !/Chrome/.test(userAgent) ||
                /(?:FB|FBAN|FBAV|Line|WhatsApp|WeChat|Instagram|Twitter)/.test(userAgent));
        }
        return false;
    };
    // Helper method to identify specific webview type
    GoogleAnalytic.prototype.getWebViewType = function () {
        if (typeof navigator === 'undefined')
            return 'unknown';
        var userAgent = navigator.userAgent;
        // Check for specific app webviews
        if (/FB|FBAN|FBAV|FBSV/.test(userAgent))
            return 'facebook';
        if (/Line/.test(userAgent))
            return 'line';
        if (/WhatsApp/.test(userAgent))
            return 'whatsapp';
        if (/WeChat/.test(userAgent))
            return 'wechat';
        if (/Instagram/.test(userAgent))
            return 'instagram';
        if (/Twitter/.test(userAgent))
            return 'twitter';
        if (/LinkedIn/.test(userAgent))
            return 'linkedin';
        if (/Snapchat/.test(userAgent))
            return 'snapchat';
        if (/TikTok/.test(userAgent))
            return 'tiktok';
        // Generic webview detection
        if (this.isMobileWebView()) {
            if (/Android/.test(userAgent))
                return 'android_webview';
            if (/iPad|iPhone|iPod/.test(userAgent))
                return 'ios_webview';
        }
        // Regular mobile browser
        if (/Mobile|Android|iPhone|iPad/.test(userAgent))
            return 'mobile_browser';
        return 'unknown';
    };
    // Parse detailed device info optimized for mobile
    GoogleAnalytic.prototype.parseDeviceDetails = function () {
        var deviceDetails = {
            device_type: 'mobile',
            os_name: 'unknown',
            os_version: 'unknown',
            browser_name: 'unknown',
            browser_version: 'unknown',
            device_brand: 'unknown',
            device_model: 'unknown',
            is_webview: 'false',
            webview_host: 'unknown',
        };
        if (typeof navigator === 'undefined')
            return deviceDetails;
        var userAgent = navigator.userAgent;
        // Enhanced iOS detection
        if (/iPad|iPhone|iPod/.test(userAgent)) {
            deviceDetails.device_type = 'iOS';
            deviceDetails.os_name = 'iOS';
            deviceDetails.device_brand = 'Apple';
            // Extract iOS version with better parsing
            var iosVersion = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/) ||
                userAgent.match(/Version\/(\d+)\.(\d+)\.?(\d+)?/);
            if (iosVersion) {
                deviceDetails.os_version = "".concat(iosVersion[1], ".").concat(iosVersion[2]).concat(iosVersion[3] ? '.' + iosVersion[3] : '');
            }
            // Enhanced device model detection
            if (/iPad/.test(userAgent)) {
                deviceDetails.device_model = 'iPad';
                // Try to detect specific iPad model
                if (/iPad.*OS 1[5-9]/.test(userAgent)) {
                    deviceDetails.device_model = 'iPad (Modern)';
                }
            }
            else if (/iPhone/.test(userAgent)) {
                deviceDetails.device_model = 'iPhone';
                // Try to detect iPhone model based on screen size or other indicators
                if (screen && screen.width === 414 && screen.height === 896) {
                    deviceDetails.device_model = 'iPhone XR/11';
                }
                else if (screen && screen.width === 375 && screen.height === 812) {
                    deviceDetails.device_model = 'iPhone X/XS';
                }
            }
            else if (/iPod/.test(userAgent)) {
                deviceDetails.device_model = 'iPod Touch';
            }
            // Enhanced webview detection for iOS
            if (!/Safari/.test(userAgent) || /CriOS|FxiOS|OPiOS/.test(userAgent)) {
                deviceDetails.is_webview = 'true';
                // Detect specific iOS webview hosts
                if (/CriOS/.test(userAgent)) {
                    deviceDetails.webview_host = 'chrome_ios';
                }
                else if (/FxiOS/.test(userAgent)) {
                    deviceDetails.webview_host = 'firefox_ios';
                }
                else if (/OPiOS/.test(userAgent)) {
                    deviceDetails.webview_host = 'opera_ios';
                }
                else if (/(?:FB|FBAN|FBAV|FBSV)/.test(userAgent)) {
                    deviceDetails.webview_host = 'facebook';
                }
                else if (/Line/.test(userAgent)) {
                    deviceDetails.webview_host = 'line';
                }
                else if (/WhatsApp/.test(userAgent)) {
                    deviceDetails.webview_host = 'whatsapp';
                }
                else if (/WeChat/.test(userAgent)) {
                    deviceDetails.webview_host = 'wechat';
                }
                else {
                    deviceDetails.webview_host = 'ios_app';
                }
            }
        }
        // Enhanced Android detection
        else if (/Android/.test(userAgent)) {
            deviceDetails.device_type = 'Android';
            deviceDetails.os_name = 'Android';
            // Extract Android version
            var androidVersion = userAgent.match(/Android (\d+\.?\d*\.?\d*)/);
            if (androidVersion) {
                deviceDetails.os_version = androidVersion[1];
            }
            // Enhanced device brand and model detection
            var brandModel = userAgent.match(/Android.*?;\s*([^)]+)/);
            if (brandModel) {
                var device = brandModel[1].trim();
                // Common Android device patterns
                if (/Samsung/.test(device) ||
                    /SM-/.test(device) ||
                    /Galaxy/.test(device)) {
                    deviceDetails.device_brand = 'Samsung';
                    deviceDetails.device_model = device.replace(/Samsung\s*/, '');
                }
                else if (/Pixel/.test(device)) {
                    deviceDetails.device_brand = 'Google';
                    deviceDetails.device_model = device;
                }
                else if (/Huawei|HUAWEI/.test(device)) {
                    deviceDetails.device_brand = 'Huawei';
                    deviceDetails.device_model = device.replace(/HUAWEI\s*/, '');
                }
                else if (/Xiaomi|MI\s/.test(device)) {
                    deviceDetails.device_brand = 'Xiaomi';
                    deviceDetails.device_model = device.replace(/Xiaomi\s*/, '');
                }
                else if (/OnePlus/.test(device)) {
                    deviceDetails.device_brand = 'OnePlus';
                    deviceDetails.device_model = device;
                }
                else if (/LG/.test(device)) {
                    deviceDetails.device_brand = 'LG';
                    deviceDetails.device_model = device.replace(/LG\s*/, '');
                }
                else {
                    // Try to split brand and model
                    var parts = device.split(/\s+/);
                    if (parts.length >= 2) {
                        deviceDetails.device_brand = parts[0];
                        deviceDetails.device_model = parts.slice(1).join(' ');
                    }
                    else {
                        deviceDetails.device_model = device;
                    }
                }
            }
            // Enhanced webview detection for Android
            if (/wv/.test(userAgent) || !/Chrome/.test(userAgent)) {
                deviceDetails.is_webview = 'true';
                // Detect specific Android webview hosts
                if (/(?:FB|FBAN|FBAV)/.test(userAgent)) {
                    deviceDetails.webview_host = 'facebook';
                }
                else if (/Line/.test(userAgent)) {
                    deviceDetails.webview_host = 'line';
                }
                else if (/WhatsApp/.test(userAgent)) {
                    deviceDetails.webview_host = 'whatsapp';
                }
                else if (/WeChat/.test(userAgent)) {
                    deviceDetails.webview_host = 'wechat';
                }
                else if (/Instagram/.test(userAgent)) {
                    deviceDetails.webview_host = 'instagram';
                }
                else if (/Twitter/.test(userAgent)) {
                    deviceDetails.webview_host = 'twitter';
                }
                else if (/wv/.test(userAgent)) {
                    deviceDetails.webview_host = 'android_app';
                }
                else {
                    deviceDetails.webview_host = 'android_system';
                }
            }
        }
        // Enhanced browser detection for mobile
        if (/CriOS/.test(userAgent)) {
            deviceDetails.browser_name = 'Chrome iOS';
            var chromeVersion = userAgent.match(/CriOS\/(\d+\.?\d*\.?\d*\.?\d*)/);
            if (chromeVersion)
                deviceDetails.browser_version = chromeVersion[1];
        }
        else if (/FxiOS/.test(userAgent)) {
            deviceDetails.browser_name = 'Firefox iOS';
            var firefoxVersion = userAgent.match(/FxiOS\/(\d+\.?\d*\.?\d*)/);
            if (firefoxVersion)
                deviceDetails.browser_version = firefoxVersion[1];
        }
        else if (/Chrome/.test(userAgent) && /Mobile/.test(userAgent)) {
            deviceDetails.browser_name = 'Chrome Mobile';
            var chromeVersion = userAgent.match(/Chrome\/(\d+\.?\d*\.?\d*\.?\d*)/);
            if (chromeVersion)
                deviceDetails.browser_version = chromeVersion[1];
        }
        else if (/Safari/.test(userAgent) &&
            /Mobile/.test(userAgent) &&
            !/Chrome/.test(userAgent)) {
            deviceDetails.browser_name = 'Safari Mobile';
            var safariVersion = userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/);
            if (safariVersion)
                deviceDetails.browser_version = safariVersion[1];
        }
        else if (/Firefox/.test(userAgent) && /Mobile/.test(userAgent)) {
            deviceDetails.browser_name = 'Firefox Mobile';
            var firefoxVersion = userAgent.match(/Firefox\/(\d+\.?\d*\.?\d*)/);
            if (firefoxVersion)
                deviceDetails.browser_version = firefoxVersion[1];
        }
        else if (/Edge/.test(userAgent) && /Mobile/.test(userAgent)) {
            deviceDetails.browser_name = 'Edge Mobile';
            var edgeVersion = userAgent.match(/Edge\/(\d+\.?\d*\.?\d*)/);
            if (edgeVersion)
                deviceDetails.browser_version = edgeVersion[1];
        }
        return deviceDetails;
    };
    // Track comprehensive mobile device information in a single call
    GoogleAnalytic.prototype.trackComprehensiveMobileInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var deviceInfo, deviceDetails, mobileInfo;
            return __generator(this, function (_a) {
                deviceInfo = this.getDeviceInfo();
                deviceDetails = this.parseDeviceDetails();
                mobileInfo = __assign(__assign({}, deviceInfo), deviceDetails);
                console.log('📱 Comprehensive Mobile Info:', mobileInfo);
                // Send the comprehensive mobile device info
                this.sendMPEvent('mobile_device_info', __assign({ event_category: 'mobile_device', event_label: "".concat(deviceDetails.device_type, "_").concat(deviceDetails.webview_host) }, mobileInfo));
                // Track webview type specifically
                this.sendMPEvent('webview_info', {
                    event_category: 'mobile_device',
                    event_label: deviceInfo.webview_type,
                    is_webview: deviceDetails.is_webview === 'true',
                    webview_host: deviceDetails.webview_host,
                    device_type: deviceDetails.device_type,
                });
                // Track screen characteristics
                if (deviceInfo.screen_width && deviceInfo.screen_height) {
                    this.sendMPEvent('screen_metrics', {
                        event_category: 'mobile_device',
                        event_label: "".concat(deviceInfo.screen_width, "x").concat(deviceInfo.screen_height),
                        screen_width: deviceInfo.screen_width,
                        screen_height: deviceInfo.screen_height,
                        device_pixel_ratio: deviceInfo.device_pixel_ratio,
                        viewport_ratio: deviceInfo.viewport_ratio,
                        screen_orientation: deviceInfo.screen_orientation,
                    });
                }
                // Track performance capabilities
                if (deviceInfo.connection_type ||
                    deviceInfo.device_memory ||
                    deviceInfo.cpu_cores) {
                    this.sendMPEvent('performance_metrics', {
                        event_category: 'mobile_device',
                        event_label: deviceInfo.connection_type || 'unknown',
                        connection_type: deviceInfo.connection_type,
                        connection_downlink: deviceInfo.connection_downlink,
                        device_memory: deviceInfo.device_memory,
                        cpu_cores: deviceInfo.cpu_cores,
                    });
                }
                return [2 /*return*/, true];
            });
        });
    };
    return GoogleAnalytic;
}());
exports.GoogleAnalytic = GoogleAnalytic;

},{"web-vitals":13}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileManager = void 0;
var common_bridge_1 = require("../common-bridge");
var error_types_1 = require("../types/error-types");
/**
 * Manages user profile related operations.
 */
var UserProfileManager = /** @class */ (function () {
    /**
     * Creates an instance of UserProfileManager.
     * @param {PlatformExecutor} executor - The executor to run platform-specific code.
     */
    function UserProfileManager(executor) {
        this.executor = executor;
        this.platform = executor.getPlatform();
    }
    /**
     * Checks if the user is logged in.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating the login status.
     * @see {isLoggedIn}
     */
    UserProfileManager.prototype.isLoggedIn = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('isLoggedIn', null, function (response) {
                resolve(common_bridge_1.MiniAppBridgeUtils.BooleanValue(response));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * Triggers the login UI for the user.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the login UI was successfully triggered.
     * @see {triggerLoginUI}
     */
    UserProfileManager.prototype.triggerLoginUI = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('triggerLoginUI', null, function (response) {
                resolve(common_bridge_1.MiniAppBridgeUtils.BooleanValue(response));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    /**
     * Triggers the register UI for the user.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the register UI was successfully triggered.
     * @see {triggerRegisterUI}
     */
    UserProfileManager.prototype.triggerRegisterUI = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this.executor.exec('triggerRegisterUI', null, function (response) {
                resolve(common_bridge_1.MiniAppBridgeUtils.BooleanValue(response));
            }, function (error) { return reject((0, error_types_1.parseMiniAppError)(error)); });
        });
    };
    return UserProfileManager;
}());
exports.UserProfileManager = UserProfileManager;

},{"../common-bridge":1,"../types/error-types":6}],5:[function(require,module,exports){
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
exports.parseDownloadError = exports.DownloadHttpError = exports.SaveFailureError = exports.InvalidUrlError = exports.DownloadFailedError = void 0;
var mini_app_error_1 = require("./mini-app-error");
var MiniAppDownloadErrorType;
(function (MiniAppDownloadErrorType) {
    MiniAppDownloadErrorType["DownloadFailedError"] = "DownloadFailedError";
    MiniAppDownloadErrorType["InvalidUrlError"] = "InvalidUrlError";
    MiniAppDownloadErrorType["SaveFailureError"] = "SaveFailureError";
    MiniAppDownloadErrorType["DownloadHttpError"] = "DownloadHttpError";
})(MiniAppDownloadErrorType || (MiniAppDownloadErrorType = {}));
/**
 * Error returned by `MiniApp.downloadFile` when failed to download or save the file.
 */
var DownloadFailedError = /** @class */ (function (_super) {
    __extends(DownloadFailedError, _super);
    function DownloadFailedError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, DownloadFailedError.prototype);
        _this.message = 'Failed to download the file.';
        return _this;
    }
    return DownloadFailedError;
}(mini_app_error_1.MiniAppError));
exports.DownloadFailedError = DownloadFailedError;
/**
 * Error returned by `MiniApp.downloadFile` when the provided URL is invalid.
 * Only `http:`, `https:` and `data:` URLs are supported.
 */
var InvalidUrlError = /** @class */ (function (_super) {
    __extends(InvalidUrlError, _super);
    function InvalidUrlError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, InvalidUrlError.prototype);
        _this.message = 'The provided URL is invalid.';
        return _this;
    }
    return InvalidUrlError;
}(mini_app_error_1.MiniAppError));
exports.InvalidUrlError = InvalidUrlError;
/**
 * Error returned by `MiniApp.downloadFile` when failed to save file to device.
 */
var SaveFailureError = /** @class */ (function (_super) {
    __extends(SaveFailureError, _super);
    function SaveFailureError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, SaveFailureError.prototype);
        _this.message = 'Failed to save the file to the device.';
        return _this;
    }
    return SaveFailureError;
}(mini_app_error_1.MiniAppError));
exports.SaveFailureError = SaveFailureError;
/**
 * Error returned by `MiniApp.downloadFile` when failed to download the file due to an HTTP error.
 * @param code HTTP error code returned by the server.
 */
var DownloadHttpError = /** @class */ (function (_super) {
    __extends(DownloadHttpError, _super);
    function DownloadHttpError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, DownloadHttpError.prototype);
        _this.code = errorInput.code;
        _this.message = errorInput.message;
        return _this;
    }
    return DownloadHttpError;
}(mini_app_error_1.MiniAppError));
exports.DownloadHttpError = DownloadHttpError;
function parseDownloadError(json) {
    var errorType = MiniAppDownloadErrorType[json.type];
    switch (errorType) {
        case MiniAppDownloadErrorType.DownloadFailedError:
            return new DownloadFailedError(json);
        case MiniAppDownloadErrorType.InvalidUrlError:
            return new InvalidUrlError(json);
        case MiniAppDownloadErrorType.SaveFailureError:
            return new SaveFailureError(json);
        case MiniAppDownloadErrorType.DownloadHttpError:
            return new DownloadHttpError(json);
        default:
            return undefined;
    }
}
exports.parseDownloadError = parseDownloadError;

},{"./mini-app-error":7}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureStorageIOError = exports.SecureStorageUnavailableError = exports.SecureStorageBusyError = exports.SecureStorageFullError = exports.SaveFailureError = exports.parseMiniAppError = exports.MiniAppError = exports.InvalidUrlError = exports.DownloadHttpError = exports.DownloadFailedError = void 0;
// import {
//   AuthorizationFailureError,
//   AudienceNotSupportedError,
//   parseAuthError,
//   ScopesNotSupportedError,
// } from './auth-errors';
var download_file_errors_1 = require("./download-file-errors");
Object.defineProperty(exports, "DownloadFailedError", { enumerable: true, get: function () { return download_file_errors_1.DownloadFailedError; } });
Object.defineProperty(exports, "DownloadHttpError", { enumerable: true, get: function () { return download_file_errors_1.DownloadHttpError; } });
Object.defineProperty(exports, "InvalidUrlError", { enumerable: true, get: function () { return download_file_errors_1.InvalidUrlError; } });
Object.defineProperty(exports, "SaveFailureError", { enumerable: true, get: function () { return download_file_errors_1.SaveFailureError; } });
var secure_storage_errors_1 = require("./secure-storage-errors");
Object.defineProperty(exports, "SecureStorageFullError", { enumerable: true, get: function () { return secure_storage_errors_1.SecureStorageFullError; } });
Object.defineProperty(exports, "SecureStorageBusyError", { enumerable: true, get: function () { return secure_storage_errors_1.SecureStorageBusyError; } });
Object.defineProperty(exports, "SecureStorageUnavailableError", { enumerable: true, get: function () { return secure_storage_errors_1.SecureStorageUnavailableError; } });
Object.defineProperty(exports, "SecureStorageIOError", { enumerable: true, get: function () { return secure_storage_errors_1.SecureStorageIOError; } });
// import {
//   PurchaseFailedError,
//   ConsumeFailedError,
//   ProductNotFoundError,
//   ProductPurchasedAlreadyError,
//   UserCancelledPurchaseError,
//   parseInAppPurchaseError,
// } from './in-app-purchase-errors';
var mini_app_error_1 = require("./mini-app-error");
Object.defineProperty(exports, "MiniAppError", { enumerable: true, get: function () { return mini_app_error_1.MiniAppError; } });
function parseMiniAppError(jsonString) {
    try {
        var json = JSON.parse(jsonString);
        return (
        // parseAuthError(json) ||
        (0, download_file_errors_1.parseDownloadError)(json) ||
            (0, secure_storage_errors_1.parseStorageError)(json) ||
            // parseInAppPurchaseError(json) ||
            new mini_app_error_1.MiniAppError(json));
    }
    catch (e) {
        console.error(e);
        return new mini_app_error_1.MiniAppError({
            type: 'MiniAppError',
            message: 'Failed to parse the error: ' + jsonString,
        });
    }
}
exports.parseMiniAppError = parseMiniAppError;

},{"./download-file-errors":5,"./mini-app-error":7,"./secure-storage-errors":8}],7:[function(require,module,exports){
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
exports.MiniAppError = void 0;
/**
 * This class is a representation of an error sent from MiniApp mobile SDK
 */
var MiniAppError = /** @class */ (function (_super) {
    __extends(MiniAppError, _super);
    function MiniAppError(errorInput) {
        var _this = _super.call(this) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, MiniAppError.prototype);
        _this.name = errorInput.type;
        _this.message = errorInput.message;
        return _this;
    }
    return MiniAppError;
}(Error));
exports.MiniAppError = MiniAppError;

},{}],8:[function(require,module,exports){
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
exports.parseStorageError = exports.SecureStorageIOError = exports.SecureStorageUnavailableError = exports.SecureStorageBusyError = exports.SecureStorageFullError = void 0;
var mini_app_error_1 = require("./mini-app-error");
var MiniAppStorageErrorType;
(function (MiniAppStorageErrorType) {
    MiniAppStorageErrorType["SecureStorageFullError"] = "SecureStorageFullError";
    MiniAppStorageErrorType["SecureStorageBusyError"] = "SecureStorageBusyError";
    MiniAppStorageErrorType["SecureStorageUnavailableError"] = "SecureStorageUnavailableError";
    MiniAppStorageErrorType["SecureStorageIOError"] = "SecureStorageIOError";
})(MiniAppStorageErrorType || (MiniAppStorageErrorType = {}));
var SecureStorageFullError = /** @class */ (function (_super) {
    __extends(SecureStorageFullError, _super);
    function SecureStorageFullError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, SecureStorageFullError.prototype);
        _this.message = 'Storage limit is exceeded or full already';
        return _this;
    }
    return SecureStorageFullError;
}(mini_app_error_1.MiniAppError));
exports.SecureStorageFullError = SecureStorageFullError;
var SecureStorageBusyError = /** @class */ (function (_super) {
    __extends(SecureStorageBusyError, _super);
    function SecureStorageBusyError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, SecureStorageBusyError.prototype);
        _this.message = 'Storage is busy, please try again';
        return _this;
    }
    return SecureStorageBusyError;
}(mini_app_error_1.MiniAppError));
exports.SecureStorageBusyError = SecureStorageBusyError;
var SecureStorageUnavailableError = /** @class */ (function (_super) {
    __extends(SecureStorageUnavailableError, _super);
    function SecureStorageUnavailableError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, SecureStorageUnavailableError.prototype);
        _this.message = 'Storage is not yet loaded or failed to load';
        return _this;
    }
    return SecureStorageUnavailableError;
}(mini_app_error_1.MiniAppError));
exports.SecureStorageUnavailableError = SecureStorageUnavailableError;
var SecureStorageIOError = /** @class */ (function (_super) {
    __extends(SecureStorageIOError, _super);
    function SecureStorageIOError(errorInput) {
        var _this = _super.call(this, errorInput) || this;
        _this.errorInput = errorInput;
        Object.setPrototypeOf(_this, SecureStorageIOError.prototype);
        _this.message = 'Unable to read/write changes in Storage.';
        return _this;
    }
    return SecureStorageIOError;
}(mini_app_error_1.MiniAppError));
exports.SecureStorageIOError = SecureStorageIOError;
function parseStorageError(json) {
    var errorType = MiniAppStorageErrorType[json.type];
    switch (errorType) {
        case MiniAppStorageErrorType.SecureStorageFullError:
            return new SecureStorageFullError(json);
        case MiniAppStorageErrorType.SecureStorageBusyError:
            return new SecureStorageBusyError(json);
        case MiniAppStorageErrorType.SecureStorageUnavailableError:
            return new SecureStorageUnavailableError(json);
        case MiniAppStorageErrorType.SecureStorageIOError:
            return new SecureStorageIOError(json);
        default:
            return undefined;
    }
}
exports.parseStorageError = parseStorageError;

},{"./mini-app-error":7}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostAppEvents = exports.MiniAppKeyboardEvents = exports.MiniAppEvents = void 0;
/**
 * Enum for supported SDK event types
 */
var MiniAppEvents;
(function (MiniAppEvents) {
    MiniAppEvents["EXTERNAL_WEBVIEW_CLOSE"] = "miniappwebviewclosed";
    MiniAppEvents["PAUSE"] = "miniapppause";
    MiniAppEvents["RESUME"] = "miniappresume";
    MiniAppEvents["REQUEST_GO_BACK"] = "miniapprequestgoback";
})(MiniAppEvents = exports.MiniAppEvents || (exports.MiniAppEvents = {}));
/**
 * Enum for supported keyboard event types
 */
var MiniAppKeyboardEvents;
(function (MiniAppKeyboardEvents) {
    MiniAppKeyboardEvents["KEYBOARDSHOWN"] = "miniappkeyboardshown";
    MiniAppKeyboardEvents["KEYBOARDHIDDEN"] = "miniappkeyboardhidden";
})(MiniAppKeyboardEvents = exports.MiniAppKeyboardEvents || (exports.MiniAppKeyboardEvents = {}));
/**
 * Enum for supported HostApp event types
 */
var HostAppEvents;
(function (HostAppEvents) {
    HostAppEvents["SCREEN_DIMENSION_CHANGE"] = "miniappscreendimensionchange";
    HostAppEvents["RECEIVE_JSON_INFO"] = "miniappreceivejsoninfo";
})(HostAppEvents = exports.HostAppEvents || (exports.HostAppEvents = {}));

},{}],10:[function(require,module,exports){
"use strict";
/** @internal */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Platform = void 0;
/** Device platform. */
var Platform;
(function (Platform) {
    Platform["ANDROID"] = "Android";
    Platform["IOS"] = "iOS";
})(Platform = exports.Platform || (exports.Platform = {}));

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiniAppSecureStorageEvents = void 0;
var MiniAppSecureStorageEvents;
(function (MiniAppSecureStorageEvents) {
    MiniAppSecureStorageEvents["onReady"] = "miniappsecurestorageready";
    MiniAppSecureStorageEvents["onLoadError"] = "miniappsecurestorageloaderror";
})(MiniAppSecureStorageEvents = exports.MiniAppSecureStorageEvents || (exports.MiniAppSecureStorageEvents = {}));

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateShareInfo = exports.SHARE_INFO_INVALID_IMAGE = exports.SHARE_INFO_DOWNLOAD_FAILED = exports.SHARE_INFO_INVALID_URL = exports.SHARE_INFO_EMPTY_VALUE = exports.SHARE_INFO_INVALID_MESSAGE = void 0;
exports.SHARE_INFO_INVALID_MESSAGE = 'Invalid or unexpected shareInfo message.';
exports.SHARE_INFO_EMPTY_VALUE = 'ShareInfo content must not be empty.';
exports.SHARE_INFO_INVALID_URL = 'The provided URL is invalid.';
exports.SHARE_INFO_DOWNLOAD_FAILED = 'Failed to download the shared file.';
exports.SHARE_INFO_INVALID_IMAGE = 'Downloaded shareInfo image is invalid.';
var HTTP_URL_PATTERN = /^https?:\/\//i;
var UNSAFE_FILE_NAME_PATTERN = /(^$)|(^\.+$)|[\\/\0]|\.\./;
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyTrimmedString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isHttpUrl(value) {
    if (typeof value !== 'string' || !HTTP_URL_PATTERN.test(value)) {
        return false;
    }
    try {
        var url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch (e) {
        return false;
    }
}
function assertUrl(value) {
    if (!isHttpUrl(value)) {
        throw new Error(exports.SHARE_INFO_INVALID_URL);
    }
}
function assertUrlArray(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(exports.SHARE_INFO_INVALID_MESSAGE);
    }
    value.forEach(assertUrl);
    return value;
}
function isSafeFileName(value) {
    return (isNonEmptyTrimmedString(value) &&
        !UNSAFE_FILE_NAME_PATTERN.test(value.trim()));
}
function assertOptionalMatchingArray(value, expectedLength, name) {
    if (value === undefined) {
        return;
    }
    if (!Array.isArray(value) || value.length !== expectedLength) {
        throw new Error("".concat(exports.SHARE_INFO_INVALID_MESSAGE, " ").concat(name, " length must match urls length."));
    }
}
function assertFileNames(value, expectedLength, required) {
    if (value === undefined && !required) {
        return;
    }
    if (!Array.isArray(value) ||
        value.length !== expectedLength ||
        !value.every(isSafeFileName)) {
        throw new Error(exports.SHARE_INFO_INVALID_MESSAGE);
    }
}
function assertContent(value) {
    if (!isNonEmptyTrimmedString(value)) {
        throw new Error(exports.SHARE_INFO_EMPTY_VALUE);
    }
}
function validateShareInfo(info) {
    if (!isObject(info)) {
        throw new Error(exports.SHARE_INFO_INVALID_MESSAGE);
    }
    var type = info.type;
    if (type === undefined) {
        assertContent(info.content);
        return info;
    }
    switch (type) {
        case 'text':
            assertContent(info.content);
            return info;
        case 'link':
            assertUrl(info.url);
            return info;
        case 'image': {
            var urls = assertUrlArray(info.urls);
            assertFileNames(info.fileNames, urls.length, false);
            return info;
        }
        case 'file': {
            var urls = assertUrlArray(info.urls);
            assertFileNames(info.fileNames, urls.length, true);
            assertOptionalMatchingArray(info.mimeTypes, urls.length, 'mimeTypes');
            return info;
        }
        default:
            throw new Error(exports.SHARE_INFO_INVALID_MESSAGE);
    }
}
exports.validateShareInfo = validateShareInfo;

},{}],13:[function(require,module,exports){
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).webVitals={})}(this,function(e){"use strict";let t=-1;const n=e=>{addEventListener("pageshow",n=>{n.persisted&&(t=n.timeStamp,e(n))},!0)},i=(e,t,n,i)=>{let o,s;return r=>{t.value>=0&&(r||i)&&(s=t.value-(o??0),(s||void 0===o)&&(o=t.value,t.delta=s,t.rating=((e,t)=>e>t[1]?"poor":e>t[0]?"needs-improvement":"good")(t.value,n),e(t)))}},o=e=>{requestAnimationFrame(()=>requestAnimationFrame(e))},s=()=>{const e=performance.getEntriesByType("navigation")[0];if(e&&e.responseStart>0&&e.responseStart<performance.now())return e},r=()=>s()?.activationStart??0,c=(e,n=-1)=>{const i=s();let o="navigate";t>=0?o="back-forward-cache":i&&(document.prerendering||r()>0?o="prerender":document.wasDiscarded?o="restore":i.type&&(o=i.type.replace(/_/g,"-")));return{name:e,value:n,rating:"good",delta:0,entries:[],id:`v5-${Date.now()}-${Math.floor(8999999999999*Math.random())+1e12}`,navigationType:o}},a=new WeakMap;function d(e,t){return a.get(e)||a.set(e,new t),a.get(e)}class f{t;i=0;o=[];h(e){if(e.hadRecentInput)return;const t=this.o[0],n=this.o.at(-1);this.i&&t&&n&&e.startTime-n.startTime<1e3&&e.startTime-t.startTime<5e3?(this.i+=e.value,this.o.push(e)):(this.i=e.value,this.o=[e]),this.t?.(e)}}const h=(e,t,n={})=>{try{if(PerformanceObserver.supportedEntryTypes.includes(e)){const i=new PerformanceObserver(e=>{queueMicrotask(()=>{t(e.getEntries())})});return i.observe({type:e,buffered:!0,...n}),i}}catch{}},l=e=>{let t=!1;return()=>{t||(e(),t=!0)}};let u=-1;const p=new Set,m=()=>"hidden"!==document.visibilityState||document.prerendering?1/0:0,g=e=>{if("hidden"===document.visibilityState){if("visibilitychange"===e.type)for(const e of p)e();isFinite(u)||(u="visibilitychange"===e.type?e.timeStamp:0,removeEventListener("prerenderingchange",g,!0))}},v=()=>{if(u<0){const e=r(),t=document.prerendering?void 0:globalThis.performance.getEntriesByType("visibility-state").find(t=>"hidden"===t.name&&t.startTime>=e)?.startTime;u=t??m(),addEventListener("visibilitychange",g,!0),addEventListener("prerenderingchange",g,!0),n(()=>{setTimeout(()=>{u=m()})})}return{get firstHiddenTime(){return u},onHidden(e){p.add(e)}}},y=e=>{document.prerendering?addEventListener("prerenderingchange",e,!0):e()},T=[1800,3e3],b=(e,t={})=>{y(()=>{const s=v();let a,d=c("FCP");const f=h("paint",e=>{for(const t of e)"first-contentful-paint"===t.name&&(f.disconnect(),t.startTime<s.firstHiddenTime&&(d.value=Math.max(t.startTime-r(),0),d.entries.push(t),a(!0)))});f&&(a=i(e,d,T,t.reportAllChanges),n(n=>{d=c("FCP"),a=i(e,d,T,t.reportAllChanges),o(()=>{d.value=performance.now()-n.timeStamp,a(!0)})}))})},E=[.1,.25];let L=0,P=1/0,_=0;const M=e=>{for(const t of e)t.interactionId&&(P=Math.min(P,t.interactionId),_=Math.max(_,t.interactionId),L=_?(_-P)/7+1:0)};let w;const C=()=>w?L:performance.interactionCount??0,I=()=>{"interactionCount"in performance||w||(w=h("event",M,{durationThreshold:0}))};let F=0;class k{l=[];u=new Map;p;m;v(){F=C(),this.l.length=0,this.u.clear()}T(){const e=Math.min(this.l.length-1,Math.floor((C()-F)/50));return this.l[e]}h(e){if(this.p?.(e),!e.interactionId&&"first-input"!==e.entryType)return;const t=this.l.at(-1);let n=this.u.get(e.interactionId);if(n||this.l.length<10||e.duration>t.L){if(n?e.duration>n.L?(n.entries=[e],n.L=e.duration):e.duration===n.L&&e.startTime===n.entries[0].startTime&&n.entries.push(e):(n={id:e.interactionId,entries:[e],L:e.duration},this.u.set(n.id,n),this.l.push(n)),this.l.sort((e,t)=>t.L-e.L),this.l.length>10){const e=this.l.splice(10);for(const t of e)this.u.delete(t.id)}this.m?.(n)}}}const x=e=>{const t=globalThis.requestIdleCallback||setTimeout,n=globalThis.cancelIdleCallback||clearTimeout;if("hidden"===document.visibilityState)e();else{const i=l(e);let o=-1;const s=()=>{n(o),i()};addEventListener("visibilitychange",s,{once:!0,capture:!0}),o=t(()=>{removeEventListener("visibilitychange",s,{capture:!0}),i()})}},A=[200,500];class B{p;h(e){this.p?.(e)}}const S=[2500,4e3],q=[800,1800],N=e=>{document.prerendering?y(()=>N(e)):"complete"!==document.readyState?addEventListener("load",()=>N(e),!0):setTimeout(e)};e.CLSThresholds=E,e.FCPThresholds=T,e.INPThresholds=A,e.LCPThresholds=S,e.TTFBThresholds=q,e.onCLS=(e,t={})=>{const s=v();b(l(()=>{let r,a=c("CLS",0);const l=d(t,f),u=e=>{for(const t of e)l.h(t);l.i>a.value&&(a.value=l.i,a.entries=l.o,r())},p=h("layout-shift",u);p&&(r=i(e,a,E,t.reportAllChanges),s.onHidden(()=>{u(p.takeRecords()),r(!0)}),n(()=>{l.i=0,a=c("CLS",0),r=i(e,a,E,t.reportAllChanges),o(r)}),setTimeout(r))}))},e.onFCP=b,e.onINP=(e,t={})=>{if(!globalThis.PerformanceEventTiming||!("interactionId"in PerformanceEventTiming.prototype))return;const o=v();y(()=>{I();let s,r=c("INP");const a=d(t,k),f=e=>{x(()=>{for(const t of e)a.h(t);const t=a.T();t&&t.L!==r.value&&(r.value=t.L,r.entries=t.entries,s())})},l=h("event",f,{durationThreshold:t.durationThreshold??40});s=i(e,r,A,t.reportAllChanges),l&&(l.observe({type:"first-input",buffered:!0}),o.onHidden(()=>{f(l.takeRecords()),s(!0)}),n(()=>{a.v(),r=c("INP"),s=i(e,r,A,t.reportAllChanges)}))})},e.onLCP=(e,t={})=>{y(()=>{const s=v();let a,f=c("LCP");const u=d(t,B),p=e=>{t.reportAllChanges||(e=e.slice(-1));for(const t of e)u.h(t),t.startTime<s.firstHiddenTime&&(f.value=Math.max(t.startTime-r(),0),f.entries=[t],a())},m=h("largest-contentful-paint",p);if(m){a=i(e,f,S,t.reportAllChanges);const s=l(()=>{p(m.takeRecords()),m.disconnect(),a(!0)}),r=e=>{e.isTrusted&&(x(s),removeEventListener(e.type,r,{capture:!0}))};for(const e of["keydown","click","visibilitychange"])addEventListener(e,r,{capture:!0});n(n=>{f=c("LCP"),a=i(e,f,S,t.reportAllChanges),o(()=>{f.value=performance.now()-n.timeStamp,a(!0)})})}})},e.onTTFB=(e,t={})=>{let o=c("TTFB"),a=i(e,o,q,t.reportAllChanges);N(()=>{const d=s();d&&(o.value=Math.max(d.responseStart-r(),0),o.entries=[d],a(!0),n(()=>{o=c("TTFB",0),a=i(e,o,q,t.reportAllChanges),a(!0)}))})}});

},{}]},{},[2]);
