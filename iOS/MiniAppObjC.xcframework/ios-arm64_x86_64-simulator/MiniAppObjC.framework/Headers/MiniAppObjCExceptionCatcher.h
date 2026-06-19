#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Bridges Objective-C `@try/@catch` to Swift, which cannot natively catch
/// `NSException`. Used to guard `WKURLSchemeTask` callbacks that raise
/// `NSInternalInconsistencyException` when the task has been invalidated by
/// WebKit (e.g. the owning `WKWebView` was deallocated mid-load).
@interface MiniAppObjCExceptionCatcher : NSObject

/// Runs `tryBlock`. If it raises an `NSException`, `catchBlock` (if provided)
/// is invoked with the exception and the error is swallowed.
/// - Returns: `YES` if `tryBlock` completed without raising, otherwise `NO`.
+ (BOOL)catchExceptionInBlock:(NS_NOESCAPE void (^)(void))block
                        catch:(nullable void (^)(NSException *exception))catchBlock
    NS_SWIFT_NAME(catchException(_:catch:));

@end

NS_ASSUME_NONNULL_END
